import { describe, expect, it } from "vitest";

import {
  DEFAULT_METRIC_THRESHOLD,
  EVALUATION_SCHEMA_VERSION,
  EvaluationDatasetError,
  evaluateDataset,
  validateDataset,
} from "./evaluation";

const FIXED_TIME = "2026-11-18T12:00:00.000Z";

function dataset(cases: unknown[], overrides: Record<string, unknown> = {}) {
  return {
    name: "unit-dataset",
    revision: "1",
    metrics: ["answer_quality"],
    cases,
    ...overrides,
  };
}

describe("validateDataset", () => {
  it("accepts a minimal valid dataset", () => {
    const value = dataset([
      {
        id: "c1",
        input: "pergunta",
        candidate: { answer: "resposta" },
        expected: {},
      },
    ]);

    expect(validateDataset(value)).toEqual(value);
  });

  it.each([
    [null, "dataset deve ser um objeto JSON"],
    [{ ...dataset([]), name: "" }, "dataset.name é obrigatório"],
    [{ ...dataset([]), revision: 1 }, "dataset.revision é obrigatório"],
    [
      { ...dataset([]), metrics: [] },
      "dataset.metrics deve ser uma lista não vazia",
    ],
    [
      { ...dataset([]), metrics: ["unknown"] },
      "dataset.metrics contém métrica desconhecida",
    ],
    [
      { ...dataset([]), cases: [] },
      "dataset.cases deve ser uma lista não vazia",
    ],
    [
      {
        ...dataset([
          {
            id: "dup",
            input: "a",
            candidate: { answer: "a" },
            expected: {},
          },
          {
            id: "dup",
            input: "b",
            candidate: { answer: "b" },
            expected: {},
          },
        ]),
      },
      "case.id duplicado: dup",
    ],
    [
      {
        ...dataset([
          { id: "c1", input: 1, candidate: { answer: "a" }, expected: {} },
        ]),
      },
      "case.input deve ser texto",
    ],
    [
      {
        ...dataset([{ id: "c1", input: "a", candidate: {}, expected: {} }]),
      },
      "case.candidate.answer deve ser texto",
    ],
    [
      {
        ...dataset(
          [
            {
              id: "c1",
              input: "p",
              candidate: { answer: "a" },
              expected: {},
            },
          ],
          { thresholds: { answer_quality: 2 } },
        ),
      },
      "threshold inválido para answer_quality",
    ],
  ])("rejects invalid dataset: %#", (value, message) => {
    expect(() => validateDataset(value)).toThrowError(
      new EvaluationDatasetError(message as string),
    );
  });
});

describe("evaluateDataset", () => {
  it("scores answer_quality case-insensitively and requires every fragment", () => {
    const report = evaluateDataset(
      dataset(
        [
          {
            id: "ok",
            input: "p1",
            candidate: { answer: "O CACHE USA TTL" },
            expected: { answerContains: ["cache", "ttl"] },
          },
          {
            id: "fail",
            input: "p2",
            candidate: { answer: "Resposta curta" },
            expected: { answerContains: ["cache", "ttl"] },
          },
        ],
        { metrics: ["answer_quality"], thresholds: { answer_quality: 0.4 } },
      ),
      FIXED_TIME,
    );

    expect(report.schemaVersion).toBe(EVALUATION_SCHEMA_VERSION);
    expect(report.generatedAt).toBe(FIXED_TIME);
    expect(report.datasets[0]?.metrics[0]).toMatchObject({
      metric: "answer_quality",
      score: 0.5,
      threshold: 0.4,
      passed: true,
      evaluatedCases: 2,
      passedCases: 1,
    });
  });

  it("uses the default threshold when none is configured", () => {
    const report = evaluateDataset(
      dataset([
        {
          id: "fail",
          input: "p",
          candidate: { answer: "sem relacao" },
          expected: { answerContains: ["ausente"] },
        },
      ]),
      FIXED_TIME,
    );

    expect(report.datasets[0]?.metrics[0]?.threshold).toBe(
      DEFAULT_METRIC_THRESHOLD,
    );
    expect(report.passed).toBe(false);
  });

  it("ignores cases without the metric signal", () => {
    const report = evaluateDataset(
      dataset([
        {
          id: "no-signal",
          input: "p",
          candidate: { answer: "qualquer" },
          expected: {},
        },
        {
          id: "scored",
          input: "p2",
          candidate: { answer: "ttl por usuario" },
          expected: { answerContains: ["ttl"] },
        },
      ]),
      FIXED_TIME,
    );

    expect(report.datasets[0]?.cases).toBe(2);
    expect(report.datasets[0]?.metrics[0]).toMatchObject({
      evaluatedCases: 1,
      passedCases: 1,
      score: 1,
    });
  });

  it("scores citation_fidelity only when citations cover expected sources and never invent sources", () => {
    const report = evaluateDataset(
      dataset(
        [
          {
            id: "ok",
            input: "p1",
            candidate: {
              answer: "a",
              sources: ["s1", "s2"],
              citations: ["s1"],
            },
            expected: { sourceIds: ["s1"] },
          },
          {
            id: "missing-citation",
            input: "p2",
            candidate: { answer: "a", sources: ["s1"], citations: [] },
            expected: { sourceIds: ["s1"] },
          },
          {
            id: "invented-source",
            input: "p3",
            candidate: { answer: "a", sources: ["s1"], citations: ["s2"] },
            expected: { sourceIds: ["s1"] },
          },
        ],
        {
          metrics: ["citation_fidelity"],
          thresholds: { citation_fidelity: 0.3 },
        },
      ),
      FIXED_TIME,
    );

    expect(report.datasets[0]?.metrics[0]).toMatchObject({
      evaluatedCases: 3,
      passedCases: 1,
      score: 0.333,
      passed: true,
    });
  });

  it("scores no_answer as no_match with zero citations", () => {
    const report = evaluateDataset(
      dataset(
        [
          {
            id: "ok",
            input: "p1",
            candidate: {
              answer:
                "Nao sei responder com seguranca com base nas fontes disponiveis.",
              answerStatus: "no_match",
              citations: [],
            },
            expected: { noAnswer: true },
          },
          {
            id: "cited",
            input: "p2",
            candidate: {
              answer:
                "Nao sei responder com seguranca com base nas fontes disponiveis.",
              answerStatus: "no_match",
              citations: ["s1"],
            },
            expected: { noAnswer: true },
          },
          {
            id: "plain",
            input: "p3",
            candidate: { answer: "resposta", answerStatus: "plain" },
            expected: { noAnswer: true },
          },
        ],
        { metrics: ["no_answer"], thresholds: { no_answer: 0.3 } },
      ),
      FIXED_TIME,
    );

    expect(report.datasets[0]?.metrics[0]).toMatchObject({
      evaluatedCases: 3,
      passedCases: 1,
      score: 0.333,
    });
  });

  it("scores media_intent by exact media kind", () => {
    const report = evaluateDataset(
      dataset(
        [
          {
            id: "ok",
            input: "p1",
            candidate: { answer: "a", mediaKind: "image" },
            expected: { mediaKind: "image" },
          },
          {
            id: "wrong-kind",
            input: "p2",
            candidate: { answer: "a", mediaKind: "video" },
            expected: { mediaKind: "image" },
          },
        ],
        { metrics: ["media_intent"], thresholds: { media_intent: 0.4 } },
      ),
      FIXED_TIME,
    );

    expect(report.datasets[0]?.metrics[0]).toMatchObject({
      evaluatedCases: 2,
      passedCases: 1,
      score: 0.5,
      passed: true,
    });
  });

  it("aggregates multiple metrics into the dataset score", () => {
    const report = evaluateDataset(
      dataset(
        [
          {
            id: "c1",
            input: "p",
            candidate: { answer: "abc", mediaKind: "image" },
            expected: { answerContains: ["abc"], mediaKind: "image" },
          },
        ],
        {
          metrics: ["answer_quality", "media_intent"],
          thresholds: { answer_quality: 1, media_intent: 1 },
        },
      ),
      FIXED_TIME,
    );

    expect(report.datasets[0]).toMatchObject({
      score: 1,
      passed: true,
      cases: 1,
    });
    expect(report.datasets[0]?.metrics).toHaveLength(2);
    expect(report.passed).toBe(true);
  });

  it("is deterministic for the same dataset and timestamp", () => {
    const value = dataset([
      {
        id: "c1",
        input: "p",
        candidate: { answer: "ttl" },
        expected: { answerContains: ["ttl"] },
      },
    ]);

    expect(evaluateDataset(value, FIXED_TIME)).toEqual(
      evaluateDataset(value, FIXED_TIME),
    );
  });
});
