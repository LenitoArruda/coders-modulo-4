import { expect, test, type Page } from "@playwright/test";

import {
  E2E_CONFIRM_INVALID_TOKEN,
  E2E_CONFIRM_RATE_LIMITED_TOKEN,
  E2E_CONFIRM_TOKEN,
  E2E_CONFIRM_USED_TOKEN,
  E2E_VALID_SESSION_TOKEN,
} from "./support/fake-session";

const CONFIRM_PATH = "/auth/confirm";

const CONFIRM_INVALID_MESSAGE =
  "This confirmation link is invalid or has expired.";
const CONFIRM_ALREADY_CONFIRMED_MESSAGE =
  "This account is already confirmed. Sign in instead.";
const CONFIRM_RATE_LIMITED_MESSAGE =
  "Too many attempts. Wait a moment and try again.";

function confirmUrl(token: string): string {
  return `${CONFIRM_PATH}?token=${encodeURIComponent(token)}`;
}

async function setSessionCookie(page: Page, token: string): Promise<void> {
  await page.context().addCookies([
    {
      name: "session_token",
      value: token,
      url: "http://127.0.0.1:3000",
    },
  ]);
}

async function expectNoSessionCookie(page: Page): Promise<void> {
  const cookies = await page.context().cookies();

  expect(cookies.some((cookie) => cookie.name === "session_token")).toBe(false);
}

async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const hasHorizontalScroll = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );

  expect(hasHorizontalScroll).toBe(false);
}

test.describe("confirming a valid link", () => {
  test("confirma, grava o cookie, remove o token da URL e abre /app", async ({
    page,
  }) => {
    await page.goto(confirmUrl(E2E_CONFIRM_TOKEN));

    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Welcome, Ada",
    );

    expect(page.url()).not.toContain("token");

    const cookie = (await page.context().cookies()).find(
      (candidate) => candidate.name === "session_token",
    );

    expect(cookie).toBeDefined();
    expect(cookie?.value).toBe(E2E_VALID_SESSION_TOKEN);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("Lax");
    expect(cookie?.path).toBe("/");

    const hasSessionStorage = await page.evaluate(
      () =>
        window.localStorage.getItem("session_token") !== null ||
        window.sessionStorage.getItem("session_token") !== null,
    );

    expect(hasSessionStorage).toBe(false);
  });

  test("processa o token mesmo com sessão ativa e abre /app", async ({
    page,
  }) => {
    await setSessionCookie(page, E2E_VALID_SESSION_TOKEN);
    await page.goto(confirmUrl(E2E_CONFIRM_TOKEN));

    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Welcome, Ada",
    );
  });
});

test.describe("invalid, used and rate-limited links", () => {
  test("token inválido mostra erro acionável sem sessão", async ({ page }) => {
    await page.goto(confirmUrl(E2E_CONFIRM_INVALID_TOKEN));

    await expect(page.locator('form [role="alert"]')).toHaveText(
      CONFIRM_INVALID_MESSAGE,
    );
    await expect(
      page.getByRole("link", { name: "create an account" }),
    ).toHaveAttribute("href", "/auth/sign-up");
    await expect(
      page.getByRole("link", { name: "Sign in", exact: true }),
    ).toHaveAttribute("href", "/auth/sign-in");
    await expect(page.getByRole("button", { name: "Try again" })).toHaveCount(
      0,
    );
    await expectNoSessionCookie(page);
  });

  test("link já usado responde 409 e orienta o sign-in", async ({ page }) => {
    await page.goto(confirmUrl(E2E_CONFIRM_USED_TOKEN));

    await expect(page.locator('form [role="alert"]')).toHaveText(
      CONFIRM_ALREADY_CONFIRMED_MESSAGE,
    );
    await expect(page.getByRole("link", { name: "sign in" })).toBeVisible();
    await expectNoSessionCookie(page);
  });

  test("rate limit mostra a mensagem genérica e permite tentar novamente", async ({
    page,
  }) => {
    await page.goto(confirmUrl(E2E_CONFIRM_RATE_LIMITED_TOKEN));

    await expect(page.locator('form [role="alert"]')).toHaveText(
      CONFIRM_RATE_LIMITED_MESSAGE,
    );
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await expectNoSessionCookie(page);
  });

  test("link sem token e sem sessão é enviado para o sign-in", async ({
    page,
  }) => {
    await page.goto(CONFIRM_PATH);

    await expect(page).toHaveURL(/\/auth\/sign-in$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sign in");
    await expectNoSessionCookie(page);
  });

  test("pessoa autenticada sem token é enviada para /app", async ({ page }) => {
    await setSessionCookie(page, E2E_VALID_SESSION_TOKEN);
    await page.goto(CONFIRM_PATH);

    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Welcome, Ada",
    );
  });
});

test.describe("confirmation accessibility and responsiveness", () => {
  for (const width of [360, 768, 1280]) {
    test(`link inválido não tem rolagem horizontal em ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(confirmUrl(E2E_CONFIRM_INVALID_TOKEN));

      await expect(page.locator('form [role="alert"]')).toBeVisible();
      await expectNoHorizontalScroll(page);
    });
  }

  test("foco de teclado é visível no caminho de recuperação", async ({
    page,
  }) => {
    await page.goto(confirmUrl(E2E_CONFIRM_INVALID_TOKEN));

    const link = page.getByRole("link", { name: "Sign in", exact: true });
    await link.focus();

    const outlineWidth = await link.evaluate(
      (element) => window.getComputedStyle(element).outlineWidth,
    );

    expect(outlineWidth).not.toBe("0px");
  });

  test("UI é light-only e usa en-US", async ({ page }) => {
    await page.goto(confirmUrl(E2E_CONFIRM_INVALID_TOKEN));

    await expect(page.locator("html")).toHaveAttribute("lang", "en-US");

    const colorScheme = await page.evaluate(
      () => window.getComputedStyle(document.documentElement).colorScheme,
    );

    expect(colorScheme).toBe("light");
  });
});

test.describe("confirmation without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("botão de fallback confirma a conta e cria a sessão", async ({
    page,
  }) => {
    await page.goto(confirmUrl(E2E_CONFIRM_TOKEN));
    await page.getByRole("button", { name: "Confirm my email" }).click();

    await expect(page.getByText("Your email is confirmed.")).toBeVisible();

    await page.goto("/app");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Welcome, Ada",
    );
  });
});
