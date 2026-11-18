export const EVALUATION_SCHEMA_VERSION = 1 as const;
export const DEFAULT_METRIC_THRESHOLD = 0.8;

export const EVALUATION_METRICS = [
  "answer_quality",
  "citation_fidelity",
  "no_answer",
  "media_intent",
] as const;

export type MetricName = (typeof EVALUATION_METRICS)[number];

export type EvaluationCase = {
  id: string;
  input: string;
  candidate: {
    answer: string;
    answerStatus?:
      "plain" | "with_source" | "no_match" | "retrieval_unavailable";
    sources?: string[];
    citations?: string[];
    mediaKind?: "image" | "video";
  };
  expected: {
    answerContains?: string[];
    sourceIds?: string[];
    noAnswer?: boolean;
    mediaKind?: "image" | "video";
  };
};

export type EvaluationDataset = {
  name: string;
  revision: string;
  metrics: MetricName[];
  thresholds?: Partial<Record<MetricName, number>>;
  cases: EvaluationCase[];
};

export type MetricResult = {
  metric: MetricName;
  score: number;
  threshold: number;
  passed: boolean;
  evaluatedCases: number;
  passedCases: number;
};

export type DatasetResult = {
  name: string;
  revision: string;
  score: number;
  passed: boolean;
  cases: number;
  metrics: MetricResult[];
};

export type EvaluationReport = {
  schemaVersion: typeof EVALUATION_SCHEMA_VERSION;
  generatedAt: string;
  passed: boolean;
  datasets: DatasetResult[];
};

export class EvaluationDatasetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EvaluationDatasetError";
  }
}

function round(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

function metricScore(
  metric: MetricName,
  evaluationCase: EvaluationCase,
): boolean | null {
  const expected = evaluationCase.expected;
  const candidate = evaluationCase.candidate;

  switch (metric) {
    case "answer_quality": {
      if (expected.answerContains === undefined) return null;

      const answer = candidate.answer.toLowerCase();

      return expected.answerContains.every((fragment) =>
        answer.includes(fragment.toLowerCase()),
      );
    }
    case "citation_fidelity": {
      if (expected.sourceIds === undefined) return null;

      const sources = new Set(candidate.sources ?? []);
      const citations = candidate.citations ?? [];

      return (
        expected.sourceIds.every((sourceId) => citations.includes(sourceId)) &&
        citations.every((sourceId) => sources.has(sourceId))
      );
    }
    case "no_answer": {
      if (expected.noAnswer !== true) return null;

      return (
        candidate.answerStatus === "no_match" &&
        (candidate.citations ?? []).length === 0
      );
    }
    case "media_intent": {
      if (expected.mediaKind === undefined) return null;

      return candidate.mediaKind === expected.mediaKind;
    }
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMetric(value: unknown): value is MetricName {
  return (
    typeof value === "string" &&
    (EVALUATION_METRICS as readonly string[]).includes(value)
  );
}

/** Validates the minimum contract before any score is produced. */
export function validateDataset(value: unknown): EvaluationDataset {
  if (!isObject(value)) {
    throw new EvaluationDatasetError("dataset deve ser um objeto JSON");
  }
  if (typeof value.name !== "string" || value.name.trim() === "") {
    throw new EvaluationDatasetError("dataset.name é obrigatório");
  }
  if (typeof value.revision !== "string" || value.revision.trim() === "") {
    throw new EvaluationDatasetError("dataset.revision é obrigatório");
  }
  if (!Array.isArray(value.metrics) || value.metrics.length === 0) {
    throw new EvaluationDatasetError(
      "dataset.metrics deve ser uma lista não vazia",
    );
  }
  if (!value.metrics.every(isMetric)) {
    throw new EvaluationDatasetError(
      "dataset.metrics contém métrica desconhecida",
    );
  }
  if (!Array.isArray(value.cases) || value.cases.length === 0) {
    throw new EvaluationDatasetError(
      "dataset.cases deve ser uma lista não vazia",
    );
  }

  const ids = new Set<string>();

  for (const evaluationCase of value.cases) {
    if (
      !isObject(evaluationCase) ||
      typeof evaluationCase.id !== "string" ||
      evaluationCase.id.trim() === ""
    ) {
      throw new EvaluationDatasetError("case.id é obrigatório");
    }
    if (ids.has(evaluationCase.id)) {
      throw new EvaluationDatasetError(
        `case.id duplicado: ${evaluationCase.id}`,
      );
    }
    ids.add(evaluationCase.id);
    if (typeof evaluationCase.input !== "string") {
      throw new EvaluationDatasetError("case.input deve ser texto");
    }
    if (
      !isObject(evaluationCase.candidate) ||
      typeof evaluationCase.candidate.answer !== "string"
    ) {
      throw new EvaluationDatasetError("case.candidate.answer deve ser texto");
    }
    if (!isObject(evaluationCase.expected)) {
      throw new EvaluationDatasetError("case.expected é obrigatório");
    }
  }

  if (value.thresholds !== undefined) {
    if (!isObject(value.thresholds)) {
      throw new EvaluationDatasetError("dataset.thresholds deve ser um objeto");
    }
    for (const [metric, threshold] of Object.entries(value.thresholds)) {
      if (!isMetric(metric)) {
        throw new EvaluationDatasetError(
          "dataset.thresholds contém métrica desconhecida",
        );
      }
      if (
        typeof threshold !== "number" ||
        !Number.isFinite(threshold) ||
        threshold < 0 ||
        threshold > 1
      ) {
        throw new EvaluationDatasetError(`threshold inválido para ${metric}`);
      }
    }
  }

  return value as unknown as EvaluationDataset;
}

/** Deterministic, offline scoring. Every case contributes at most once. */
export function evaluateDataset(
  value: unknown,
  generatedAt = new Date().toISOString(),
): EvaluationReport {
  const dataset = validateDataset(value);
  const metrics: MetricResult[] = dataset.metrics.map((metric) => {
    const outcomes = dataset.cases
      .map((evaluationCase) => metricScore(metric, evaluationCase))
      .filter((outcome): outcome is boolean => outcome !== null);
    const passedCases = outcomes.filter(Boolean).length;
    const score =
      outcomes.length === 0 ? 0 : round(passedCases / outcomes.length);
    const threshold = dataset.thresholds?.[metric] ?? DEFAULT_METRIC_THRESHOLD;

    return {
      metric,
      score,
      threshold,
      passed: outcomes.length > 0 && score >= threshold,
      evaluatedCases: outcomes.length,
      passedCases,
    };
  });
  const score =
    metrics.length === 0
      ? 0
      : round(
          metrics.reduce((sum, metric) => sum + metric.score, 0) /
            metrics.length,
        );
  const result: DatasetResult = {
    name: dataset.name,
    revision: dataset.revision,
    score,
    passed: metrics.every((metric) => metric.passed),
    cases: dataset.cases.length,
    metrics,
  };

  return {
    schemaVersion: EVALUATION_SCHEMA_VERSION,
    generatedAt,
    passed: result.passed,
    datasets: [result],
  };
}
