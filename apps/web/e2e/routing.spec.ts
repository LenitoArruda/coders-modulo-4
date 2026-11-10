import { expect, test, type Page } from "@playwright/test";

import {
  E2E_INVALID_SESSION_TOKEN,
  E2E_VALID_SESSION_TOKEN,
} from "./support/fake-session";

const AUTH_PLACEHOLDERS = [
  ["/auth/sign-up", "Create your account"],
  ["/auth/sign-in", "Sign in"],
  ["/auth/confirm", "Confirm your email"],
  ["/auth/forgot-password", "Forgot your password?"],
  ["/auth/reset-password", "Reset your password"],
] as const;

const AUTH_PATHS_REDIRECTING_SIGNED_IN = [
  "/auth/sign-up",
  "/auth/sign-in",
  "/auth/confirm",
] as const;

const AUTH_PATHS_KEPT_WHEN_SIGNED_IN = [
  "/auth/forgot-password",
  "/auth/reset-password",
] as const;

async function setSessionCookie(page: Page, token: string): Promise<void> {
  await page.context().addCookies([
    {
      name: "session_token",
      value: token,
      url: "http://127.0.0.1:3000",
    },
  ]);
}

async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const hasHorizontalScroll = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );

  expect(hasHorizontalScroll).toBe(false);
}

test.describe("public auth routes", () => {
  test("visitante na raiz é enviado para o sign-up em en-US", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/auth\/sign-up$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
    await expect(page.locator('[data-layout="auth"]')).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Create your account",
    );
  });

  for (const [path, title] of AUTH_PLACEHOLDERS) {
    test(`placeholder ${path} carrega no layout público`, async ({ page }) => {
      await page.goto(path);

      await expect(page.locator('[data-layout="auth"]')).toBeVisible();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
      await expect(page.locator("h1")).toHaveCount(1);
    });
  }

  test("rota de auth inexistente responde 404 dentro do layout público", async ({
    page,
  }) => {
    const response = await page.goto("/auth/does-not-exist");

    expect(response?.status()).toBe(404);
    await expect(page.locator('[data-layout="auth"]')).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Page not found",
    );
  });
});

test.describe("private area without a session", () => {
  for (const path of ["/app", "/app/settings"] as const) {
    test(`${path} redireciona para o sign-up`, async ({ page }) => {
      await page.goto(path);

      await expect(page).toHaveURL(/\/auth\/sign-up$/);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        "Create your account",
      );
    });
  }

  test("sessão inválida ou revogada é tratada como ausência de sessão", async ({
    page,
  }) => {
    await setSessionCookie(page, E2E_INVALID_SESSION_TOKEN);
    await page.goto("/app");

    await expect(page).toHaveURL(/\/auth\/sign-up$/);
  });

  test("raiz com sessão inválida vai para o sign-up", async ({ page }) => {
    await setSessionCookie(page, E2E_INVALID_SESSION_TOKEN);
    await page.goto("/");

    await expect(page).toHaveURL(/\/auth\/sign-up$/);
  });
});

test.describe("private area with a valid session", () => {
  test.beforeEach(async ({ page }) => {
    await setSessionCookie(page, E2E_VALID_SESSION_TOKEN);
  });

  test("raiz é enviada para /app", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/app$/);
    await expect(page.locator('[data-layout="app"]')).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Welcome, Ada",
    );
  });

  test("shell privado carrega com navegação básica", async ({ page }) => {
    await page.goto("/app");

    await expect(page.locator('[data-layout="app"]')).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/app",
    );
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Welcome, Ada",
    );
  });

  for (const path of AUTH_PATHS_REDIRECTING_SIGNED_IN) {
    test(`${path} redireciona pessoa autenticada para /app`, async ({
      page,
    }) => {
      await page.goto(path);

      await expect(page).toHaveURL(/\/app$/);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        "Welcome, Ada",
      );
    });
  }

  for (const path of AUTH_PATHS_KEPT_WHEN_SIGNED_IN) {
    test(`${path} permanece acessível com sessão ativa`, async ({ page }) => {
      await page.goto(path);

      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.locator('[data-layout="auth"]')).toBeVisible();
    });
  }

  test("rota privada inexistente responde 404 dentro do shell", async ({
    page,
  }) => {
    const response = await page.goto("/app/does-not-exist");

    expect(response?.status()).toBe(404);
    await expect(page.locator('[data-layout="app"]')).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Page not found",
    );
  });
});

test.describe("accessibility and responsiveness", () => {
  for (const width of [360, 768, 1280]) {
    test(`layout público não tem rolagem horizontal em ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/auth/sign-up");

      await expectNoHorizontalScroll(page);
    });

    test(`shell privado não tem rolagem horizontal em ${width}px`, async ({
      page,
    }) => {
      await setSessionCookie(page, E2E_VALID_SESSION_TOKEN);
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/app");

      await expectNoHorizontalScroll(page);
    });
  }

  test("foco de teclado é visível no link do card público", async ({
    page,
  }) => {
    await page.goto("/auth/sign-in");

    const link = page.getByRole("link", { name: "Create an account" });
    await link.focus();

    const outlineWidth = await link.evaluate(
      (element) => window.getComputedStyle(element).outlineWidth,
    );

    expect(outlineWidth).not.toBe("0px");
  });

  test("foco de teclado é visível na navegação privada", async ({ page }) => {
    await setSessionCookie(page, E2E_VALID_SESSION_TOKEN);
    await page.goto("/app");

    const link = page.getByRole("link", { name: "Home" });
    await link.focus();

    const outlineWidth = await link.evaluate(
      (element) => window.getComputedStyle(element).outlineWidth,
    );

    expect(outlineWidth).not.toBe("0px");
  });

  test("UI é light-only e usa en-US", async ({ page }) => {
    await page.goto("/auth/sign-up");

    await expect(page.locator("html")).toHaveAttribute("lang", "en-US");

    const colorScheme = await page.evaluate(
      () => window.getComputedStyle(document.documentElement).colorScheme,
    );
    const background = await page.evaluate(
      () => window.getComputedStyle(document.body).backgroundColor,
    );

    expect(colorScheme).toBe("light");
    expect(background).toBe("rgb(255, 255, 255)");
  });
});
