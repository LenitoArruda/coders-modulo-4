import { expect, test, type Page } from "@playwright/test";

import {
  E2E_SIGN_IN_DOMAIN,
  E2E_SIGN_IN_PASSWORD,
} from "./support/fake-session";

const SIGN_IN_PATH = "/auth/sign-in";
const EMPTY_MESSAGE =
  "No sources connected yet. Use the add button to connect a document.";
const UNSUPPORTED_MESSAGE =
  "Only PDF, TXT, Markdown, JPEG, PNG, MP3 or MP4 files are supported.";
const NO_SPEECH_MESSAGE = "No speech detected";
const FLAG_COOKIE = "knowledge_media_enabled";

type MediaFixture = {
  name: string;
  mimeType: string;
  buffer: Buffer;
};

type UploadKind = "image" | "audio" | "video";

function uniqueEmail(label: string): string {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  return `${label}-${suffix}@${E2E_SIGN_IN_DOMAIN}`;
}

async function signIn(page: Page, label = "media"): Promise<void> {
  await page
    .context()
    .addCookies([
      { name: FLAG_COOKIE, value: "1", url: "http://127.0.0.1:3000" },
    ]);
  await page.goto(SIGN_IN_PATH);
  await page.getByLabel(/^Email/).fill(uniqueEmail(label));
  await page.getByLabel(/^Password/).fill(E2E_SIGN_IN_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app$/);
}

function panel(page: Page) {
  return page.locator("#knowledge-sources-panel");
}

function fab(page: Page) {
  return page.locator('button[aria-controls="knowledge-sources-panel"]');
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

function mediaFile(
  name: string,
  mimeType: string,
  signature: number[],
  label: string,
): MediaFixture {
  return {
    name,
    mimeType,
    buffer: Buffer.concat([
      Buffer.from(signature),
      Buffer.from(` extracted text: ${label}`),
    ]),
  };
}

async function uploadMedia(
  page: Page,
  kind: UploadKind,
  files: MediaFixture[],
  duration?: string,
): Promise<void> {
  await panel(page).getByLabel("Source type").selectOption(kind);
  await panel(page)
    .getByLabel("Add files")
    .setInputFiles(
      files.map((file) => ({
        name: file.name,
        mimeType: file.mimeType,
        buffer: file.buffer,
      })),
    );
  if (duration !== undefined) {
    await panel(page).getByLabel("Duration (seconds)").fill(duration);
  }
  await panel(page).getByRole("button", { name: "Connect files" }).click();
}

const PNG = mediaFile(
  "manual.png",
  "image/png",
  [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  "manual",
);
const MP3 = mediaFile(
  "meeting.mp3",
  "audio/mpeg",
  [0x49, 0x44, 0x33],
  "meeting",
);
const MP4 = mediaFile(
  "demo.mp4",
  "video/mp4",
  [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d],
  "demo",
);

test.describe("knowledge media", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("a flag desligada esconde a seleção de mídia", async ({ page }) => {
    await page.context().clearCookies();
    await signIn(page, "media-off");
    await page
      .context()
      .addCookies([
        { name: FLAG_COOKIE, value: "0", url: "http://127.0.0.1:3000" },
      ]);
    await page.reload();

    await openPanel(page);

    await expect(panel(page).getByLabel("Source type")).toHaveCount(0);
    await expect(panel(page).getByLabel("Add files")).toBeVisible();
    await expect(
      panel(page).getByRole("button", { name: "Connect files" }),
    ).toBeVisible();
  });

  test("imagem PNG passa pelas fases e termina pronta", async ({ page }) => {
    await openPanel(page);
    await uploadMedia(page, "image", [PNG]);

    const item = sourceItem(page, "manual.png");
    await expect(item).toContainText("Processing");
    await expect(item).toContainText(
      /Extracting text|Chunking text|Creating embeddings/,
    );
    await expect(item).toContainText("Ready", { timeout: 15_000 });
    await expect(item).toContainText("IMAGE");
    await expect(item).toContainText(/chunks/);
  });

  test("áudio MP3 com duração é transcrito e indexado", async ({ page }) => {
    await openPanel(page);
    await uploadMedia(page, "audio", [MP3], "120");

    const item = sourceItem(page, "meeting.mp3");
    await expect(item).toContainText("Processing");
    await expect(item).toContainText("Ready", { timeout: 15_000 });
    await expect(item).toContainText("AUDIO");
  });

  test("vídeo MP4 é transcrito e indexado", async ({ page }) => {
    await openPanel(page);
    await uploadMedia(page, "video", [MP4], "90");

    const item = sourceItem(page, "demo.mp4");
    await expect(item).toContainText("Processing");
    await expect(item).toContainText("Ready", { timeout: 15_000 });
    await expect(item).toContainText("VIDEO");
  });

  test("reenviar a mesma mídia informa Already connected sem duplicar", async ({
    page,
  }) => {
    await openPanel(page);
    await uploadMedia(page, "image", [PNG]);
    await expect(sourceItem(page, "manual.png")).toContainText("Ready", {
      timeout: 15_000,
    });

    await uploadMedia(page, "image", [PNG]);

    await expect(panel(page).getByRole("status")).toContainText(
      "Already connected",
    );
    await expect(sourceItems(page)).toHaveCount(1);
  });

  test("arquivo não suportado lista todos os formatos aceitos", async ({
    page,
  }) => {
    await openPanel(page);
    await panel(page).getByLabel("Source type").selectOption("image");
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

  test("áudio sem fala falha com No speech detected e Try again", async ({
    page,
  }) => {
    const silent = mediaFile(
      "silent.mp3",
      "audio/mpeg",
      [0x49, 0x44, 0x33],
      "silent",
    );

    await openPanel(page);
    await uploadMedia(page, "audio", [silent]);

    const item = sourceItem(page, "silent.mp3");
    await expect(item).toContainText("Failed");
    await expect(item).toContainText(NO_SPEECH_MESSAGE);

    const retry = item.getByRole("button", { name: "Try again" });
    expect((await retry.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    await retry.click();

    await expect(panel(page).getByRole("status")).toContainText(
      "Retry started.",
    );
    await expect(item).toContainText("Ready");
  });

  test("mídia é isolada por usuário autenticado", async ({ page }) => {
    await openPanel(page);
    await uploadMedia(page, "image", [PNG]);
    await expect(sourceItem(page, "manual.png")).toContainText("Ready", {
      timeout: 15_000,
    });

    await page.context().clearCookies();
    await signIn(page, "other-media");

    await openPanel(page);
    await expect(panel(page).getByText(EMPTY_MESSAGE)).toBeVisible();
    await expect(sourceItems(page)).toHaveCount(0);
  });

  test("seleção de tipo e duração são alcançáveis por teclado", async ({
    page,
  }) => {
    await openPanel(page);

    const select = panel(page).getByLabel("Source type");
    await select.focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");

    await expect(select).toHaveValue("audio");
    await page.keyboard.press("Tab");

    expect(await page.evaluate(() => document.activeElement?.id ?? "")).toBe(
      "knowledge-source-duration",
    );

    const duration = panel(page).getByLabel("Duration (seconds)");
    await duration.fill("3601");
    await panel(page)
      .getByLabel("Add files")
      .setInputFiles([
        {
          name: "long.mp3",
          mimeType: "audio/mpeg",
          buffer: Buffer.concat([
            Buffer.from([0x49, 0x44, 0x33]),
            Buffer.from("long"),
          ]),
        },
      ]);
    await panel(page).getByRole("button", { name: "Connect files" }).click();

    await expect(panel(page).getByRole("alert")).toContainText(
      "Media longer than 60 minutes is not supported. Try a shorter file.",
    );
    await expect(sourceItems(page)).toHaveCount(0);
  });

  test("painel com mídia não tem rolagem horizontal em 360px", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/app");

    await openPanel(page);
    await panel(page).getByLabel("Source type").selectOption("video");

    await expect(panel(page).getByLabel("Duration (seconds)")).toBeVisible();
    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );

    expect(hasHorizontalScroll).toBe(false);
  });
});
