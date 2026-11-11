#!/usr/bin/env node
/**
 * Executa um script k6 de `load-tests/`. Usa o `k6` do PATH quando existe;
 * senão roda a imagem oficial via Docker (já exigido pelo projeto).
 *
 * Uso: node scripts/k6.mjs <script> [PROFILE] [-- args extras do k6]
 *   node scripts/k6.mjs api smoke
 *   node scripts/k6.mjs api stress
 *   node scripts/k6.mjs rate-limit
 *
 * Variáveis repassadas ao k6: BASE_URL, LOAD_USERS, LOAD_PASSWORD,
 * INCLUDE_EMAIL_FLOWS.
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const K6_IMAGE = "grafana/k6:1.4.0";
const PASSTHROUGH = ["LOAD_USERS", "LOAD_PASSWORD", "INCLUDE_EMAIL_FLOWS"];

const [script = "api", profile, ...rest] = process.argv.slice(2);
const extraArgs = rest.filter((arg) => arg !== "--");

function run(command, args, options = {}) {
  // Sem shell: `docker` e `k6` são executáveis e o path do repo pode ter espaços.
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    ...options,
  });

  if (result.error) {
    if (result.error.code === "ENOENT") {
      return 127;
    }

    throw result.error;
  }

  return result.status ?? 1;
}

const hasLocalK6 = run("k6", ["version"], { stdio: "ignore" }) === 0;
const envPairs = PASSTHROUGH.filter((key) => process.env[key]).map((key) => [
  key,
  process.env[key],
]);

if (profile) {
  envPairs.push(["PROFILE", profile]);
}

let status;

if (hasLocalK6) {
  const baseUrl = process.env.BASE_URL ?? "http://localhost:3333/api/v1";

  envPairs.push(["BASE_URL", baseUrl]);
  status = run("k6", [
    "run",
    ...envPairs.flatMap(([key, value]) => ["-e", `${key}=${value}`]),
    ...extraArgs,
    join("load-tests", `${script}.js`),
  ]);
} else {
  // Dentro do container, "localhost" é o próprio container: usa o host.
  const baseUrl =
    process.env.BASE_URL ?? "http://host.docker.internal:3333/api/v1";

  envPairs.push(["BASE_URL", baseUrl]);
  status = run("docker", [
    "run",
    "--rm",
    "-i",
    "--add-host=host.docker.internal:host-gateway",
    "-v",
    `${join(root, "load-tests")}:/scripts:ro`,
    K6_IMAGE,
    "run",
    ...envPairs.flatMap(([key, value]) => ["-e", `${key}=${value}`]),
    ...extraArgs,
    `/scripts/${script}.js`,
  ]);
}

process.exit(status);
