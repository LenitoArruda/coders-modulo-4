import { describe, expect, it } from "vitest";

import {
  createInitialSignUpState,
  parseSignUpResponse,
  readSignUpValues,
  SIGN_UP_SUCCESS_MESSAGE,
  type SignUpFormValues,
} from "./sign-up";

const values: SignUpFormValues = {
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  password: "correct horse battery staple",
  passwordConfirmation: "correct horse battery staple",
};

describe("createInitialSignUpState", () => {
  it("deve começar vazio e sem erros", () => {
    expect(createInitialSignUpState()).toEqual({
      status: "idle",
      message: "",
      fieldErrors: {},
      values: {
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        passwordConfirmation: "",
      },
    });
  });
});

describe("readSignUpValues", () => {
  it("deve ler os cinco campos do formulário", () => {
    const formData = new FormData();

    for (const [key, value] of Object.entries(values)) {
      formData.set(key, value);
    }

    expect(readSignUpValues(formData)).toEqual(values);
  });

  it("deve usar string vazia para campos ausentes", () => {
    expect(readSignUpValues(new FormData())).toEqual({
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      passwordConfirmation: "",
    });
  });
});

describe("parseSignUpResponse", () => {
  it("deve mapear 201 para sucesso e limpar as senhas", () => {
    const state = parseSignUpResponse(
      201,
      {
        message: SIGN_UP_SUCCESS_MESSAGE,
        user: { id: "1", firstName: "Ada" },
      },
      values,
    );

    expect(state).toEqual({
      status: "success",
      message: SIGN_UP_SUCCESS_MESSAGE,
      fieldErrors: {},
      values: {
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@example.com",
        password: "",
        passwordConfirmation: "",
      },
    });
  });

  it("deve tratar 200 (reenvio) como sucesso", () => {
    const state = parseSignUpResponse(200, {}, values);

    expect(state.status).toBe("success");
    expect(state.message).toBe(SIGN_UP_SUCCESS_MESSAGE);
  });

  it("deve preservar fieldErrors de string do 400", () => {
    const state = parseSignUpResponse(
      400,
      {
        code: "VALIDATION_ERROR",
        message: "Check the highlighted fields and try again.",
        fieldErrors: {
          email: "Enter a valid email address.",
          password: "Password must be at least 8 characters.",
          ignored: "Not a sign-up field",
        },
      },
      values,
    );

    expect(state).toEqual({
      status: "error",
      message: "Check the highlighted fields and try again.",
      fieldErrors: {
        email: "Enter a valid email address.",
        password: "Password must be at least 8 characters.",
      },
      values,
    });
  });

  it("deve mapear 409, 429 e 503 para mensagens en-US específicas", () => {
    expect(parseSignUpResponse(409, {}, values).message).toBe(
      "An account with this email already exists. Sign in instead.",
    );
    expect(parseSignUpResponse(429, {}, values).message).toBe(
      "Too many attempts. Wait a moment and try again.",
    );
    expect(parseSignUpResponse(503, {}, values).message).toBe(
      "We could not send the confirmation email. Try again in a moment.",
    );
  });

  it("deve usar mensagem genérica para status e payload desconhecidos", () => {
    const state = parseSignUpResponse(500, "not-json", values);

    expect(state.status).toBe("error");
    expect(state.message).toBe("Something went wrong. Try again.");
    expect(state.fieldErrors).toEqual({});
  });
});
