import { describe, expect, it } from "vitest";

import {
  CONFIRM_ALREADY_CONFIRMED_MESSAGE,
  CONFIRM_GENERIC_ERROR_MESSAGE,
  CONFIRM_INVALID_MESSAGE,
  CONFIRM_RATE_LIMITED_MESSAGE,
  CONFIRM_TOKEN_FIELD,
  createInitialConfirmState,
  parseConfirmResponse,
  readConfirmToken,
} from "./confirm";

describe("createInitialConfirmState", () => {
  it("deve começar idle", () => {
    expect(createInitialConfirmState()).toEqual({ status: "idle" });
  });
});

describe("readConfirmToken", () => {
  it("deve ler e normalizar o token do formulário", () => {
    const formData = new FormData();
    formData.set(CONFIRM_TOKEN_FIELD, "  opaque-token  ");

    expect(readConfirmToken(formData)).toBe("opaque-token");
  });

  it("deve devolver string vazia quando o token está ausente", () => {
    expect(readConfirmToken(new FormData())).toBe("");
  });

  it("deve ignorar valores que não são texto", () => {
    const formData = new FormData();
    formData.set(CONFIRM_TOKEN_FIELD, new Blob(["token"]));

    expect(readConfirmToken(formData)).toBe("");
  });
});

describe("parseConfirmResponse", () => {
  it("deve extrair o JWT e o expiresIn de um 200 válido", () => {
    expect(
      parseConfirmResponse(200, {
        accessToken: "header.payload.signature",
        tokenType: "Bearer",
        expiresIn: 604_800,
        user: { id: "1", firstName: "Ada" },
      }),
    ).toEqual({
      status: "success",
      accessToken: "header.payload.signature",
      expiresIn: 604_800,
    });
  });

  it("deve recusar 200 sem JWT ou com expiresIn inválido", () => {
    expect(parseConfirmResponse(200, { expiresIn: 604_800 })).toEqual({
      status: "error",
      message: CONFIRM_GENERIC_ERROR_MESSAGE,
      canRetry: true,
    });
    expect(
      parseConfirmResponse(200, { accessToken: "", expiresIn: 604_800 }),
    ).toEqual({
      status: "error",
      message: CONFIRM_GENERIC_ERROR_MESSAGE,
      canRetry: true,
    });
    expect(
      parseConfirmResponse(200, { accessToken: "jwt", expiresIn: 0 }),
    ).toEqual({
      status: "error",
      message: CONFIRM_GENERIC_ERROR_MESSAGE,
      canRetry: true,
    });
    expect(
      parseConfirmResponse(200, { accessToken: "jwt", expiresIn: "604800" }),
    ).toEqual({
      status: "error",
      message: CONFIRM_GENERIC_ERROR_MESSAGE,
      canRetry: true,
    });
  });

  it("deve mapear 400, 409 e 429 para mensagens en-US e ação", () => {
    expect(parseConfirmResponse(400, {})).toEqual({
      status: "error",
      message: CONFIRM_INVALID_MESSAGE,
      canRetry: false,
    });
    expect(parseConfirmResponse(409, {})).toEqual({
      status: "error",
      message: CONFIRM_ALREADY_CONFIRMED_MESSAGE,
      canRetry: false,
    });
    expect(parseConfirmResponse(429, {})).toEqual({
      status: "error",
      message: CONFIRM_RATE_LIMITED_MESSAGE,
      canRetry: true,
    });
  });

  it("deve preservar mensagens do contrato da API", () => {
    expect(
      parseConfirmResponse(400, {
        code: "INVALID_CONFIRMATION_TOKEN",
        message: CONFIRM_INVALID_MESSAGE,
      }),
    ).toEqual({
      status: "error",
      message: CONFIRM_INVALID_MESSAGE,
      canRetry: false,
    });
  });

  it("deve usar mensagem genérica para status e payload desconhecidos", () => {
    expect(parseConfirmResponse(500, "not-json")).toEqual({
      status: "error",
      message: CONFIRM_GENERIC_ERROR_MESSAGE,
      canRetry: true,
    });
    expect(parseConfirmResponse(418, {})).toEqual({
      status: "error",
      message: CONFIRM_GENERIC_ERROR_MESSAGE,
      canRetry: false,
    });
  });
});
