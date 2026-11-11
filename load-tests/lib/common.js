import http from "k6/http";
import { check } from "k6";
import exec from "k6/execution";

export const BASE_URL = (
  __ENV.BASE_URL || "http://localhost:3333/api/v1"
).replace(/\/$/, "");

// Deve bater com load-tests/seed.mjs.
export const USERS = Number(__ENV.LOAD_USERS || 300);
export const PASSWORD = __ENV.LOAD_PASSWORD || "LoadTest#2026";
const EMAIL_DOMAIN = "loadtest.invalid";

const JSON_HEADERS = { "Content-Type": "application/json" };

/** Usuário semeado exclusivo deste VU (sessão única => 1 conta por VU). */
export function userForVu() {
  const index = ((exec.vu.idInTest - 1) % USERS) + 1;

  return { email: `loadtest-${index}@${EMAIL_DOMAIN}`, password: PASSWORD };
}

/** E-mail único e descartável (nunca existe no banco). */
export function randomEmail(prefix = "loadtest-rnd") {
  return `${prefix}-${exec.vu.idInTest}-${Date.now()}-${Math.floor(
    Math.random() * 1e9,
  )}@${EMAIL_DOMAIN}`;
}

/**
 * Faz a requisição declarando quais status são *esperados* para o endpoint.
 * Assim 400/401/429 deliberados não inflam `http_req_failed`.
 */
export function call(method, path, { body, token, endpoint, expected }) {
  const headers = { ...JSON_HEADERS };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return http.request(
    method,
    `${BASE_URL}${path}`,
    body === undefined ? null : JSON.stringify(body),
    {
      headers,
      tags: { endpoint },
      responseCallback: http.expectedStatuses(...expected),
    },
  );
}

export function expectStatus(res, status, label) {
  return check(res, { [`${label} -> ${status}`]: (r) => r.status === status });
}

/** Multiplica os alvos de um perfil de stages (mínimo 1 VU). */
export function scaleStages(stages, factor) {
  return stages.map(({ duration, target }) => ({
    duration,
    target: target === 0 ? 0 : Math.max(1, Math.round(target * factor)),
  }));
}

export function peakVus(stages) {
  return Math.max(...stages.map((stage) => stage.target));
}
