import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";

import {
  E2E_SIGN_IN_DOMAIN,
  E2E_SIGN_IN_PASSWORD,
} from "./support/fake-session";

const SIGN_IN_PATH = "/auth/sign-in";
const BASE_URL = "http://127.0.0.1:3000";

const INVALID_MESSAGE = "Invalid email or password.";
const NOT_CONFIRMED_MESSAGE = "Please confirm your email before signing in.";
const RATE_LIMITED_MESSAGE = "Too many attempts. Wait a moment and try again.";

/** Each test owns an account so parallel tests never revoke each other. */
function uniqueEmail(label: string): string {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  return `${label}-${suffix}@${E2E_SIGN_IN_DOMAIN}`;
}

async function submitCredentials(
  page: Page,
  email: string,
  password: string = E2E_SIGN_IN_PASSWORD,
): Promise<void> {
  await page.getByLabel(/^Email/).fill(email);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/** The form alert; Next also renders a route announcer with role="alert". */
function formAlert(page: Page) {
  return page.locator('form [role="alert"]');
}

async function sessionCookie(context: BrowserContext) {
  return (await context.cookies()).find(
    (cookie) => cookie.name === "session_token",
  );
}

async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const hasHorizontalScroll = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );

  expect(hasHorizontalScroll).toBe(false);
}

async function newSignedInContext(
  browser: Browser,
  email: string,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();

  await page.goto(SIGN_IN_PATH);
  await submitCredentials(page, email);
  await expect(page).toHaveURL(/\/app$/);

  return { context, page };
}

test.describe("sign-in page", () => {
  test("renderiza o formulário acessível em en-US com link de recuperação", async ({
    page,
  }) => {
    await page.goto(SIGN_IN_PATH);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sign in");
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.getByLabel(/^Email/)).toHaveAttribute("type", "email");
    await expect(page.getByLabel(/^Password/)).toHaveAttribute(
      "type",
      "password",
    );
    await expect(page.getByLabel(/^Password/)).toHaveAttribute(
      "autocomplete",
      "current-password",
    );
    await expect(
      page.getByRole("link", { name: "Forgot password?" }),
    ).toHaveAttribute("href", "/auth/forgot-password");
    await expect(
      page.getByRole("link", { name: "Create an account" }),
    ).toHaveAttribute("href", "/auth/sign-up");
  });

  for (const width of [360, 768, 1280]) {
    test(`não tem rolagem horizontal em ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(SIGN_IN_PATH);

      await expectNoHorizontalScroll(page);
    });
  }

  test("é operável apenas pelo teclado e mostra foco visível", async ({
    page,
  }) => {
    await page.goto(SIGN_IN_PATH);

    const email = page.getByLabel(/^Email/);

    await email.focus();

    const outlineWidth = await email.evaluate(
      (element) => window.getComputedStyle(element).outlineWidth,
    );
    const boxShadow = await email.evaluate(
      (element) => window.getComputedStyle(element).boxShadow,
    );

    expect(outlineWidth !== "0px" || boxShadow !== "none").toBe(true);

    await page.keyboard.type(uniqueEmail("keyboard"));
    await page.keyboard.press("Tab");
    await expect(page.getByLabel(/^Password/)).toBeFocused();
    await page.keyboard.type(E2E_SIGN_IN_PASSWORD);
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/app$/);
  });
});

test.describe("signing in", () => {
  test("entra, grava cookie HttpOnly e abre /app", async ({ page }) => {
    await page.goto(SIGN_IN_PATH);
    await submitCredentials(page, uniqueEmail("ada"));

    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Welcome, Ada",
    );

    const cookie = await sessionCookie(page.context());

    expect(cookie).toBeDefined();
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("Lax");
    expect(cookie?.path).toBe("/");

    const clientStorage = await page.evaluate(() => ({
      cookie: document.cookie,
      local: JSON.stringify(window.localStorage),
      session: JSON.stringify(window.sessionStorage),
    }));

    expect(clientStorage.cookie).not.toContain("session_token");
    expect(clientStorage.local + clientStorage.session).not.toContain(
      E2E_SIGN_IN_PASSWORD,
    );
    expect(page.url()).not.toContain(E2E_SIGN_IN_PASSWORD);
  });

  test("senha incorreta e conta desconhecida mostram a mesma mensagem genérica", async ({
    page,
  }) => {
    await page.goto(SIGN_IN_PATH);
    await submitCredentials(page, uniqueEmail("ada"), "wrong-password");

    const alert = formAlert(page);

    await expect(alert).toContainText(INVALID_MESSAGE);
    await expect(alert).toBeFocused();
    await expect(page).toHaveURL(/\/auth\/sign-in$/);
    expect(await sessionCookie(page.context())).toBeUndefined();

    await submitCredentials(page, "ghost@example.com");

    await expect(formAlert(page)).toContainText(INVALID_MESSAGE);
    expect(await sessionCookie(page.context())).toBeUndefined();
  });

  test("conta não confirmada recebe orientação e nenhuma sessão", async ({
    page,
  }) => {
    await page.goto(SIGN_IN_PATH);
    await submitCredentials(page, "unconfirmed@example.com");

    const alert = formAlert(page);

    await expect(alert).toContainText(NOT_CONFIRMED_MESSAGE);
    await expect(alert).toContainText("Open the confirmation link");
    await expect(page).toHaveURL(/\/auth\/sign-in$/);
    expect(await sessionCookie(page.context())).toBeUndefined();
  });

  test("conta não confirmada com senha errada não é revelada", async ({
    page,
  }) => {
    await page.goto(SIGN_IN_PATH);
    await submitCredentials(page, "unconfirmed@example.com", "wrong-password");

    await expect(formAlert(page)).toContainText(INVALID_MESSAGE);
    await expect(formAlert(page)).not.toContainText("confirm");
  });

  test("excesso de tentativas orienta a aguardar", async ({ page }) => {
    await page.goto(SIGN_IN_PATH);
    await submitCredentials(page, "rate-limited@example.com");

    await expect(formAlert(page)).toContainText(RATE_LIMITED_MESSAGE);
    expect(await sessionCookie(page.context())).toBeUndefined();
  });

  test("falha da API mostra erro genérico e permite tentar de novo", async ({
    page,
  }) => {
    await page.goto(SIGN_IN_PATH);
    await submitCredentials(page, "server-error@example.com");

    await expect(formAlert(page)).toContainText(
      "Something went wrong. Try again.",
    );
    expect(await sessionCookie(page.context())).toBeUndefined();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });

  test("campos vazios mostram erros associados por aria-describedby", async ({
    page,
  }) => {
    await page.goto(SIGN_IN_PATH);
    await page.getByRole("button", { name: "Sign in" }).click();

    const email = page.getByLabel(/^Email/);
    const password = page.getByLabel(/^Password/);

    await expect(page.getByText("Enter your email address.")).toBeVisible();
    await expect(page.getByText("Enter your password.")).toBeVisible();
    await expect(email).toHaveAttribute("aria-invalid", "true");
    await expect(email).toHaveAttribute(
      "aria-describedby",
      "sign-in-email-error",
    );
    await expect(password).toHaveAttribute(
      "aria-describedby",
      "sign-in-password-error",
    );
  });

  test("preserva o e-mail digitado após uma falha, mas nunca a senha", async ({
    page,
  }) => {
    const email = uniqueEmail("keep");

    await page.goto(SIGN_IN_PATH);
    await submitCredentials(page, email, "wrong-password");

    await expect(formAlert(page)).toBeVisible();
    await expect(page.getByLabel(/^Email/)).toHaveValue(email);
    await expect(page.getByLabel(/^Password/)).toHaveValue("");
  });
});

test.describe("returnTo", () => {
  test("volta ao caminho privado solicitado depois de entrar", async ({
    page,
  }) => {
    await page.goto("/app/settings");

    await expect(page).toHaveURL(
      /\/auth\/sign-in\?returnTo=%2Fapp%2Fsettings$/,
    );

    await submitCredentials(page, uniqueEmail("return"));

    await expect(page).toHaveURL(/\/app\/settings$/);
    await expect(page.locator('[data-layout="app"]')).toBeVisible();
  });

  for (const unsafe of [
    "https://evil.example/app/x",
    "//evil.example",
    "/app//evil.example",
    "/app/%2F%2Fevil.example",
    "/app/..%2Fauth",
    "/auth/sign-up",
    "javascript:alert(1)",
  ]) {
    test(`valor inseguro ${unsafe} cai em /app`, async ({ page }) => {
      await page.goto(`${SIGN_IN_PATH}?returnTo=${encodeURIComponent(unsafe)}`);
      await submitCredentials(page, uniqueEmail("unsafe"));

      await expect(page).toHaveURL(/\/app$/);
      expect(new URL(page.url()).origin).toBe(BASE_URL);
    });
  }

  test("returnTo adulterado no formulário é revalidado na action", async ({
    page,
  }) => {
    await page.goto(SIGN_IN_PATH);
    await page
      .locator('input[name="returnTo"]')
      .evaluate((input: HTMLInputElement) => {
        input.value = "https://evil.example";
      });
    await submitCredentials(page, uniqueEmail("tamper"));

    await expect(page).toHaveURL(/\/app$/);
    expect(new URL(page.url()).origin).toBe(BASE_URL);
  });
});

test.describe("single session", () => {
  test("segundo dispositivo invalida o primeiro", async ({ browser }) => {
    const email = uniqueEmail("single");
    const first = await newSignedInContext(browser, email);
    const second = await newSignedInContext(browser, email);

    await expect(second.page.getByRole("heading", { level: 1 })).toHaveText(
      "Welcome, Ada",
    );

    await first.page.goto("/app");

    await expect(first.page).toHaveURL(/\/auth\/sign-in$/);

    await second.page.goto("/app");

    await expect(second.page).toHaveURL(/\/app$/);

    await first.context.close();
    await second.context.close();
  });
});

test.describe("root and auth pages with a session", () => {
  test("raiz com sessão vai para /app e sem sessão para o sign-in", async ({
    browser,
  }) => {
    const signedOut = await browser.newContext({ baseURL: BASE_URL });
    const signedOutPage = await signedOut.newPage();

    await signedOutPage.goto("/");
    await expect(signedOutPage).toHaveURL(/\/auth\/sign-in$/);
    await signedOut.close();

    const { context, page } = await newSignedInContext(
      browser,
      uniqueEmail("root"),
    );

    await page.goto("/");
    await expect(page).toHaveURL(/\/app$/);

    for (const path of ["/auth/sign-in", "/auth/sign-up"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/app$/);
    }

    await context.close();
  });
});

test.describe("signing out", () => {
  test("botão Sign out encerra a sessão, apaga o cookie e volta ao sign-in", async ({
    browser,
  }) => {
    const { context, page } = await newSignedInContext(
      browser,
      uniqueEmail("signout"),
    );
    const token = (await sessionCookie(context))?.value;

    expect(token).toBeDefined();

    await page.getByRole("button", { name: "Sign out" }).click();

    await expect(page).toHaveURL(/\/auth\/sign-in$/);
    expect(await sessionCookie(context)).toBeUndefined();

    await page.goto("/app");
    await expect(page).toHaveURL(/\/auth\/sign-in/);

    // The revoked token no longer works even if a copy of it survives.
    await context.addCookies([
      { name: "session_token", value: token ?? "", url: BASE_URL },
    ]);
    await page.goto("/app");
    await expect(page).toHaveURL(/\/auth\/sign-in/);

    await context.close();
  });

  test("é operável pelo teclado", async ({ browser }) => {
    const { context, page } = await newSignedInContext(
      browser,
      uniqueEmail("signoutkb"),
    );
    const button = page.getByRole("button", { name: "Sign out" });

    await button.focus();
    await expect(button).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/auth\/sign-in$/);

    await context.close();
  });
});
