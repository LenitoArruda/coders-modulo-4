import { describe, expect, it } from "vitest";

import {
  APP_HOME_PATH,
  AUTH_CONFIRM_PATH,
  AUTH_FORGOT_PASSWORD_PATH,
  AUTH_RESET_PASSWORD_PATH,
  AUTH_SIGN_IN_PATH,
  AUTH_SIGN_UP_PATH,
  SIGNED_OUT_REDIRECT_PATH,
  getPrivateAreaRedirectPath,
  getRootRedirectPath,
  shouldRedirectFromAuthPath,
} from "./route-rules";

describe("getRootRedirectPath", () => {
  it("deve enviar para /app quando há sessão", () => {
    expect(getRootRedirectPath(true)).toBe(APP_HOME_PATH);
    expect(getRootRedirectPath(true)).toBe("/app");
  });

  it("deve enviar para /auth/sign-up quando não há sessão", () => {
    expect(getRootRedirectPath(false)).toBe(SIGNED_OUT_REDIRECT_PATH);
    expect(getRootRedirectPath(false)).toBe("/auth/sign-up");
  });
});

describe("getPrivateAreaRedirectPath", () => {
  it("deve liberar /app quando há sessão", () => {
    expect(getPrivateAreaRedirectPath(true)).toBeNull();
  });

  it("deve bloquear /app sem sessão enviando para /auth/sign-up nesta fatia", () => {
    expect(getPrivateAreaRedirectPath(false)).toBe("/auth/sign-up");
  });
});

describe("shouldRedirectFromAuthPath", () => {
  it("deve redirecionar sign-up e sign-in com sessão", () => {
    expect(shouldRedirectFromAuthPath(AUTH_SIGN_UP_PATH, true)).toBe(true);
    expect(shouldRedirectFromAuthPath(AUTH_SIGN_IN_PATH, true)).toBe(true);
  });

  it("não deve redirecionar confirm porque a página decide pelo token", () => {
    expect(shouldRedirectFromAuthPath(AUTH_CONFIRM_PATH, true)).toBe(false);
  });

  it("deve manter forgot e reset acessíveis com sessão", () => {
    expect(shouldRedirectFromAuthPath(AUTH_FORGOT_PASSWORD_PATH, true)).toBe(
      false,
    );
    expect(shouldRedirectFromAuthPath(AUTH_RESET_PASSWORD_PATH, true)).toBe(
      false,
    );
  });

  it("não deve redirecionar nenhuma página de auth sem sessão", () => {
    expect(shouldRedirectFromAuthPath(AUTH_SIGN_UP_PATH, false)).toBe(false);
    expect(shouldRedirectFromAuthPath(AUTH_SIGN_IN_PATH, false)).toBe(false);
    expect(shouldRedirectFromAuthPath(AUTH_CONFIRM_PATH, false)).toBe(false);
  });

  it("deve normalizar barra final antes de comparar", () => {
    expect(shouldRedirectFromAuthPath(`${AUTH_SIGN_IN_PATH}/`, true)).toBe(
      true,
    );
    expect(
      shouldRedirectFromAuthPath(`${AUTH_FORGOT_PASSWORD_PATH}/`, true),
    ).toBe(false);
  });

  it("não deve redirecionar rotas de auth desconhecidas", () => {
    expect(shouldRedirectFromAuthPath("/auth/unknown", true)).toBe(false);
  });
});
