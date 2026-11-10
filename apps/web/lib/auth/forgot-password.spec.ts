import { describe, expect, it } from "vitest";

import {
  createInitialForgotPasswordState,
  FORGOT_PASSWORD_SUCCESS_MESSAGE,
  parseForgotPasswordResponse,
  readForgotPasswordValues,
} from "./forgot-password";

describe("createInitialForgotPasswordState", () => {
  it("deve começar vazio e sem erros", () => {
    expect(createInitialForgotPasswordState()).toEqual({
      status: "idle",
      message: "",
      fieldErrors: {},
      values: { email: "" },
    });
  });
});

describe("readForgotPasswordValues", () => {
  it("deve ler o e-mail do formulário", () => {
    const formData = new FormData();
    formData.set("email", "ada@example.com");

    expect(readForgotPasswordValues(formData)).toEqual({
      email: "ada@example.com",
    });
  });

  it("deve usar string vazia quando o campo está ausente", () => {
    expect(readForgotPasswordValues(new FormData())).toEqual({ email: "" });
  });
});

describe("parseForgotPasswordResponse", () => {
  const values = { email: "ada@example.com" };

  it("deve mapear 200 para sucesso com a mensagem genérica", () => {
    const state = parseForgotPasswordResponse(
      200,
      { message: FORGOT_PASSWORD_SUCCESS_MESSAGE },
      values,
    );

    expect(state).toEqual({
      status: "success",
      message: FORGOT_PASSWORD_SUCCESS_MESSAGE,
      fieldErrors: {},
      values,
    });
  });

  it("deve usar a mensagem genérica quando o 200 não traz corpo", () => {
    const state = parseForgotPasswordResponse(200, null, values);

    expect(state.status).toBe("success");
    expect(state.message).toBe(FORGOT_PASSWORD_SUCCESS_MESSAGE);
  });

  it("deve preservar fieldErrors do 400", () => {
    const state = parseForgotPasswordResponse(
      400,
      {
        code: "VALIDATION_ERROR",
        message: "Check the highlighted fields and try again.",
        fieldErrors: {
          email: "Enter a valid email address.",
          ignored: "Not a forgot-password field",
        },
      },
      values,
    );

    expect(state).toEqual({
      status: "error",
      message: "Check the highlighted fields and try again.",
      fieldErrors: { email: "Enter a valid email address." },
      values,
    });
  });

  it("deve mapear 429 para mensagem en-US específica", () => {
    const state = parseForgotPasswordResponse(429, {}, values);

    expect(state.status).toBe("error");
    expect(state.message).toBe(
      "Too many attempts. Wait a moment and try again.",
    );
  });

  it("deve usar mensagem genérica para status e payload desconhecidos", () => {
    const state = parseForgotPasswordResponse(500, "not-json", values);

    expect(state.status).toBe("error");
    expect(state.message).toBe("Something went wrong. Try again.");
    expect(state.fieldErrors).toEqual({});
  });
});
