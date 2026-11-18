import {
  EVALUATION_SCHEMA_VERSION,
  EvaluationDatasetError,
  evaluateDataset,
  validateDataset,
  type EvaluationReport,
  type MetricName,
} from "../domain/evaluation";

export type EvaluationCliDependencies = {
  readFile: (path: string) => Promise<string>;
  listDatasets?: () => Promise<string[]>;
  now?: () => string;
};

export type EvaluationCliResult = {
  exitCode: 0 | 1 | 2;
  output: string[];
  report?: EvaluationReport;
  reportPath: string | null;
};

type Baseline = Map<string, Map<MetricName, number>>;

const HELP = [
  "Uso: bun run obs:eval [--dataset <arquivo>] [--baseline <relatorio>] [--out <arquivo>]",
  "Padrao: executa todos os JSON em eval/datasets.",
  "Codigos de saida: 0 = ok, 1 = limiar nao atendido, 2 = dataset/relatorio invalido.",
];

function error(message: string): EvaluationCliResult {
  return { exitCode: 2, output: [`Erro: ${message}`], reportPath: null };
}

function formatScore(value: number): string {
  return value.toFixed(3);
}

function formatDelta(value: number): string {
  return `${value >= 0 ? "+" : ""}${formatScore(value)}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseBaseline(value: unknown): Baseline {
  if (
    !isObject(value) ||
    value.schemaVersion !== EVALUATION_SCHEMA_VERSION ||
    !Array.isArray(value.datasets)
  ) {
    throw new EvaluationDatasetError("baseline inválido");
  }

  const baseline: Baseline = new Map();

  for (const dataset of value.datasets) {
    if (
      !isObject(dataset) ||
      typeof dataset.name !== "string" ||
      !Array.isArray(dataset.metrics)
    ) {
      throw new EvaluationDatasetError("baseline inválido");
    }
    const metrics = new Map<MetricName, number>();

    for (const metric of dataset.metrics) {
      if (!isObject(metric) || typeof metric.metric !== "string") {
        throw new EvaluationDatasetError("baseline inválido");
      }
      if (typeof metric.score !== "number" || !Number.isFinite(metric.score)) {
        throw new EvaluationDatasetError("baseline inválido");
      }
      metrics.set(metric.metric as MetricName, metric.score);
    }
    baseline.set(dataset.name, metrics);
  }

  return baseline;
}

function formatReport(
  report: EvaluationReport,
  baseline: Baseline | null,
): string[] {
  const lines = [
    `Observability evaluation report (schema v${report.schemaVersion})`,
    `Generated at: ${report.generatedAt}`,
  ];

  for (const dataset of report.datasets) {
    lines.push("", `Dataset: ${dataset.name} @ ${dataset.revision}`);
    lines.push(`  cases: ${dataset.cases}`);

    for (const metric of dataset.metrics) {
      const baselineScore = baseline?.get(dataset.name)?.get(metric.metric);
      const comparison =
        baselineScore === undefined
          ? ""
          : ` delta=${formatDelta(metric.score - baselineScore)}`;
      lines.push(
        `  ${metric.metric}: ${formatScore(metric.score)} / ${formatScore(metric.threshold)} ${metric.passed ? "PASS" : "FAIL"}${comparison}`,
      );
    }

    lines.push(
      `  overall: ${formatScore(dataset.score)} ${dataset.passed ? "PASS" : "FAIL"}`,
    );
  }

  const passed = report.datasets.filter((dataset) => dataset.passed).length;

  lines.push(
    "",
    `Summary: ${passed}/${report.datasets.length} datasets passed`,
  );

  return lines;
}

/** CLI logic kept pure so argument parsing and exit codes can be unit tested. */
export async function runEvaluationCli(
  args: string[],
  dependencies: EvaluationCliDependencies,
): Promise<EvaluationCliResult> {
  if (args.includes("--help")) {
    return { exitCode: 0, output: HELP, reportPath: null };
  }

  const paths: string[] = [];
  let baselinePath: string | null = null;
  let reportPath: string | null = null;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (
      argument === "--dataset" ||
      argument === "--baseline" ||
      argument === "--out"
    ) {
      const value = args[index + 1];

      if (value === undefined || value.startsWith("--")) {
        return error(`${argument} requer um caminho`);
      }
      if (argument === "--dataset") paths.push(value);
      if (argument === "--baseline") baselinePath = value;
      if (argument === "--out") reportPath = value;
      index += 1;
      continue;
    }

    return error(`argumento desconhecido: ${argument}`);
  }

  if (paths.length === 0) {
    if (dependencies.listDatasets === undefined) {
      return error("nenhum dataset informado e descoberta indisponível");
    }
    try {
      paths.push(...(await dependencies.listDatasets()));
    } catch {
      return error("não foi possível listar datasets");
    }
  }
  if (paths.length === 0) return error("nenhum dataset encontrado");

  let baseline: Baseline | null = null;

  if (baselinePath !== null) {
    try {
      baseline = parseBaseline(
        JSON.parse(await dependencies.readFile(baselinePath)) as unknown,
      );
    } catch (caught) {
      if (caught instanceof EvaluationDatasetError) {
        return error(caught.message);
      }

      return error("baseline inválido");
    }
  }

  const datasets = [];

  for (const path of paths) {
    let value: unknown;

    try {
      value = JSON.parse(await dependencies.readFile(path)) as unknown;
      validateDataset(value);
    } catch (caught) {
      const message =
        caught instanceof EvaluationDatasetError
          ? caught.message
          : "JSON inválido";

      return error(`dataset ${path}: ${message}`);
    }

    datasets.push(...evaluateDataset(value, dependencies.now?.()).datasets);
  }

  const report: EvaluationReport = {
    schemaVersion: EVALUATION_SCHEMA_VERSION,
    generatedAt: dependencies.now?.() ?? new Date().toISOString(),
    passed: datasets.every((dataset) => dataset.passed),
    datasets,
  };

  return {
    exitCode: report.passed ? 0 : 1,
    output: formatReport(report, baseline),
    report,
    reportPath,
  };
}
