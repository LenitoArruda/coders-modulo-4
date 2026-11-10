import { describe, expect, it } from "vitest";

import {
  RESET_PASSWORD_GENERIC_ERROR_MESSAGE,
  RESET_PASSWORD_INVALID_TOKEN_MESSAGE,
  RESET_PASSWORD_RATE_LIMITED_MESSAGE,
  RESET_PASSWORD_SUCCESS_MESSAGE,
  RESET_PASSWORD_VALIDATION_MESSAGE,
  createInitialResetPasswordState,
  createInvalidTokenState,
  parseResetPasswordResponse,
  readResetPasswordValues,
} from "./reset-password";

describe("createInitialResetPasswordState", () => {
  it("deve começar sem erros e sem token inválido", () => {
    expect(createInitialResetPasswordState()).toEqual({
      status: "idle",
      message: "",
      fieldErrors: {},
      invalidToken: false,
    });
  });
});

describe("createInvalidTokenState", () => {
  it("deve apontar link inválido sem nova tentativa", () => {
    expect(createInvalidTokenState()).toMatchObject({
      status: "error",
      message: RESET_PASSWORD_INVALID_TOKEN_MESSAGE,
      invalidToken: true,
    });
  });
});

describe("readResetPasswordValues", () => {
  it("deve aparar o token e preservar as senhas como digitadas", () => {
    const formData = new FormData();
    formData.set("token", "  abc  ");
    formData.set("password", " secret password ");
    formData.set("passwordConfirmation", " secret password ");

    expect(readResetPasswordValues(formData)).toEqual({
      token: "abc",
      password: " secret password ",
      passwordConfirmation: " secret password ",
    });
  });

  it("deve usar strings vazias quando os campos estão ausentes", () => {
    expect(readResetPasswordValues(new FormData())).toEqual({
      token: "",
      password: "",
      passwordConfirmation: "",
    });
  });
});

describe("parseResetPasswordResponse", () => {
  it("deve mapear 200 para sucesso", () => {
    expect(parseResetPasswordResponse(200, { message: "ignored" })).toEqual({
      status: "success",
      message: RESET_PASSWORD_SUCCESS_MESSAGE,
      fieldErrors: {},
      invalidToken: false,
    });
  });

  it("deve mapear INVALID_RESET_TOKEN para o estado de link inválido", () => {
    expect(
      parseResetPasswordResponse(400, {
        code: "INVALID_RESET_TOKEN",
        message: "server text",
      }),
    ).toEqual(createInvalidTokenState());
  });

  it("deve mapear VALIDATION_ERROR para erros por campo conhecidos", () => {
    const state = parseResetPasswordResponse(400, {
      code: "VALIDATION_ERROR",
      message: "server text",
      fieldErrors: {
        password: "Password must be at least 8 characters.",
        passwordConfirmation: "Passwords do not match.",
        token: "ignored",
      },
    });

    expect(state).toEqual({
      status: "error",
      message: RESET_PASSWORD_VALIDATION_MESSAGE,
      fieldErrors: {
        password: "Password must be at least 8 characters.",
        passwordConfirmation: "Passwords do not match.",
      },
      invalidToken: false,
    });
  });

  it("deve tolerar 400 sem corpo ou com fieldErrors malformado", () => {
    expect(parseResetPasswordResponse(400, null).fieldErrors).toEqual({});
    expect(
      parseResetPasswordResponse(400, { fieldErrors: "nope" }).fieldErrors,
    ).toEqual({});
    expect(
      parseResetPasswordResponse(400, { fieldErrors: { password: 1 } })
        .fieldErrors,
    ).toEqual({});
  });

  it("deve orientar a aguardar no 429", () => {
    expect(
      parseResetPasswordResponse(429, { code: "TOO_MANY_REQUESTS" }),
    ).toMatchObject({
      status: "error",
      message: RESET_PASSWORD_RATE_LIMITED_MESSAGE,
    });
  });

  it("deve usar mensagem genérica para 500 e status inesperados", () => {
    for (const status of [500, 503, 404]) {
      expect(parseResetPasswordResponse(status, null)).toMatchObject({
        status: "error",
        message: RESET_PASSWORD_GENERIC_ERROR_MESSAGE,
      });
    }
  });
});
