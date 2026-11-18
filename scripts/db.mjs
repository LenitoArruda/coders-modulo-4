#!/usr/bin/env node
/**
 * Executor de migrações e testes de schema do PostgreSQL nativo.
 *
 * Uso (a partir da raiz do repo):
 *   node --env-file=.env scripts/db.mjs migrate
 *   node --env-file=.env scripts/db.mjs test
 *
 * As migrações ficam em db/migrations/NNNN_slug.sql e são aplicadas em ordem,
 * cada uma em uma transação, com registro em public.schema_migrations. Um
 * advisory lock impede que duas execuções concorrentes apliquem a mesma
 * migração.
 *
 * Os testes ficam em db/tests/NNNN_slug.test.sql e rodam em uma transação com
 * rollback por arquivo, contra o banco configurado em DATABASE_URL.
 */
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const migrationsDir = join(root, "db", "migrations");
const testsDir = join(root, "db", "tests");
const LOCK_KEY = 809_202_611;
const DATABASE_URL = process.env.DATABASE_URL?.trim();

function fail(message) {
  console.error(`\n[db] ${message}\n`);
  process.exit(1);
}

function parseDatabaseUrl(value) {
  if (!value) {
    fail(
      "DATABASE_URL ausente. Rode com: node --env-file=.env scripts/db.mjs <migrate|test>",
    );
  }

  let url;

  try {
    url = new URL(value);
  } catch {
    fail(
      "DATABASE_URL inválida: informe uma URL postgres:// ou postgresql://.",
    );
  }

  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    fail(
      "DATABASE_URL inválida: o esquema deve ser postgres:// ou postgresql://.",
    );
  }

  return value;
}

async function listSqlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort();
}

async function migrate(client) {
  await client.query("select pg_advisory_lock($1)", [LOCK_KEY]);

  try {
    await client.query(`
      create table if not exists public.schema_migrations (
        version text primary key,
        applied_at timestamptz not null default now()
      )
    `);

    const applied = new Set(
      (
        await client.query("select version from public.schema_migrations")
      ).rows.map((row) => row.version),
    );
    const files = await listSqlFiles(migrationsDir);
    let count = 0;

    for (const file of files) {
      if (applied.has(file)) {
        continue;
      }

      const sql = await readFile(join(migrationsDir, file), "utf8");

      await client.query("begin");

      try {
        await client.query(sql);
        await client.query(
          "insert into public.schema_migrations (version) values ($1)",
          [file],
        );
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw new Error(`${file}: ${error.message}`, { cause: error });
      }

      console.log(`[db] aplicada: ${file}`);
      count += 1;
    }

    console.log(
      count === 0
        ? "[db] nenhuma migração pendente."
        : `[db] ${count} migração(ões) aplicada(s).`,
    );
  } finally {
    await client.query("select pg_advisory_unlock($1)", [LOCK_KEY]);
  }
}

async function runTests(client) {
  const files = await listSqlFiles(testsDir);
  let passed = 0;

  for (const file of files) {
    const sql = await readFile(join(testsDir, file), "utf8");

    await client.query("begin");

    try {
      await client.query(sql);
      await client.query("rollback");
    } catch (error) {
      await client.query("rollback");
      throw new Error(`${file}: ${error.message}`, { cause: error });
    }

    console.log(`[db] ok: ${file}`);
    passed += 1;
  }

  console.log(`[db] ${passed} arquivo(s) de teste passaram.`);
}

async function main() {
  const command = process.argv[2];

  if (command !== "migrate" && command !== "test") {
    fail("Uso: node scripts/db.mjs <migrate|test>");
  }

  const connectionString = parseDatabaseUrl(DATABASE_URL);
  const pool = new pg.Pool({ connectionString, max: 1 });
  const client = await pool.connect();

  try {
    if (command === "migrate") {
      await migrate(client);
    } else {
      await runTests(client);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`\n[db] falha: ${error.message}\n`);
  process.exit(1);
});
