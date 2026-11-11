/**
 * Teste de carga da API (NestJS) para gerar massa de dados na dashboard de
 * observabilidade. Perfis: smoke | load | stress | spike | soak (PROFILE=...).
 *
 * Cenários (cada um com sua fatia dos VUs do perfil):
 *  - public   55%  GET /hello e rota inexistente (404): caminho sem banco.
 *  - session  40%  sign-in -> /auth/me (x1..3) -> sign-out: scrypt + banco.
 *  - errors    5%  400/401/404 deliberados (validação, token ruim, credencial).
 *  - email     opt-in (INCLUDE_EMAIL_FLOWS=true): sign-up e forgot-password.
 *
 * Pré-requisitos: usuários semeados (load-tests/seed.mjs) e API com rate
 * limits elevados e Mailtrap neutralizado — veja load-tests/README.md.
 */
import { check, sleep } from "k6";
import exec from "k6/execution";

import {
  PASSWORD,
  USERS,
  call,
  expectStatus,
  peakVus,
  randomEmail,
  scaleStages,
  userForVu,
} from "./lib/common.js";

const PROFILE = __ENV.PROFILE || "smoke";
const INCLUDE_EMAIL_FLOWS = __ENV.INCLUDE_EMAIL_FLOWS === "true";

// Stages do perfil = total de VUs somando todos os cenários.
const PROFILES = {
  smoke: [
    { duration: "10s", target: 4 },
    { duration: "20s", target: 4 },
    { duration: "5s", target: 0 },
  ],
  load: [
    { duration: "2m", target: 60 },
    { duration: "5m", target: 60 },
    { duration: "1m", target: 0 },
  ],
  stress: [
    { duration: "2m", target: 50 },
    { duration: "2m", target: 100 },
    { duration: "2m", target: 150 },
    { duration: "2m", target: 200 },
    { duration: "1m", target: 0 },
  ],
  spike: [
    { duration: "30s", target: 10 },
    { duration: "20s", target: 200 },
    { duration: "1m", target: 200 },
    { duration: "20s", target: 10 },
    { duration: "1m", target: 10 },
    { duration: "10s", target: 0 },
  ],
  soak: [
    { duration: "2m", target: 30 },
    { duration: "26m", target: 30 },
    { duration: "2m", target: 0 },
  ],
};

const stages = PROFILES[PROFILE];

if (!stages) {
  throw new Error(
    `PROFILE inválido: ${PROFILE}. Use ${Object.keys(PROFILES).join(" | ")}.`,
  );
}

function ramping(fn, factor) {
  return {
    executor: "ramping-vus",
    exec: fn,
    startVUs: 0,
    stages: scaleStages(stages, factor),
    gracefulRampDown: "15s",
    gracefulStop: "15s",
  };
}

const scenarios = {
  public: ramping("publicTraffic", INCLUDE_EMAIL_FLOWS ? 0.5 : 0.55),
  session: ramping("sessionFlow", 0.4),
  errors: ramping("errorTraffic", 0.05),
};

if (INCLUDE_EMAIL_FLOWS) {
  scenarios.email = ramping("emailFlows", 0.05);
}

export const options = {
  scenarios,
  thresholds: {
    // 4xx/429 deliberados são "esperados" via responseCallback.
    http_req_failed: ["rate<0.01"],
    checks: ["rate>0.99"],
    "http_req_duration{endpoint:hello}": ["p(95)<300"],
    "http_req_duration{endpoint:me}": ["p(95)<500"],
    "http_req_duration{endpoint:sign-out}": ["p(95)<800"],
    // scrypt (N=2^15) + banco + e-mail: o endpoint mais caro da API.
    "http_req_duration{endpoint:sign-in}": ["p(95)<2000"],
  },
  summaryTrendStats: ["avg", "min", "med", "p(90)", "p(95)", "p(99)", "max"],
};

export function setup() {
  const peak = peakVus(stages);

  if (peak > USERS) {
    console.warn(
      `Pico de ${peak} VUs > ${USERS} usuários semeados: VUs vão dividir conta e ` +
        "revogar a sessão uns dos outros (falsos 401). Rode o seed com LOAD_USERS maior.",
    );
  }

  // Falha cedo e com mensagem clara se o seed não foi executado.
  const probe = call("POST", "/auth/sign-in", {
    body: { email: "loadtest-1@loadtest.invalid", password: PASSWORD },
    endpoint: "setup",
    expected: [200, 401, 429],
  });

  if (probe.status !== 200) {
    exec.test.abort(
      `Sign-in de sondagem retornou ${probe.status}. Rode o seed (node --env-file=.env load-tests/seed.mjs) ` +
        "e suba a API com rate limits elevados.",
    );
  }
}

export function publicTraffic() {
  const hello = call("GET", "/hello", { endpoint: "hello", expected: [200] });

  expectStatus(hello, 200, "hello");

  if (Math.random() < 0.1) {
    const missing = call("GET", "/does-not-exist", {
      endpoint: "not-found",
      expected: [404],
    });

    expectStatus(missing, 404, "not-found");
  }

  sleep(0.2 + Math.random() * 0.8);
}

export function sessionFlow() {
  const credentials = userForVu();
  const signIn = call("POST", "/auth/sign-in", {
    body: credentials,
    endpoint: "sign-in",
    expected: [200],
  });

  if (!expectStatus(signIn, 200, "sign-in")) {
    sleep(1);

    return;
  }

  const token = signIn.json("accessToken");
  const reads = 1 + Math.floor(Math.random() * 3);

  for (let i = 0; i < reads; i += 1) {
    const me = call("GET", "/auth/me", {
      token,
      endpoint: "me",
      expected: [200],
    });

    expectStatus(me, 200, "me");
    sleep(0.3 + Math.random() * 0.7);
  }

  const signOut = call("POST", "/auth/sign-out", {
    token,
    endpoint: "sign-out",
    expected: [204],
  });

  expectStatus(signOut, 204, "sign-out");

  // Token revogado deve parar de funcionar imediatamente.
  const revoked = call("GET", "/auth/me", {
    token,
    endpoint: "me-revoked",
    expected: [401],
  });

  expectStatus(revoked, 401, "me-after-sign-out");
  sleep(1 + Math.random() * 2);
}

export function errorTraffic() {
  const pick = Math.floor(Math.random() * 7);

  switch (pick) {
    case 0:
      expectStatus(
        call("POST", "/auth/sign-in", {
          body: { email: "", password: "" },
          endpoint: "sign-in-invalid",
          expected: [400],
        }),
        400,
        "sign-in malformed",
      );
      break;
    case 1:
      // E-mail inexistente: força o verify contra o hash "dummy".
      expectStatus(
        call("POST", "/auth/sign-in", {
          body: { email: randomEmail(), password: "wrong-password" },
          endpoint: "sign-in-unknown",
          expected: [401],
        }),
        401,
        "sign-in unknown user",
      );
      break;
    case 2:
      expectStatus(
        call("GET", "/auth/me", {
          endpoint: "me-anonymous",
          expected: [401],
        }),
        401,
        "me anonymous",
      );
      break;
    case 3:
      expectStatus(
        call("GET", "/auth/me", {
          token: "not-a-valid-jwt",
          endpoint: "me-bad-token",
          expected: [401],
        }),
        401,
        "me bad token",
      );
      break;
    case 4:
      // Validação falha antes de qualquer envio de e-mail.
      expectStatus(
        call("POST", "/auth/sign-up", {
          body: { firstName: "", email: "nope" },
          endpoint: "sign-up-invalid",
          expected: [400],
        }),
        400,
        "sign-up invalid",
      );
      break;
    case 5:
      expectStatus(
        call("POST", "/auth/confirm", {
          body: { token: `bogus-${Date.now()}-${Math.random()}` },
          endpoint: "confirm-bogus",
          expected: [400],
        }),
        400,
        "confirm bogus token",
      );
      break;
    default:
      expectStatus(
        call("POST", "/auth/reset-password", {
          body: {
            token: "bogus",
            password: "NewPassword#2026",
            passwordConfirmation: "NewPassword#2026",
          },
          endpoint: "reset-bogus",
          expected: [400],
        }),
        400,
        "reset bogus token",
      );
  }

  sleep(0.5 + Math.random());
}

/** Opt-in: dispara envio de e-mail. Só use com Mailtrap neutralizado/sandbox. */
export function emailFlows() {
  const email = randomEmail("loadtest-signup");
  const signUp = call("POST", "/auth/sign-up", {
    body: {
      firstName: "Load",
      lastName: "Signup",
      email,
      password: PASSWORD,
      passwordConfirmation: PASSWORD,
    },
    endpoint: "sign-up",
    // 503 = e-mail de confirmação falhou (Mailtrap neutralizado).
    expected: [200, 201, 503],
  });

  check(signUp, {
    "sign-up accepted (200/201/503)": (r) => [200, 201, 503].includes(r.status),
  });

  const forgot = call("POST", "/auth/forgot-password", {
    body: { email: userForVu().email },
    endpoint: "forgot-password",
    expected: [200],
  });

  expectStatus(forgot, 200, "forgot-password");
  sleep(2 + Math.random() * 3);
}
