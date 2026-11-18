import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { runEvaluationCli } from "../apps/api/src/modules/observability/application/evaluation-cli";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const datasetsDir = resolve(scriptDir, "..", "eval", "datasets");

async function listDatasets(): Promise<string[]> {
  const entries = await readdir(datasetsDir);

  return entries
    .filter((entry) => entry.endsWith(".json"))
    .sort()
    .map((entry) => resolve(datasetsDir, entry));
}

async function main(): Promise<void> {
  const result = await runEvaluationCli(process.argv.slice(2), {
    readFile: (path) => readFile(path, "utf8"),
    listDatasets,
  });

  for (const line of result.output) {
    console.log(line);
  }

  if (result.report !== undefined && result.reportPath !== null) {
    await writeFile(
      result.reportPath,
      `${JSON.stringify(result.report, null, 2)}\n`,
      "utf8",
    );
    console.log(`Report written to: ${result.reportPath}`);
  }

  process.exit(result.exitCode);
}

await main();
