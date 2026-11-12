#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const isWindows = process.platform === "win32";
const composeFile = join(root, "docker-compose.yml");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: isWindows,
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  return result.status ?? 1;
}

function fail(message) {
  console.error(`\n[infra] ${message}\n`);
  process.exit(1);
}

function ensureDocker() {
  const available = run("docker", ["info"], { stdio: "ignore" });

  if (available !== 0) {
    fail(
      "Docker não está instalado ou não está em execução. Inicie o Docker Desktop e tente novamente.",
    );
  }
}

function up() {
  ensureDocker();

  if (!existsSync(composeFile)) {
    fail("docker-compose.yml não encontrado na raiz do repositório.");
  }

  const compose = run("docker", ["compose", "up", "-d", "--wait"]);

  if (compose !== 0) {
    fail(
      "Não foi possível subir a infraestrutura. Verifique se as portas 5432, 3010, 4317 e 4318 estão livres.",
    );
  }

  console.log("[infra] Ambiente local pronto:");
  console.log(
    "  - PostgreSQL: localhost:5432 (ou POSTGRES_PORT do .env) — banco coders_modulo_4",
  );
  console.log("  - Grafana:    http://localhost:3010");
  console.log("  - OTLP gRPC:  localhost:4317");
  console.log("  - OTLP HTTP:  localhost:4318");
  console.log(
    "[infra] Preencha DATABASE_URL no .env e rode: bun run db:migrate",
  );
}

function down() {
  ensureDocker();

  const compose = run("docker", ["compose", "down"]);

  if (compose !== 0) {
    fail("Não foi possível derrubar a infraestrutura.");
  }

  console.log("[infra] Ambiente local parado.");
}

const command = process.argv[2];

if (command === "up") {
  up();
} else if (command === "down") {
  down();
} else {
  fail("Uso: node scripts/infra.mjs <up|down>");
}
