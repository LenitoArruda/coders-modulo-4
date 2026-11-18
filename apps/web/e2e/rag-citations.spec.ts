import { expect, test, type Page } from "@playwright/test";

import {
  E2E_SIGN_IN_DOMAIN,
  E2E_SIGN_IN_PASSWORD,
} from "./support/fake-session";

const SIGN_IN_PATH = "/auth/sign-in";

function uniqueEmail(label: string): string {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  return `${label}-${suffix}@${E2E_SIGN_IN_DOMAIN}`;
}

async function signIn(page: Page): Promise<void> {
  await page.goto(SIGN_IN_PATH);
  await page.getByLabel(/^Email/).fill(uniqueEmail("rag"));
  await page.getByLabel(/^Password/).fill(E2E_SIGN_IN_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app$/);
}

async function send(page: Page, prompt: string): Promise<void> {
  await page.getByLabel("Message").fill(prompt);
  await page.getByRole("button", { name: "Send" }).click();
}

test.describe("RAG citations", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("abre o trecho citado e fecha o painel com Esc", async ({ page }) => {
    await send(page, "cite: what does the handbook say?");

    const citation = page.getByRole("button", {
      name: "Open source 1: engineering-handbook.txt",
    });
    await expect(citation).toBeVisible();
    await citation.click();

    const panel = page.getByRole("dialog");
    await expect(panel).toBeVisible();
    await expect(panel.getByText("engineering-handbook.txt")).toBeVisible();
    await expect(panel.getByText("txt · Page 7")).toBeVisible();
    await expect(panel.getByText("Page 7")).toBeVisible();
    await expect(
      panel.getByText("Ship in small batches and keep the roadmap visible."),
    ).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("mantém citações e estado da fonte após recarregar", async ({
    page,
  }) => {
    await send(page, "stale: what does the handbook say?");

    await expect(
      page.getByText("Outdated source", { exact: true }),
    ).toBeVisible();

    await page.reload();

    const citation = page.getByRole("button", {
      name: /Open source 1: engineering-handbook.txt \(outdated source\)/,
    });
    await expect(citation).toBeVisible();
    await expect(
      page.getByText("Outdated source", { exact: true }),
    ).toBeVisible();
    await citation.click();
    await expect(
      page.getByText("Outdated source: a newer version is available."),
    ).toBeVisible();
  });

  test("fonte removida mantém o texto e desabilita o link", async ({
    page,
  }) => {
    await send(page, "removed: what did the handbook say?");

    const citation = page.getByRole("button", {
      name: "Source 1 removed: engineering-handbook.txt",
    });
    await expect(citation).toBeDisabled();
    await expect(
      page.getByText("Source removed", { exact: true }),
    ).toBeVisible();

    await page.reload();
    await expect(
      page.getByRole("button", {
        name: "Source 1 removed: engineering-handbook.txt",
      }),
    ).toBeDisabled();
    await expect(
      page.getByText("Source removed", { exact: true }),
    ).toBeVisible();
  });

  test("sem trecho relevante responde sem citações", async ({ page }) => {
    await send(page, "nomatch: ask about something unrelated");

    await expect(
      page.getByText(
        "I couldn't find a basis in your connected knowledge for that question. Connect a source or try rephrasing it.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /source 1/i })).toHaveCount(
      0,
    );
  });

  test("vetorial indisponível oferece nova tentativa", async ({ page }) => {
    await send(page, "vector-down: what does the handbook say?");

    await expect(
      page.getByText("Knowledge search is unavailable right now.", {
        exact: true,
      }),
    ).toBeVisible();

    const retry = page.getByRole("button", { name: "Retry search" });
    await expect(retry).toBeVisible();
    await retry.click();

    const log = page.getByRole("log");
    await expect(
      log.getByText("vector-down: what does the handbook say?", {
        exact: true,
      }),
    ).toHaveCount(2);
  });

  test("prompt sem fontes segue no modo fatia 1", async ({ page }) => {
    await send(page, "Give me a general answer");

    await expect(
      page.getByText("As the CTO Expert, here is a focused answer."),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /source 1/i })).toHaveCount(
      0,
    );
  });
});
