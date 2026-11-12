#!/usr/bin/env node
/**
 * Cria (ou remove) os usuários confirmados usados pelos testes de carga k6.
 *
 * Por que existe: a API tem política de sessão única (um sign-in revoga as
 * sessões anteriores do mesmo usuário), então cada VU do k6 precisa de uma
 * conta própria. Criar via POST /auth/sign-up exigiria e-mail real.
 *
 * Uso (a partir da raiz do repo):
 *   node --env-file=.env load-tests/seed.mjs            # recria N usuários
 *   node --env-file=.env load-tests/seed.mjs --clean    # só remove
 *
 * Variáveis opcionais: LOAD_USERS (padrão 300), LOAD_PASSWORD.
 * Todos os e-mails seguem `loadtest-<n>@loadtest.invalid`; o `--clean` apaga
 * apenas esse padrão (inclusive contas criadas pelo cenário de sign-up).
 * O seed só roda contra um PostgreSQL local (loopback), nunca remoto.
 */
import { randomBytes, scrypt } from "node:crypto";

import pg from "pg";

const USERS = Number(process.env.LOAD_USERS ?? 300);
const PASSWORD = process.env.LOAD_PASSWORD ?? "LoadTest#2026";
const EMAIL_DOMAIN = "loadtest.invalid";
const BATCH_SIZE = 100;
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

// Mesmos parâmetros de scrypt-password-hasher.adapter.ts: N=2^15, r=8, p=1.
const LOG_N = 15;
const HASH_PREFIX = `$scrypt$ln=${LOG_N},r=8,p=1$`;

function fail(message) {
  console.error(message);
  process.exit(1);
}

const DATABASE_URL = process.env.DATABASE_URL?.trim();

if (!DATABASE_URL) {
  fail(
    "DATABASE_URL ausente. Rode com: node --env-file=.env load-tests/seed.mjs",
  );
}

let databaseHost;

try {
  databaseHost = new URL(DATABASE_URL).hostname;
} catch {
  fail("DATABASE_URL inválida: informe uma URL postgres:// ou postgresql://.");
}

if (!LOCAL_HOSTS.has(databaseHost)) {
  fail(
    `Recusando rodar contra ${databaseHost}: o seed só é permitido em PostgreSQL local.`,
  );
}

function hashPassword(password) {
  const salt = randomBytes(16);

  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      32,
      { N: 2 ** LOG_N, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (error, key) => {
        if (error) {
          reject(error);

          return;
        }

        resolve(
          `${HASH_PREFIX}${salt.toString("base64url")}$${key.toString("base64url")}`,
        );
      },
    );
  });
}

async function clean(client) {
  // sessions e auth_tokens saem junto (on delete cascade).
  const result = await client.query(
    "delete from public.users where email like $1",
    [`loadtest-%@${EMAIL_DOMAIN}`],
  );

  console.log(`Removidos ${result.rowCount ?? 0} usuários de carga.`);
}

async function seed(client) {
  const passwordHash = await hashPassword(PASSWORD);
  const rows = Array.from({ length: USERS }, (_, index) => [
    "Load",
    `Test ${index + 1}`,
    `loadtest-${index + 1}@${EMAIL_DOMAIN}`,
    passwordHash,
    new Date(),
  ]);

  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    const batch = rows.slice(start, start + BATCH_SIZE);
    const values = batch
      .map(
        (_, index) =>
          `($${index * 5 + 1}, $${index * 5 + 2}, $${index * 5 + 3}, $${index * 5 + 4}, $${index * 5 + 5})`,
      )
      .join(", ");

    await client.query(
      `insert into public.users
         (first_name, last_name, email, password_hash, email_confirmed_at)
       values ${values}`,
      batch.flat(),
    );
  }

  console.log(
    `Criados ${USERS} usuários confirmados: loadtest-1..${USERS}@${EMAIL_DOMAIN}`,
  );
}

const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 1 });
const client = await pool.connect();

try {
  await clean(client);

  if (!process.argv.includes("--clean")) {
    await seed(client);
  }
} finally {
  client.release();
  await pool.end();
}
