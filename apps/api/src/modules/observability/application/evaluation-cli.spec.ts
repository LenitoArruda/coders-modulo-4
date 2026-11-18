import { describe, expect, it, vi } from "vitest";

import {
  EVALUATION_SCHEMA_VERSION,
  type EvaluationReport,
} from "../domain/evaluation";
import { runEvaluationCli } from "./evaluation-cli";

const FIXED_TIME = "2026-11-18T12:00:00.000Z";
const DATASET_PATH = "/datasets/unit.json";

const passingDataset = {
  name: "unit-dataset",
  revision: "1",
  metrics: ["answer_quality"],
  thresholds: { answer_quality: 0.8 },
  cases: [
    {
      id: "c1",
      input: "pergunta",
      candidate: { answer: "ttl por usuario" },
      expected: { answerContains: ["ttl"] },
    },
  ],
};

const failingDataset = {
  ...passingDataset,
  cases: [
    {
      id: "c1",
      input: "pergunta",
      candidate: { answer: "sem relacao" },
      expected: { answerContains: ["ausente"] },
    },
  ],
};

function dependencies(files: Record<string, string>, datasets: string[] = []) {
  return {
    readFile: vi.fn(async (path: string) => {
      const content = files[path];

      if (content === undefined) throw new Error(`ENOENT: ${path}`);
      return content;
    }),
    listDatasets: vi.fn(async () => datasets),
    now: () => FIXED_TIME,
  };
}

const passingFiles = { [DATASET_PATH]: JSON.stringify(passingDataset) };

describe("runEvaluationCli", () => {
  it("prints help without touching the filesystem", async () => {
    const deps = dependencies({});

    const result = await runEvaluationCli(["--help"], deps);

    expect(result.exitCode).toBe(0);
    expect(result.output[0]).toContain("Uso:");
    expect(deps.readFile).not.toHaveBeenCalled();
  });

  it("rejects unknown arguments and missing option values", async () => {
    const deps = dependencies(passingFiles);

    expect((await runEvaluationCli(["--unknown"], deps)).exitCode).toBe(2);
    expect((await runEvaluationCli(["--dataset"], deps)).exitCode).toBe(2);
    expect(
      (await runEvaluationCli(["--baseline", "--out", "x"], deps)).exitCode,
    ).toBe(2);
  });

  it("reports a clear error when no dataset is provided or discovered", async () => {
    expect(
      (await runEvaluationCli([], { readFile: vi.fn(), now: () => FIXED_TIME }))
        .output[0],
    ).toContain("nenhum dataset informado");
    expect(
      (await runEvaluationCli([], dependencies({}, []))).output[0],
    ).toContain("nenhum dataset encontrado");
  });

  it("reports a clear error when dataset discovery fails or a file is missing", async () => {
    const failingDiscovery = dependencies({}, []);

    failingDiscovery.listDatasets.mockRejectedValueOnce(new Error("EACCES"));

    expect((await runEvaluationCli([], failingDiscovery)).output[0]).toContain(
      "não foi possível listar datasets",
    );
    expect(
      (await runEvaluationCli(["--dataset", "/missing.json"], dependencies({})))
        .output[0],
    ).toContain("dataset /missing.json");
  });

  it("rejects invalid JSON and invalid dataset contracts", async () => {
    const deps = dependencies({
      [DATASET_PATH]: "{ invalid",
      "/datasets/invalid.json": JSON.stringify({
        ...passingDataset,
        revision: 1,
      }),
    });

    expect(
      (await runEvaluationCli(["--dataset", DATASET_PATH], deps)).exitCode,
    ).toBe(2);
    expect(
      (await runEvaluationCli(["--dataset", "/datasets/invalid.json"], deps))
        .output[0],
    ).toContain("dataset.revision é obrigatório");
  });

  it("emits a readable report and exit code 0 for passing datasets", async () => {
    const result = await runEvaluationCli(
      ["--dataset", DATASET_PATH],
      dependencies(passingFiles),
    );
    const output = result.output.join("\n");

    expect(result.exitCode).toBe(0);
    expect(result.reportPath).toBeNull();
    expect(result.report?.schemaVersion).toBe(EVALUATION_SCHEMA_VERSION);
    expect(result.report?.generatedAt).toBe(FIXED_TIME);
    expect(result.report?.passed).toBe(true);
    expect(output).toContain("Dataset: unit-dataset @ 1");
    expect(output).toContain("answer_quality: 1.000 / 0.800 PASS");
    expect(output).toContain("Summary: 1/1 datasets passed");
  });

  it("returns exit code 1 when a threshold is not met", async () => {
    const result = await runEvaluationCli(
      ["--dataset", DATASET_PATH],
      dependencies({ [DATASET_PATH]: JSON.stringify(failingDataset) }),
    );

    expect(result.exitCode).toBe(1);
    expect(result.report?.passed).toBe(false);
    expect(result.output.join("\n")).toContain(
      "answer_quality: 0.000 / 0.800 FAIL",
    );
  });

  it("discovers sorted datasets when --dataset is omitted", async () => {
    const secondPath = "/datasets/second.json";
    const deps = dependencies(
      {
        [DATASET_PATH]: JSON.stringify(passingDataset),
        [secondPath]: JSON.stringify({
          ...passingDataset,
          name: "second-dataset",
        }),
      },
      [secondPath, DATASET_PATH],
    );

    const result = await runEvaluationCli([], deps);

    expect(result.exitCode).toBe(0);
    expect(result.report?.datasets.map((dataset) => dataset.name)).toEqual([
      "second-dataset",
      "unit-dataset",
    ]);
  });

  it("compares against a valid baseline and rejects an invalid one", async () => {
    const baseline: EvaluationReport = {
      schemaVersion: EVALUATION_SCHEMA_VERSION,
      generatedAt: FIXED_TIME,
      passed: true,
      datasets: [
        {
          name: "unit-dataset",
          revision: "0",
          score: 0.5,
          passed: true,
          cases: 1,
          metrics: [
            {
              metric: "answer_quality",
              score: 0.5,
              threshold: 0.8,
              passed: false,
              evaluatedCases: 1,
              passedCases: 0,
            },
          ],
        },
      ],
    };
    const files = {
      ...passingFiles,
      "/baseline.json": JSON.stringify(baseline),
      "/invalid-baseline.json": JSON.stringify({ schemaVersion: 99 }),
    };

    const compared = await runEvaluationCli(
      ["--dataset", DATASET_PATH, "--baseline", "/baseline.json"],
      dependencies(files),
    );

    expect(compared.exitCode).toBe(0);
    expect(compared.output.join("\n")).toContain("delta=+0.500");

    const invalid = await runEvaluationCli(
      ["--dataset", DATASET_PATH, "--baseline", "/invalid-baseline.json"],
      dependencies(files),
    );

    expect(invalid.exitCode).toBe(2);
    expect(invalid.output[0]).toContain("baseline inválido");
  });

  it("returns the report and output path for --out without writing the file", async () => {
    const result = await runEvaluationCli(
      ["--dataset", DATASET_PATH, "--out", "/report.json"],
      dependencies(passingFiles),
    );

    expect(result.exitCode).toBe(0);
    expect(result.reportPath).toBe("/report.json");
    expect(result.report?.datasets[0]?.name).toBe("unit-dataset");
  });
});
