import { expect, test, type Page } from "@playwright/test";

import {
  E2E_SIGN_IN_DOMAIN,
  E2E_SIGN_IN_PASSWORD,
} from "./support/fake-session";

const FAKE_API_URL = "http://127.0.0.1:3437";
const FLAG_COOKIE = "multimedia_deliverables_enabled";

/** Each test owns an account so transcripts and deliverables stay isolated. */
function uniqueEmail(label: string): string {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  return `${label}-${suffix}@${E2E_SIGN_IN_DOMAIN}`;
}

async function signIn(page: Page, label = "media"): Promise<void> {
  await page
    .context()
    .addCookies([
      { name: FLAG_COOKIE, value: "1", url: "http://127.0.0.1:3017" },
    ]);
  await page.goto("/auth/sign-in");
  await page.getByLabel(/^Email/).fill(uniqueEmail(label));
  await page.getByLabel(/^Password/).fill(E2E_SIGN_IN_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app$/);
}

async function sessionToken(page: Page): Promise<string> {
  const cookie = (await page.context().cookies()).find(
    (item) => item.name === "session_token",
  );

  expect(cookie).toBeDefined();

  return cookie?.value ?? "";
}

async function sendPrompt(page: Page, prompt: string): Promise<void> {
  await page.getByLabel("Message").fill(prompt);
  await page.getByRole("button", { name: "Send" }).click();
}

function attachment(page: Page) {
  return page.getByTestId("media-attachment");
}

async function mediaIdOf(page: Page): Promise<string> {
  const id = await attachment(page).getAttribute("data-media-id");

  expect(id).not.toBeNull();

  return id ?? "";
}

test.describe("multimedia deliverables", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("gera uma imagem com preview, metadados e download autenticado", async ({
    page,
  }) => {
    await sendPrompt(page, "Create an image of a lighthouse at sunset.");

    await expect(page.getByRole("log")).toContainText(
      "I started your 1024x1024 image",
    );

    const item = attachment(page);
    await expect(item).toBeVisible();
    const mediaId = await mediaIdOf(page);

    await expect(item).toHaveAttribute("data-status", "ready", {
      timeout: 30_000,
    });
    await expect(item.getByText("1024x1024 image")).toBeVisible();
    await expect(item.getByRole("status")).toHaveText("Ready");
    await expect(item.locator("img")).toHaveAttribute(
      "src",
      `/app/media/${mediaId}/content?inline=1`,
    );
    await expect(item.getByText("image/png")).toBeVisible();
    await expect(item.getByText("gpt-image-2")).toBeVisible();

    const download = item.getByRole("link", { name: "Download" });
    await expect(download).toHaveAttribute(
      "href",
      `/app/media/${mediaId}/content`,
    );

    const response = await page.request.get(`/app/media/${mediaId}/content`);

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/png");
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
    expect((await response.body()).byteLength).toBeGreaterThan(0);

    const inline = await page.request.get(
      `/app/media/${mediaId}/content?inline=1`,
    );

    expect(inline.status()).toBe(200);
    expect(inline.headers()["content-disposition"]).toContain("inline");
  });

  test("pedido sem tipo recebe uma pergunta curta e nenhum job", async ({
    page,
  }) => {
    await sendPrompt(page, "Create something useful for the team.");

    await expect(page.getByRole("log")).toContainText(
      "What should I create — an image or a short video?",
    );
    await expect(attachment(page)).toHaveCount(0);
  });

  test("cancela um job em andamento e não oferece download", async ({
    page,
  }) => {
    await sendPrompt(page, "Create an image of a mountain trail.");

    const item = attachment(page);
    await expect(item).toBeVisible();
    await item.getByRole("button", { name: "Cancel" }).click();

    await expect(item).toHaveAttribute("data-status", "cancelled");
    await expect(
      item.getByText("Generation cancelled. No file was kept."),
    ).toBeVisible();
    await expect(item.getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(item.getByRole("link", { name: "Download" })).toHaveCount(0);
  });

  test("try again recupera uma falha e permite o download", async ({
    page,
  }) => {
    await sendPrompt(page, "fail-media: a poster for the release");

    const item = attachment(page);
    await expect(item).toHaveAttribute("data-status", "failed");
    await expect(
      item.getByText("We couldn't create this file. Try again."),
    ).toBeVisible();

    await item.getByRole("button", { name: "Try again" }).click();

    await expect(item).toHaveAttribute("data-status", "ready", {
      timeout: 30_000,
    });
    await expect(item.getByRole("link", { name: "Download" })).toBeVisible();
  });

  test("entregáveis são isolados por usuário autenticado", async ({ page }) => {
    await sendPrompt(page, "Create an image of a quiet harbor.");
    await expect(attachment(page)).toHaveAttribute("data-status", "ready", {
      timeout: 30_000,
    });
    const mediaId = await mediaIdOf(page);

    await page.context().clearCookies();
    await signIn(page, "other");

    await expect(attachment(page)).toHaveCount(0);

    const token = await sessionToken(page);
    const status = await page.request.get(
      `${FAKE_API_URL}/api/v1/media/${mediaId}/status`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const content = await page.request.get(
      `${FAKE_API_URL}/api/v1/media/${mediaId}/content`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    expect(status.status()).toBe(404);
    expect(content.status()).toBe(404);

    const proxied = await page.request.get(`/app/media/${mediaId}/content`);

    expect(proxied.status()).toBe(404);
  });
});
