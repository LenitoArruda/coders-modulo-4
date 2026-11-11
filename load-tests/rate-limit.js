/**
 * Verifica que os rate limiters respondem 429 + Retry-After e gera a massa de
 * dados de "429" na dashboard. Precisa dos limites PADRÃO da API (5/min;
 * confirm 10/min) — ou seja, suba a API SEM os overrides do teste de carga.
 *
 * Um único VU, sequencial: cada bloco envia (limite + 3) requisições com
 * chave nova e espera `limite` respostas "normais" seguidas de 429.
 */
import { check } from "k6";

import { PASSWORD, call, randomEmail } from "./lib/common.js";

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: { checks: ["rate==1"] },
};

function probe({ label, limit, request }) {
  const statuses = [];
  let retryAfter = null;

  for (let i = 0; i < limit + 3; i += 1) {
    const res = request();

    statuses.push(res.status);

    if (res.status === 429) {
      retryAfter = res.headers["Retry-After"];
    }
  }

  const allowed = statuses.slice(0, limit);
  const blocked = statuses.slice(limit);

  check(statuses, {
    [`${label}: primeiras ${limit} passam do limiter`]: () =>
      allowed.every((status) => status !== 429),
    [`${label}: excedentes recebem 429`]: () =>
      blocked.every((status) => status === 429),
    [`${label}: 429 traz Retry-After`]: () =>
      retryAfter !== null && Number(retryAfter) >= 1,
  });
}

export default function () {
  const email = randomEmail("loadtest-rl");

  probe({
    label: "sign-in",
    limit: 5,
    request: () =>
      call("POST", "/auth/sign-in", {
        body: { email, password: "wrong-password" },
        endpoint: "rl-sign-in",
        expected: [401, 429],
      }),
  });

  probe({
    label: "sign-up",
    limit: 5,
    request: () =>
      // Corpo inválido: consome o limiter mas nunca envia e-mail.
      call("POST", "/auth/sign-up", {
        body: { firstName: "", email: "nope", password: PASSWORD },
        endpoint: "rl-sign-up",
        expected: [400, 429],
      }),
  });

  probe({
    label: "reset-password",
    limit: 5,
    request: () =>
      call("POST", "/auth/reset-password", {
        body: { token: "bogus", password: "short" },
        endpoint: "rl-reset-password",
        expected: [400, 429],
      }),
  });

  probe({
    label: "confirm",
    limit: 10,
    request: () =>
      call("POST", "/auth/confirm", {
        body: { token: "bogus" },
        endpoint: "rl-confirm",
        expected: [400, 429],
      }),
  });
}
