import { createHash } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import {
  E2E_SIGN_IN_DOMAIN,
  E2E_SIGN_IN_PASSWORD,
} from "./support/fake-session";

const SIGN_IN_PATH = "/auth/sign-in";
const EMPTY_MESSAGE =
  "No sources connected yet. Use the add button to connect a document.";
const UNSUPPORTED_MESSAGE = "Only PDF, TXT or Markdown files are supported.";

type FakeFile = {
  name: string;
  mimeType: string;
  content: string;
};

/** Each test signs in with its own account so source state stays isolated. */
function uniqueEmail(label: string): string {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  return `${label}-${suffix}@${E2E_SIGN_IN_DOMAIN}`;
}

async function signIn(page: Page, label = "sources"): Promise<void> {
  await page.goto(SIGN_IN_PATH);
  await page.getByLabel(/^Email/).fill(uniqueEmail(label));
  await page.getByLabel(/^Password/).fill(E2E_SIGN_IN_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app$/);
}

function fab(page: Page) {
  return page.locator('button[aria-controls="knowledge-sources-panel"]');
}

function panel(page: Page) {
  return page.locator("#knowledge-sources-panel");
}

function sourceItems(page: Page) {
  return panel(page).locator("ul li");
}

function sourceItem(page: Page, name: string) {
  return sourceItems(page).filter({ hasText: name });
}

async function openPanel(page: Page): Promise<void> {
  await fab(page).click();
  await expect(panel(page)).toBeVisible();
}

async function upload(page: Page, files: FakeFile[]): Promise<void> {
  await panel(page)
    .getByLabel("Add files")
    .setInputFiles(
      files.map((file) => ({
        name: file.name,
        mimeType: file.mimeType,
        buffer: Buffer.from(file.content, "utf8"),
      })),
    );
  await panel(page).getByRole("button", { name: "Connect files" }).click();
}

async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const hasHorizontalScroll = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );

  expect(hasHorizontalScroll).toBe(false);
}

test.describe("knowledge sources", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("botão flutuante abre o painel e mostra o estado vazio", async ({
    page,
  }) => {
    await expect(fab(page)).toBeVisible();
    await expect(fab(page)).toHaveAttribute("aria-expanded", "false");
    expect((await fab(page).boundingBox())?.width).toBeGreaterThanOrEqual(44);

    await openPanel(page);

    await expect(fab(page)).toHaveAttribute("aria-expanded", "true");
    await expect(
      panel(page).getByRole("heading", { name: "Knowledge sources" }),
    ).toBeVisible();
    await expect(panel(page).getByText(EMPTY_MESSAGE)).toBeVisible();
  });

  test("envia PDF, TXT e Markdown e mostra status, tamanho e chunks", async ({
    page,
  }) => {
    await openPanel(page);
    await upload(page, [
      {
        name: "guide.pdf",
        mimeType: "application/pdf",
        content: "%PDF-1.4 local knowledge guide",
      },
      {
        name: "notes.txt",
        mimeType: "text/plain",
        content: "Operational notes for the platform team.",
      },
      {
        name: "runbook.md",
        mimeType: "text/markdown",
        content: "# Runbook\nRestart the local services.",
      },
    ]);

    const notice = panel(page).getByRole("status");
    await expect(notice).toContainText("guide.pdf: Processing");
    await expect(notice).toContainText("notes.txt: Processing");
    await expect(notice).toContainText("runbook.md: Processing");

    await expect(sourceItems(page)).toHaveCount(3);
    for (const name of ["guide.pdf", "notes.txt", "runbook.md"]) {
      const item = sourceItem(page, name);
      await expect(item).toContainText("Ready");
      await expect(item).toContainText(/chunks/);
      await expect(item).toContainText(/\d+ B/);
    }
    await expect(sourceItem(page, "notes.txt")).toContainText("TXT");
    await expect(sourceItem(page, "runbook.md")).toContainText("MARKDOWN");
    await expect(sourceItem(page, "guide.pdf")).toContainText("PDF");
  });

  test("reenviar o mesmo conteúdo informa Already connected sem duplicar", async ({
    page,
  }) => {
    const file: FakeFile = {
      name: "policy.txt",
      mimeType: "text/plain",
      content: "Policy version one with explicit context.",
    };

    await openPanel(page);
    await upload(page, [file]);
    await expect(sourceItem(page, "policy.txt")).toContainText("Ready");

    await upload(page, [file]);

    await expect(panel(page).getByRole("status")).toContainText(
      "Already connected",
    );
    await expect(sourceItems(page)).toHaveCount(1);
  });

  test("arquivo com o mesmo nome e conteúdo diferente cria nova versão", async ({
    page,
  }) => {
    await openPanel(page);
    await upload(page, [
      {
        name: "release.txt",
        mimeType: "text/plain",
        content: "Release notes for version one.",
      },
    ]);
    await expect(sourceItem(page, "release.txt")).toContainText("Ready");

    await upload(page, [
      {
        name: "release.txt",
        mimeType: "text/plain",
        content: "Release notes for version two with new decisions.",
      },
    ]);

    await expect(sourceItems(page)).toHaveCount(1);
    await expect(sourceItem(page, "release.txt")).toContainText("v2");
    await expect(sourceItem(page, "release.txt")).toContainText("Ready");
  });

  test("arquivo pendente faz polling até ficar ready", async ({ page }) => {
    await openPanel(page);
    await upload(page, [
      {
        name: "pending.txt",
        mimeType: "text/plain",
        content: "This document finishes asynchronously.",
      },
    ]);

    await expect(panel(page).getByRole("status")).toContainText(
      "pending.txt: Processing",
    );
    await expect(sourceItem(page, "pending.txt")).toContainText("Processing");
    await expect(sourceItem(page, "pending.txt")).toContainText("Ready", {
      timeout: 15_000,
    });
  });

  test("arquivo de tipo não suportado é recusado com os formatos aceitos", async ({
    page,
  }) => {
    await openPanel(page);
    await panel(page)
      .getByLabel("Add files")
      .setInputFiles([
        {
          name: "payload.exe",
          mimeType: "application/octet-stream",
          buffer: Buffer.from("MZ"),
        },
      ]);
    await panel(page).getByRole("button", { name: "Connect files" }).click();

    await expect(panel(page).getByRole("alert")).toContainText(
      UNSUPPORTED_MESSAGE,
    );
    await expect(panel(page).getByText(EMPTY_MESSAGE)).toBeVisible();
    await expect(sourceItems(page)).toHaveCount(0);
  });

  test("falha de indexação permite retry e a fonte pode ser removida", async ({
    page,
  }) => {
    await openPanel(page);
    await upload(page, [
      {
        name: "broken.txt",
        mimeType: "text/plain",
        content: "A document that cannot be indexed right now.",
      },
    ]);

    const item = sourceItem(page, "broken.txt");
    await expect(item).toContainText("Failed");

    const retry = item.getByRole("button", { name: "Retry" });
    expect((await retry.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    await retry.click();

    await expect(panel(page).getByRole("status")).toContainText(
      "Retry started.",
    );
    await expect(item).toContainText("Ready");
    await expect(item).toContainText(/chunks/);

    await item.getByRole("button", { name: "Remove" }).click();

    await expect(panel(page).getByRole("status")).toContainText(
      "Source removed.",
    );
    await expect(panel(page).getByText(EMPTY_MESSAGE)).toBeVisible();
    await expect(sourceItems(page)).toHaveCount(0);
  });

  test("fontes são isoladas por usuário autenticado", async ({ page }) => {
    const content = "Context that belongs to the first account.";

    await openPanel(page);
    await upload(page, [
      { name: "private.txt", mimeType: "text/plain", content },
    ]);
    await expect(sourceItem(page, "private.txt")).toContainText("Ready");

    await page.context().clearCookies();
    await signIn(page, "other-sources");

    await openPanel(page);
    await expect(panel(page).getByText(EMPTY_MESSAGE)).toBeVisible();
    await expect(sourceItems(page)).toHaveCount(0);
  });

  test("conteúdo e hash não aparecem no armazenamento nem no console do cliente", async ({
    page,
  }) => {
    const content = "CONFIDENTIAL_SENTENCE_9f2c4b1d";
    const hash = createHash("sha256").update(content).digest("hex");
    const consoleLines: string[] = [];

    page.on("console", (message) => consoleLines.push(message.text()));

    await openPanel(page);
    await upload(page, [
      { name: "private.txt", mimeType: "text/plain", content },
    ]);
    await expect(sourceItem(page, "private.txt")).toContainText("Ready");

    const client = await page.evaluate(() => ({
      cookie: document.cookie,
      local: JSON.stringify(window.localStorage),
      session: JSON.stringify(window.sessionStorage),
    }));
    const clientData = client.cookie + client.local + client.session;
    const logs = consoleLines.join("\n");

    expect(clientData).not.toContain(content);
    expect(clientData).not.toContain(hash);
    expect(clientData).not.toContain("signin-");
    expect(logs).not.toContain(content);
    expect(logs).not.toContain(hash);
  });

  test("painel é operável por teclado com foco visível nos controles", async ({
    page,
  }) => {
    await fab(page).focus();
    await page.keyboard.press("Enter");

    await expect(panel(page)).toBeVisible();
    await expect(fab(page)).toHaveAttribute("aria-expanded", "true");

    await panel(page)
      .getByRole("button", { name: "Close knowledge sources" })
      .focus();
    await page.keyboard.press("Tab");

    expect(await page.evaluate(() => document.activeElement?.id ?? "")).toBe(
      "knowledge-source-files",
    );

    const submit = panel(page).getByRole("button", { name: "Connect files" });
    await submit.focus();
    await page.keyboard.press("Enter");

    await expect(panel(page).getByRole("alert")).toContainText(
      "Choose at least one PDF, TXT or Markdown file.",
    );
  });

  for (const width of [360, 768, 1280]) {
    test(`painel não tem rolagem horizontal em ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/app");

      await openPanel(page);

      await expect(panel(page).getByLabel("Add files")).toBeVisible();
      await expect(
        panel(page).getByRole("button", { name: "Connect files" }),
      ).toBeVisible();
      expect((await fab(page).boundingBox())?.width).toBeGreaterThanOrEqual(44);
      await expectNoHorizontalScroll(page);
    });
  }
});
