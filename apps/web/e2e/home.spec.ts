import { expect, test } from "@playwright/test";

test("home exibe o hello world acessível", async ({ page }) => {
  await page.goto("/");

  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toHaveText("Olá, mundo");
  await expect(page.locator("h1")).toHaveCount(1);

  const apiLink = page.getByRole("link", { name: "Abrir a API" });
  await expect(apiLink).toHaveAttribute(
    "href",
    "http://localhost:3333/api/v1/hello",
  );
});

for (const width of [360, 768, 1280]) {
  test(`home não tem rolagem horizontal em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");

    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );

    expect(hasHorizontalScroll).toBe(false);
  });
}

test("o foco de teclado é visível no link da API", async ({ page }) => {
  await page.goto("/");

  const apiLink = page.getByRole("link", { name: "Abrir a API" });
  await apiLink.focus();

  const outlineWidth = await apiLink.evaluate(
    (element) => window.getComputedStyle(element).outlineWidth,
  );

  expect(outlineWidth).not.toBe("0px");
});
