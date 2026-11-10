import { expect, test, type Page } from "@playwright/test";

const FORGOT_PASSWORD_PATH = "/auth/forgot-password";

function emailInput(page: Page) {
  return page.locator("#forgot-password-email");
}

async function submit(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Send reset link" }).click();
}

async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const hasHorizontalScroll = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );

  expect(hasHorizontalScroll).toBe(false);
}

test.describe("forgot-password form validation", () => {
  test("mostra erro do campo de e-mail associado ao input", async ({
    page,
  }) => {
    await page.goto(FORGOT_PASSWORD_PATH);
    await submit(page);

    await expect(page.locator('form [role="alert"]')).toHaveText(
      "Check the highlighted fields and try again.",
    );
    await expect(emailInput(page)).toHaveAttribute("aria-invalid", "true");
    await expect(emailInput(page)).toHaveAttribute(
      "aria-describedby",
      "forgot-password-email-error",
    );
    await expect(page.locator("#forgot-password-email-error")).toHaveText(
      "Enter your email address.",
    );
  });

  test("valida o formato do e-mail", async ({ page }) => {
    await page.goto(FORGOT_PASSWORD_PATH);
    await emailInput(page).fill("not-an-email");
    await submit(page);

    await expect(page.locator("#forgot-password-email-error")).toHaveText(
      "Enter a valid email address.",
    );
  });

  test("mantem o foco visivel no campo de e-mail", async ({ page }) => {
    await page.goto(FORGOT_PASSWORD_PATH);

    const input = emailInput(page);
    await input.focus();

    const styles = await input.evaluate((element) => {
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
});

test.describe("forgot-password submission", () => {
  test("mostra a mesma mensagem genérica e substitui o formulário", async ({
    page,
  }) => {
    await page.goto(FORGOT_PASSWORD_PATH);
    await emailInput(page).fill("ada@example.com");
    await submit(page);

    const status = page.getByRole("status");

    await expect(status).toBeVisible();
    await expect(status).toContainText(
      "If an account exists for this email, we sent a password reset link.",
    );
    await expect(emailInput(page)).toHaveCount(0);
    await expect(status.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/auth/sign-in",
    );
  });

  test("e-mail inexistente recebe a mesma mensagem genérica", async ({
    page,
  }) => {
    await page.goto(FORGOT_PASSWORD_PATH);
    await emailInput(page).fill("nobody@example.com");
    await submit(page);

    await expect(page.getByRole("status")).toContainText(
      "If an account exists for this email, we sent a password reset link.",
    );
  });

  test("rate limit orienta a aguardar sem revelar a conta", async ({
    page,
  }) => {
    await page.goto(FORGOT_PASSWORD_PATH);
    await emailInput(page).fill("rate-limited@example.com");
    await submit(page);

    await expect(page.locator('form [role="alert"]')).toHaveText(
      "Too many attempts. Wait a moment and try again.",
    );
    await expect(
      page.getByRole("button", { name: "Send reset link" }),
    ).toBeEnabled();
  });
});

test.describe("forgot-password accessibility and responsiveness", () => {
  for (const width of [360, 768, 1280]) {
    test(`nao tem rolagem horizontal em ${width}px com erro visivel`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(FORGOT_PASSWORD_PATH);
      await submit(page);

      await expect(page.locator('form [role="alert"]')).toBeVisible();
      await expectNoHorizontalScroll(page);
    });
  }

  test("label está associado e os textos são en-US", async ({ page }) => {
    await page.goto(FORGOT_PASSWORD_PATH);

    await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
    await expect(
      page.locator('label[for="forgot-password-email"]'),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 1, name: "Forgot your password?" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Go to sign in" }),
    ).toHaveAttribute("href", "/auth/sign-in");
  });

  test("UI permanece light-only", async ({ page }) => {
    await page.goto(FORGOT_PASSWORD_PATH);

    const colorScheme = await page.evaluate(
      () => window.getComputedStyle(document.documentElement).colorScheme,
    );

    expect(colorScheme).toBe("light");
  });
});
