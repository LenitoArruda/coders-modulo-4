import { describe, expect, it } from "vitest";

import {
  APP_HOME_PATH,
  AUTH_CONFIRM_PATH,
  AUTH_FORGOT_PASSWORD_PATH,
  AUTH_RESET_PASSWORD_PATH,
  AUTH_SIGN_IN_PATH,
  AUTH_SIGN_UP_PATH,
  SIGNED_OUT_REDIRECT_PATH,
  buildSignInPath,
  getPrivateAreaRedirectPath,
  getRootRedirectPath,
  sanitizeReturnTo,
  shouldRedirectFromAuthPath,
} from "./route-rules";

describe("getRootRedirectPath", () => {
  it("deve enviar para /app quando há sessão", () => {
    expect(getRootRedirectPath(true)).toBe(APP_HOME_PATH);
    expect(getRootRedirectPath(true)).toBe("/app");
  });

  it("deve enviar para /auth/sign-in quando não há sessão", () => {
    expect(getRootRedirectPath(false)).toBe(SIGNED_OUT_REDIRECT_PATH);
    expect(getRootRedirectPath(false)).toBe("/auth/sign-in");
  });
});

describe("getPrivateAreaRedirectPath", () => {
  it("deve liberar /app quando há sessão", () => {
    expect(getPrivateAreaRedirectPath(true)).toBeNull();
  });

  it("deve bloquear /app sem sessão enviando para /auth/sign-in", () => {
    expect(getPrivateAreaRedirectPath(false)).toBe("/auth/sign-in");
  });

  it("deve incluir returnTo seguro no redirect e ignorar o inseguro", () => {
    expect(getPrivateAreaRedirectPath(false, "/app/settings")).toBe(
      "/auth/sign-in?returnTo=%2Fapp%2Fsettings",
    );
    expect(getPrivateAreaRedirectPath(false, "https://evil.example")).toBe(
      "/auth/sign-in",
    );
    expect(getPrivateAreaRedirectPath(true, "/app/settings")).toBeNull();
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

describe("sanitizeReturnTo", () => {
  it.each([
    ["/app", "/app"],
    ["/app/", "/app/"],
    ["/app/settings", "/app/settings"],
    ["/app/settings/profile", "/app/settings/profile"],
    ["/app/settings?tab=billing", "/app/settings?tab=billing"],
    ["/app?x=1", "/app?x=1"],
    ["/app/settings#frag", "/app/settings"],
    ["/app/./settings", "/app/settings"],
  ])("deve aceitar %s", (input, expected) => {
    expect(sanitizeReturnTo(input)).toBe(expected);
  });

  it.each([
    ["ausente", undefined],
    ["nulo", null],
    ["número", 42],
    ["array", ["/app/x"]],
    ["vazio", ""],
    ["raiz", "/"],
    ["outra rota interna", "/auth/sign-up"],
    ["prefixo parecido", "/application"],
    ["prefixo parecido com barra", "/appx/settings"],
    ["URL absoluta", "https://evil.example/app/x"],
    ["URL absoluta http", "http://evil.example"],
    ["protocol-relative", "//evil.example"],
    ["protocol-relative sob /app", "/app//evil.example"],
    ["barra invertida", "/app\\evil.example"],
    ["barra invertida inicial", "\\evil.example"],
    ["barra invertida codificada", "/app/%5Cevil.example"],
    ["barras duplas codificadas", "/app/%2F%2Fevil.example"],
    ["duplamente codificado", "/app/%252F%252Fevil.example"],
    ["javascript", "javascript:alert(1)"],
    ["data URL", "data:text/html,<script>1</script>"],
    ["traversal", "/app/../auth/sign-in"],
    ["traversal codificado", "/app/%2e%2e/auth/sign-in"],
    ["traversal duplamente codificado", "/app/%252e%252e/x"],
    ["caractere de controle", "/app/x\ny"],
    ["tabulação", "/app/\tevil"],
    ["NUL", "/app/\u0000"],
    ["codificação inválida", "/app/%E0%A4%A"],
    ["muito longo", `/app/${"a".repeat(3000)}`],
    ["espaço antes", " /app/x"],
  ])("deve cair em /app para %s", (_label, input) => {
    expect(sanitizeReturnTo(input)).toBe("/app");
  });
});

describe("buildSignInPath", () => {
  it("deve devolver o sign-in puro sem returnTo útil", () => {
    expect(buildSignInPath()).toBe("/auth/sign-in");
    expect(buildSignInPath("/app")).toBe("/auth/sign-in");
    expect(buildSignInPath("//evil.example")).toBe("/auth/sign-in");
  });

  it("deve codificar o returnTo seguro como query", () => {
    expect(buildSignInPath("/app/settings?tab=billing")).toBe(
      "/auth/sign-in?returnTo=%2Fapp%2Fsettings%3Ftab%3Dbilling",
    );
  });
});
