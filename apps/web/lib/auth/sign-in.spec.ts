import { describe, expect, it } from "vitest";

import {
  SIGN_IN_EMAIL_NOT_CONFIRMED_MESSAGE,
  SIGN_IN_GENERIC_ERROR_MESSAGE,
  SIGN_IN_INVALID_CREDENTIALS_MESSAGE,
  SIGN_IN_RATE_LIMITED_MESSAGE,
  SIGN_IN_VALIDATION_MESSAGE,
  createInitialSignInState,
  parseSignInResponse,
  readSignInCredentials,
  validateSignInCredentials,
} from "./sign-in";

describe("readSignInCredentials", () => {
  it("deve aparar o e-mail e preservar a senha", () => {
    const formData = new FormData();

    formData.set("email", "  ada@example.com ");
    formData.set("password", " secret ");

    expect(readSignInCredentials(formData)).toEqual({
      email: "ada@example.com",
      password: " secret ",
    });
  });

  it("deve tratar campos ausentes como vazios", () => {
    expect(readSignInCredentials(new FormData())).toEqual({
      email: "",
      password: "",
    });
  });
});

describe("validateSignInCredentials", () => {
  it("deve exigir e-mail e senha", () => {
    expect(validateSignInCredentials({ email: "", password: "" })).toEqual({
      email: "Enter your email address.",
      password: "Enter your password.",
    });
  });

  it("não deve reportar erros quando ambos existem", () => {
    expect(
      validateSignInCredentials({ email: "a@b.co", password: "x" }),
    ).toEqual({});
  });
});

describe("parseSignInResponse", () => {
  it("deve aceitar sucesso com token e expiresIn válidos", () => {
    expect(
      parseSignInResponse(200, { accessToken: "jwt", expiresIn: 3600 }),
    ).toEqual({ status: "success", accessToken: "jwt", expiresIn: 3600 });
  });

  it.each([
    ["sem token", { expiresIn: 3600 }],
    ["token vazio", { accessToken: "", expiresIn: 3600 }],
    ["sem expiresIn", { accessToken: "jwt" }],
    ["expiresIn inválido", { accessToken: "jwt", expiresIn: 0 }],
    ["corpo nulo", null],
  ])("deve tratar sucesso malformado (%s) como erro genérico", (_l, body) => {
    expect(parseSignInResponse(200, body)).toEqual({
      status: "error",
      message: SIGN_IN_GENERIC_ERROR_MESSAGE,
    });
  });

  it("deve usar textos fixos por status, ignorando o texto do servidor", () => {
    expect(parseSignInResponse(401, { message: "ada not found" })).toEqual({
      status: "error",
      message: SIGN_IN_INVALID_CREDENTIALS_MESSAGE,
    });
    expect(parseSignInResponse(400, {})).toEqual({
      status: "error",
      message: SIGN_IN_VALIDATION_MESSAGE,
    });
    expect(parseSignInResponse(403, null)).toEqual({
      status: "error",
      message: SIGN_IN_EMAIL_NOT_CONFIRMED_MESSAGE,
    });
    expect(parseSignInResponse(429, {})).toEqual({
      status: "error",
      message: SIGN_IN_RATE_LIMITED_MESSAGE,
    });
    expect(parseSignInResponse(500, {})).toEqual({
      status: "error",
      message: SIGN_IN_GENERIC_ERROR_MESSAGE,
    });
  });
});

describe("createInitialSignInState", () => {
  it("deve começar ocioso, sem erros e sem senha", () => {
    expect(createInitialSignInState()).toEqual({
      status: "idle",
      message: "",
      fieldErrors: {},
      values: { email: "" },
    });
  });
});
