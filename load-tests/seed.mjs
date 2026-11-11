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
 */
import { randomBytes, scrypt } from "node:crypto";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const USERS = Number(process.env.LOAD_USERS ?? 300);
const PASSWORD = process.env.LOAD_PASSWORD ?? "LoadTest#2026";
const EMAIL_DOMAIN = "loadtest.invalid";
const BATCH_SIZE = 100;

// Mesmos parâmetros de scrypt-password-hasher.adapter.ts: N=2^15, r=8, p=1.
const LOG_N = 15;
const HASH_PREFIX = `$scrypt$ln=${LOG_N},r=8,p=1$`;

if (!SERVICE_KEY) {
  console.error(
    "SUPABASE_SERVICE_ROLE_KEY ausente. Rode com: node --env-file=.env load-tests/seed.mjs",
  );
  process.exit(1);
}

if (
  !SUPABASE_URL.includes("127.0.0.1") &&
  !SUPABASE_URL.includes("localhost")
) {
  console.error(
    `Recusando rodar contra ${SUPABASE_URL}: o seed só é permitido no Supabase local.`,
  );
  process.exit(1);
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

async function rest(path, init = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      authorization: `Bearer ${SERVICE_KEY}`,
      "content-type": "application/json",
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw new Error(
      `${init.method ?? "GET"} ${path} -> ${response.status} ${await response.text()}`,
    );
  }

  return response;
}

async function clean() {
  // sessions e auth_tokens saem junto (on delete cascade).
  const response = await rest(
    `users?email=like.${encodeURIComponent(`loadtest-%@${EMAIL_DOMAIN}`)}`,
    { method: "DELETE", headers: { prefer: "return=representation" } },
  );
  const removed = await response.json();

  console.log(`Removidos ${removed.length} usuários de carga.`);
}

async function seed() {
  const passwordHash = await hashPassword(PASSWORD);
  const confirmedAt = new Date().toISOString();
  const rows = Array.from({ length: USERS }, (_, index) => ({
    first_name: "Load",
    last_name: `Test ${index + 1}`,
    email: `loadtest-${index + 1}@${EMAIL_DOMAIN}`,
    password_hash: passwordHash,
    email_confirmed_at: confirmedAt,
  }));

  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    await rest("users", {
      method: "POST",
      body: JSON.stringify(rows.slice(start, start + BATCH_SIZE)),
    });
  }

  console.log(
    `Criados ${USERS} usuários confirmados: loadtest-1..${USERS}@${EMAIL_DOMAIN}`,
  );
}

await clean();

if (!process.argv.includes("--clean")) {
  await seed();
}
