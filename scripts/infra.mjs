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

function supabaseIsRunning() {
  return run("bun", ["x", "supabase", "status"], { stdio: "ignore" }) === 0;
}

function up() {
  ensureDocker();

  if (!existsSync(composeFile)) {
    fail("docker-compose.yml não encontrado na raiz do repositório.");
  }

  const compose = run("docker", ["compose", "up", "-d", "--wait"]);

  if (compose !== 0) {
    fail(
      "Não foi possível subir o LGTM. Verifique se as portas 3010, 4317 e 4318 estão livres.",
    );
  }

  if (supabaseIsRunning()) {
    console.log("[infra] Supabase local já está em execução.");
  } else {
    const supabase = run("bun", ["x", "supabase", "start"]);

    if (supabase !== 0) {
      fail(
        "Não foi possível iniciar o Supabase local. Verifique as portas 54321-54324 e os logs acima.",
      );
    }
  }

  console.log("[infra] Ambiente local pronto:");
  console.log("  - Grafana:   http://localhost:3010");
  console.log("  - OTLP gRPC: localhost:4317");
  console.log("  - OTLP HTTP: localhost:4318");
  console.log("  - Supabase:  http://localhost:54321");
}

function down() {
  ensureDocker();

  if (supabaseIsRunning()) {
    run("bun", ["x", "supabase", "stop", "--no-backup"]);
  } else {
    console.log("[infra] Supabase local já está parado.");
  }

  const compose = run("docker", ["compose", "down"]);

  if (compose !== 0) {
    fail("Não foi possível derrubar o LGTM.");
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
