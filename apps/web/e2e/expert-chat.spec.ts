import { expect, test, type Page } from "@playwright/test";

import {
  E2E_SIGN_IN_DOMAIN,
  E2E_SIGN_IN_PASSWORD,
} from "./support/fake-session";
import { FAKE_EXPERTS } from "./support/fake-experts";

const SIGN_IN_PATH = "/auth/sign-in";

/** Each test signs in with its own account so transcripts stay isolated. */
function uniqueEmail(label: string): string {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  return `${label}-${suffix}@${E2E_SIGN_IN_DOMAIN}`;
}

async function signIn(page: Page): Promise<void> {
  await page.goto(SIGN_IN_PATH);
  await page.getByLabel(/^Email/).fill(uniqueEmail("chat"));
  await page.getByLabel(/^Password/).fill(E2E_SIGN_IN_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app$/);
}

function expertSelect(page: Page) {
  return page.getByLabel("Expert", { exact: true });
}

function messageBox(page: Page) {
  return page.getByLabel("Message");
}

function conversation(page: Page) {
  return page.getByRole("log");
}

async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const hasHorizontalScroll = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );

  expect(hasHorizontalScroll).toBe(false);
}

test.describe("expert chat", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("catálogo mostra os nove Experts na ordem do produto", async ({
    page,
  }) => {
    const options = await expertSelect(page)
      .locator("option")
      .allTextContents();

    expect(options).toEqual(FAKE_EXPERTS.map((expert) => expert.name));
    await expect(expertSelect(page)).toHaveValue("cto");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Welcome, Ada",
    );
  });

  test("trocar de Expert atualiza escopo, papel e sugestões", async ({
    page,
  }) => {
    await expertSelect(page).selectOption("cmo");

    await expect(
      page.getByText("CMO Expert —", { exact: false }),
    ).toBeVisible();
    await expect(page.getByText("Marketing & Brand")).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Draft a campaign brief for our next launch.",
      }),
    ).toBeVisible();
  });

  test("clicar em uma sugestão envia exatamente o texto", async ({ page }) => {
    const suggestion = FAKE_EXPERTS[0]?.suggestions[0];

    expect(suggestion).toBeDefined();
    await page.getByRole("button", { name: suggestion }).click();

    const log = conversation(page);
    await expect(log.getByText(suggestion!, { exact: true })).toBeVisible();
    await expect(log.getByText("You", { exact: true })).toBeVisible();
    await expect(
      log.getByText("As the CTO Expert, here is a focused answer."),
    ).toBeVisible();
  });

  test("mensagem digitada recebe resposta e persiste após recarregar", async ({
    page,
  }) => {
    const prompt = "What should be in the next engineering roadmap?";

    await messageBox(page).fill(prompt);
    await page.getByRole("button", { name: "Send" }).click();

    const log = conversation(page);
    await expect(log.getByText(prompt, { exact: true })).toBeVisible();
    await expect(
      log.getByText("As the CTO Expert, here is a focused answer."),
    ).toBeVisible();

    await page.reload();

    await expect(
      conversation(page).getByText(prompt, { exact: true }),
    ).toBeVisible();
    await expect(
      conversation(page).getByText(
        "As the CTO Expert, here is a focused answer.",
      ),
    ).toBeVisible();
  });

  test("prompt vazio mostra erro e não envia mensagem", async ({ page }) => {
    await page.getByRole("button", { name: "Send" }).click();

    await expect(
      page.getByText("Enter a message before sending."),
    ).toBeVisible();
    await expect(
      conversation(page).getByText("You", { exact: true }),
    ).toHaveCount(0);
  });

  test("falha do modelo mostra erro acionável, mantém o prompt e permite retry", async ({
    page,
  }) => {
    await messageBox(page).fill("please fail this request");
    await page.getByRole("button", { name: "Send" }).click();

    await expect(
      page
        .locator('form [role="alert"]')
        .getByText(
          "The Expert could not respond right now. Try again in a moment.",
        ),
    ).toBeVisible();
    await expect(messageBox(page)).toHaveValue("please fail this request");
    await expect(
      conversation(page).getByText("You", { exact: true }),
    ).toHaveCount(0);

    await messageBox(page).fill("Give me a summary");
    await page.getByRole("button", { name: "Send" }).click();

    await expect(
      conversation(page).getByText("Give me a summary", { exact: true }),
    ).toBeVisible();
    await expect(
      page
        .locator('form [role="alert"]')
        .getByText(
          "The Expert could not respond right now. Try again in a moment.",
        ),
    ).toHaveCount(0);
  });

  test("histórico é isolado por usuário autenticado", async ({ page }) => {
    const prompt = "A conversation that belongs only to this account.";
    await messageBox(page).fill(prompt);
    await page.getByRole("button", { name: "Send" }).click();
    await expect(
      conversation(page).getByText(prompt, { exact: true }),
    ).toBeVisible();

    // A different session must not see this transcript.
    await page.context().clearCookies();
    await signIn(page);

    await expect(
      conversation(page).getByText(prompt, { exact: true }),
    ).toHaveCount(0);
  });

  test("o token de sessão nunca chega ao cliente", async ({ page }) => {
    const clientStorage = await page.evaluate(() => ({
      cookie: document.cookie,
      local: JSON.stringify(window.localStorage),
      session: JSON.stringify(window.sessionStorage),
    }));

    expect(clientStorage.cookie).not.toContain("session_token");
    expect(clientStorage.local + clientStorage.session).not.toContain(
      "signin-",
    );
  });

  test("logout encerra a sessão e volta para o sign-in", async ({ page }) => {
    await page.getByRole("button", { name: "Sign out" }).click();

    await expect(page).toHaveURL(/\/auth\/sign-in$/);
    await page.goto("/app");
    await expect(page).toHaveURL(/\/auth\/sign-in$/);
  });

  for (const width of [360, 768, 1280]) {
    test(`chat não tem rolagem horizontal em ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/app");

      await expect(expertSelect(page)).toBeVisible();
      await expectNoHorizontalScroll(page);
    });
  }
});
