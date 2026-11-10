import { expect, test, type Page } from "@playwright/test";

import {
  E2E_RESET_RATE_LIMITED_TOKEN,
  E2E_SIGN_IN_DOMAIN,
  E2E_SIGN_IN_PASSWORD,
  e2eResetToken,
} from "./support/fake-session";

const RESET_PATH = "/auth/reset-password";
const SIGN_IN_PATH = "/auth/sign-in";
const BASE_URL = "http://127.0.0.1:3000";

const NEW_PASSWORD = "brand new password 123";
const INVALID_LINK_MESSAGE =
  "This password reset link is invalid or has expired.";
const SUCCESS_MESSAGE =
  "Your password has been updated. Sign in with your new password.";

/** Each test owns an account so parallel tests never touch each other. */
function uniqueLocal(label: string): string {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  return `${label}-${suffix}`;
}

function uniqueToken(local: string): string {
  return e2eResetToken(local, Math.random().toString(36).slice(2, 10));
}

function resetUrl(token: string): string {
  return `${RESET_PATH}?token=${encodeURIComponent(token)}`;
}

function newPasswordInput(page: Page) {
  return page.locator("#reset-password-password");
}

function confirmationInput(page: Page) {
  return page.locator("#reset-password-confirmation");
}

function formAlert(page: Page) {
  return page.locator('form [role="alert"]');
}

async function fillAndSubmit(
  page: Page,
  password: string,
  confirmation: string = password,
): Promise<void> {
  await newPasswordInput(page).fill(password);
  await confirmationInput(page).fill(confirmation);
  await page.getByRole("button", { name: "Update password" }).click();
}

async function signInWith(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.getByLabel(/^Email/).fill(email);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const hasHorizontalScroll = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );

  expect(hasHorizontalScroll).toBe(false);
}

test.describe("completing a reset", () => {
  test("troca a senha, mostra a confirmação, vai ao sign-in e entra com a nova senha", async ({
    page,
  }) => {
    const local = uniqueLocal("reset-flow");
    const email = `${local}@${E2E_SIGN_IN_DOMAIN}`;
    const token = uniqueToken(local);

    await page.goto(resetUrl(token));
    await fillAndSubmit(page, NEW_PASSWORD);

    await expect(page).toHaveURL(`${BASE_URL}${SIGN_IN_PATH}?reset=success`);
    await expect(page.getByRole("status")).toContainText(SUCCESS_MESSAGE);

    await signInWith(page, email, E2E_SIGN_IN_PASSWORD);
    await expect(page.locator('form [role="alert"]')).toHaveText(
      "Invalid email or password.",
    );

    await signInWith(page, email, NEW_PASSWORD);
    await expect(page).toHaveURL(`${BASE_URL}/app`);
  });

  test("remove o token da URL assim que a página carrega e ainda envia o formulário", async ({
    page,
  }) => {
    const local = uniqueLocal("reset-url");
    const token = uniqueToken(local);

    await page.goto(resetUrl(token));

    await expect(page).toHaveURL(`${BASE_URL}${RESET_PATH}`);
    expect(page.url()).not.toContain(token);
    expect(page.url()).not.toContain("token");

    await fillAndSubmit(page, NEW_PASSWORD);
    await expect(page).toHaveURL(`${BASE_URL}${SIGN_IN_PATH}?reset=success`);
  });

  test("responde com Referrer-Policy no-referrer e não carrega recursos externos", async ({
    page,
  }) => {
    const requested: string[] = [];

    page.on("request", (request) => requested.push(request.url()));

    const response = await page.goto(resetUrl(uniqueToken("reset-referrer")));

    expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
    await expect(page.locator("#reset-password-password")).toBeVisible();

    const external = requested.filter(
      (url) =>
        !url.startsWith(BASE_URL) &&
        !url.startsWith("data:") &&
        !url.startsWith("blob:"),
    );

    expect(external).toEqual([]);
  });

  test("invalida a sessão antiga, pois o reset revoga todas as sessões", async ({
    page,
  }) => {
    const local = uniqueLocal("reset-session");
    const email = `${local}@${E2E_SIGN_IN_DOMAIN}`;

    await page.goto(SIGN_IN_PATH);
    await signInWith(page, email, E2E_SIGN_IN_PASSWORD);
    await expect(page).toHaveURL(`${BASE_URL}/app`);

    // The reset page stays reachable with an active session.
    await page.goto(resetUrl(uniqueToken(local)));
    await expect(newPasswordInput(page)).toBeVisible();
    await fillAndSubmit(page, NEW_PASSWORD);
    await expect(page).toHaveURL(`${BASE_URL}${SIGN_IN_PATH}?reset=success`);

    // The stale cookie is treated as no session: /app asks for sign-in again.
    await page.goto("/app");
    await expect(page).toHaveURL(new RegExp(`${SIGN_IN_PATH}(\\?|$)`));
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });
});

test.describe("invalid links", () => {
  test("link desconhecido mostra a mensagem e oferece um novo link", async ({
    page,
  }) => {
    await page.goto(resetUrl("unknown-token"));
    await fillAndSubmit(page, NEW_PASSWORD);

    const alert = page.getByRole("alert").filter({
      hasText: INVALID_LINK_MESSAGE,
    });

    await expect(alert).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Request a new reset link" }),
    ).toHaveAttribute("href", "/auth/forgot-password");
    await expect(newPasswordInput(page)).toHaveCount(0);
  });

  test("sem token na URL mostra o link inválido sem formulário", async ({
    page,
  }) => {
    await page.goto(RESET_PATH);

    await expect(
      page.getByRole("alert").filter({ hasText: INVALID_LINK_MESSAGE }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Request a new reset link" }),
    ).toHaveAttribute("href", "/auth/forgot-password");
    await expect(newPasswordInput(page)).toHaveCount(0);
  });

  test("o segundo uso do mesmo token é rejeitado", async ({ page }) => {
    const local = uniqueLocal("reset-twice");
    const token = uniqueToken(local);

    await page.goto(resetUrl(token));
    await fillAndSubmit(page, NEW_PASSWORD);
    await expect(page).toHaveURL(`${BASE_URL}${SIGN_IN_PATH}?reset=success`);

    await page.goto(resetUrl(token));
    await fillAndSubmit(page, "another password 456");

    await expect(
      page.getByRole("alert").filter({ hasText: INVALID_LINK_MESSAGE }),
    ).toBeVisible();

    // The first password is still the current one.
    await page.goto(SIGN_IN_PATH);
    await signInWith(page, `${local}@${E2E_SIGN_IN_DOMAIN}`, NEW_PASSWORD);
    await expect(page).toHaveURL(`${BASE_URL}/app`);
  });
});

test.describe("form validation", () => {
  test("confirmação diferente mostra o erro associado e não queima o token", async ({
    page,
  }) => {
    const token = uniqueToken(uniqueLocal("reset-mismatch"));

    await page.goto(resetUrl(token));
    await fillAndSubmit(page, NEW_PASSWORD, "something else entirely");

    await expect(formAlert(page)).toHaveText(
      "Check the highlighted fields and try again.",
    );
    await expect(confirmationInput(page)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(confirmationInput(page)).toHaveAttribute(
      "aria-describedby",
      "reset-password-confirmation-error",
    );
    await expect(page.locator("#reset-password-confirmation-error")).toHaveText(
      "Passwords do not match.",
    );

    // The token survived the failed attempt and the address bar stayed clean.
    await expect(page).toHaveURL(`${BASE_URL}${RESET_PATH}`);
    await fillAndSubmit(page, NEW_PASSWORD);
    await expect(page).toHaveURL(`${BASE_URL}${SIGN_IN_PATH}?reset=success`);
  });

  test("senha curta mostra o erro da política associado ao campo", async ({
    page,
  }) => {
    await page.goto(resetUrl(uniqueToken(uniqueLocal("reset-weak"))));
    await fillAndSubmit(page, "short");

    await expect(newPasswordInput(page)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(newPasswordInput(page)).toHaveAttribute(
      "aria-describedby",
      "reset-password-password-hint reset-password-password-error",
    );
    await expect(page.locator("#reset-password-password-error")).toHaveText(
      "Password must be at least 8 characters.",
    );
  });

  test("rate limit orienta a aguardar e mantém o formulário", async ({
    page,
  }) => {
    await page.goto(resetUrl(E2E_RESET_RATE_LIMITED_TOKEN));
    await fillAndSubmit(page, NEW_PASSWORD);

    await expect(formAlert(page)).toHaveText(
      "Too many attempts. Wait a moment and try again.",
    );
    await expect(
      page.getByRole("button", { name: "Update password" }),
    ).toBeEnabled();
  });
});

test.describe("accessibility and responsiveness", () => {
  for (const width of [360, 768, 1280]) {
    test(`nao tem rolagem horizontal em ${width}px com erro visivel`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(resetUrl(uniqueToken(uniqueLocal("reset-responsive"))));
      await fillAndSubmit(page, "short");

      await expect(formAlert(page)).toBeVisible();
      await expectNoHorizontalScroll(page);
    });
  }

  test("labels associados, textos en-US e foco visível", async ({ page }) => {
    await page.goto(resetUrl(uniqueToken(uniqueLocal("reset-a11y"))));

    await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
    await expect(
      page.getByRole("heading", { level: 1, name: "Reset your password" }),
    ).toBeVisible();
    await expect(page.getByLabel(/^New password/)).toBeVisible();
    await expect(page.getByLabel(/^Confirm new password/)).toBeVisible();
    await expect(newPasswordInput(page)).toHaveAttribute(
      "autocomplete",
      "new-password",
    );

    await newPasswordInput(page).focus();

    const styles = await newPasswordInput(page).evaluate((element) => {
      const computed = window.getComputedStyle(element);

      return {
        outlineWidth: computed.outlineWidth,
        boxShadow: computed.boxShadow,
      };
    });

    expect(styles.outlineWidth !== "0px" || styles.boxShadow !== "none").toBe(
      true,
    );
  });

  test("UI permanece light-only", async ({ page }) => {
    await page.goto(RESET_PATH);

    const colorScheme = await page.evaluate(
      () => window.getComputedStyle(document.documentElement).colorScheme,
    );

    expect(colorScheme).toBe("light");
  });
});
