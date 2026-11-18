import { expect, test, type Page } from "@playwright/test";

import { E2E_VALID_SESSION_TOKEN } from "./support/fake-session";
import { WEB_URL } from "./support/ports";

async function setSessionCookie(page: Page, token: string): Promise<void> {
  await page.context().addCookies([
    {
      name: "session_token",
      value: token,
      url: WEB_URL,
    },
  ]);
}

async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const hasHorizontalScroll = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );

  expect(hasHorizontalScroll).toBe(false);
}

test.describe("landing page", () => {
  test("visitante vê a landing pública com proposta e CTAs", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "team of AI experts",
    );
    await expect(
      page.getByRole("heading", { name: "CEO Expert" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "CMO Expert" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "CTO Expert" }),
    ).toBeVisible();
    await expect(page.getByText("PDF uploads")).toBeVisible();
    await expect(page.getByText("Google Drive")).toBeVisible();
    await expect(page.getByText("Notion")).toBeVisible();

    await expect(
      page.getByRole("link", { name: "Create your account" }).first(),
    ).toHaveAttribute("href", "/auth/sign-up");
    await expect(
      page.getByRole("link", { name: "Sign in" }).first(),
    ).toHaveAttribute("href", "/auth/sign-in");
  });

  test("visitante autenticado é redirecionado para /app", async ({ page }) => {
    await setSessionCookie(page, E2E_VALID_SESSION_TOKEN);
    await page.goto("/");

    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Welcome, Ada",
    );
  });

  for (const width of [360, 768, 1280]) {
    test(`não tem rolagem horizontal em ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");

      await expectNoHorizontalScroll(page);
    });
  }
});
