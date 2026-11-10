import { expect, test, type Page } from "@playwright/test";

const SIGN_UP_PATH = "/auth/sign-up";

type SignUpValues = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  passwordConfirmation: string;
};

const VALID_VALUES: SignUpValues = {
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  password: "correct horse battery staple",
  passwordConfirmation: "correct horse battery staple",
};

function inputFor(page: Page, field: keyof SignUpValues) {
  return page.locator(`#sign-up-${field}`);
}

async function fillSignUpForm(
  page: Page,
  overrides: Partial<SignUpValues> = {},
): Promise<void> {
  const values = { ...VALID_VALUES, ...overrides };

  for (const [field, value] of Object.entries(values)) {
    await inputFor(page, field as keyof SignUpValues).fill(value);
  }
}

async function submitSignUp(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Create account" }).click();
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

test.describe("sign-up form validation", () => {
  test("mostra erros por campo associados aos inputs", async ({ page }) => {
    await page.goto(SIGN_UP_PATH);
    await submitSignUp(page);

    await expect(page.locator('form [role="alert"]')).toHaveText(
      "Check the highlighted fields and try again.",
    );

    for (const field of [
      "firstName",
      "lastName",
      "email",
      "password",
      "passwordConfirmation",
    ] as const) {
      const input = inputFor(page, field);
      const error = page.locator(`#sign-up-${field}-error`);

      await expect(input).toHaveAttribute("aria-invalid", "true");
      await expect(input).toHaveAttribute(
        "aria-describedby",
        new RegExp(`sign-up-${field}-error`),
      );
      await expect(error).toBeVisible();
    }

    await expect(
      page.getByRole("button", { name: "Create account" }),
    ).toBeVisible();
  });

  test("valida formato de e-mail, politica de senha e confirmacao", async ({
    page,
  }) => {
    await page.goto(SIGN_UP_PATH);
    await fillSignUpForm(page, {
      email: "not-an-email",
      password: "short",
      passwordConfirmation: "different",
    });
    await submitSignUp(page);

    await expect(page.locator("#sign-up-email-error")).toHaveText(
      "Enter a valid email address.",
    );
    await expect(page.locator("#sign-up-password-error")).toHaveText(
      "Password must be at least 8 characters.",
    );
    await expect(
      page.locator("#sign-up-passwordConfirmation-error"),
    ).toHaveText("Passwords do not match.");
    await expect(page.locator("#sign-up-firstName-error")).toHaveCount(0);

    await expectNoSessionCookie(page);
  });

  test("mantem o foco visivel ao navegar por teclado", async ({ page }) => {
    await page.goto(SIGN_UP_PATH);

    const firstName = inputFor(page, "firstName");
    await firstName.focus();

    const styles = await firstName.evaluate((element) => {
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

test.describe("sign-up submission", () => {
  test("cria conta e mostra mensagem generica sem sessao", async ({ page }) => {
    await page.goto(SIGN_UP_PATH);
    await fillSignUpForm(page, {
      email: `e2e-${Date.now()}@example.com`,
    });
    await submitSignUp(page);

    const status = page.getByRole("status");

    await expect(status).toBeVisible();
    await expect(status).toContainText(
      "Check your email to confirm your account.",
    );
    await expect(status).toContainText("We sent a confirmation link to");
    await expect(inputFor(page, "firstName")).toHaveCount(0);
    await expectNoSessionCookie(page);

    const hasSessionStorage = await page.evaluate(
      () =>
        window.localStorage.getItem("session_token") !== null ||
        window.sessionStorage.getItem("session_token") !== null,
    );

    expect(hasSessionStorage).toBe(false);
  });

  test("reenvio de e-mail nao confirmado mostra a mesma mensagem", async ({
    page,
  }) => {
    await page.goto(SIGN_UP_PATH);
    await fillSignUpForm(page, { email: "resend@example.com" });
    await submitSignUp(page);

    await expect(page.getByRole("status")).toContainText(
      "Check your email to confirm your account.",
    );
    await expectNoSessionCookie(page);
  });

  test("e-mail ja confirmado informa que a conta existe", async ({ page }) => {
    await page.goto(SIGN_UP_PATH);
    await fillSignUpForm(page, { email: "taken@example.com" });
    await submitSignUp(page);

    await expect(page.locator('form [role="alert"]')).toHaveText(
      "An account with this email already exists. Sign in instead.",
    );
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  });

  test("rate limit orienta a aguardar", async ({ page }) => {
    await page.goto(SIGN_UP_PATH);
    await fillSignUpForm(page, { email: "rate-limited@example.com" });
    await submitSignUp(page);

    await expect(page.locator('form [role="alert"]')).toHaveText(
      "Too many attempts. Wait a moment and try again.",
    );
  });

  test("falha de e-mail e acionavel e permite tentar novamente", async ({
    page,
  }) => {
    await page.goto(SIGN_UP_PATH);
    await fillSignUpForm(page, { email: "mail-failure@example.com" });
    await submitSignUp(page);

    await expect(page.locator('form [role="alert"]')).toHaveText(
      "We could not send the confirmation email. Try again in a moment.",
    );
    await expect(
      page.getByRole("button", { name: "Create account" }),
    ).toBeEnabled();
  });
});

test.describe("sign-up accessibility and responsiveness", () => {
  for (const width of [360, 768, 1280]) {
    test(`nao tem rolagem horizontal em ${width}px com erros visiveis`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(SIGN_UP_PATH);
      await submitSignUp(page);

      await expect(page.locator('form [role="alert"]')).toBeVisible();
      await expectNoHorizontalScroll(page);
    });
  }

  test("labels estao associados e textos sao en-US", async ({ page }) => {
    await page.goto(SIGN_UP_PATH);

    await expect(page.locator("html")).toHaveAttribute("lang", "en-US");

    for (const field of [
      "firstName",
      "lastName",
      "email",
      "password",
      "passwordConfirmation",
    ] as const) {
      await expect(inputFor(page, field)).toBeVisible();
      await expect(page.locator(`label[for="sign-up-${field}"]`)).toBeVisible();
    }

    await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/auth/sign-in",
    );
  });

  test("UI permanece light-only", async ({ page }) => {
    await page.goto(SIGN_UP_PATH);

    const colorScheme = await page.evaluate(
      () => window.getComputedStyle(document.documentElement).colorScheme,
    );

    expect(colorScheme).toBe("light");
  });
});
