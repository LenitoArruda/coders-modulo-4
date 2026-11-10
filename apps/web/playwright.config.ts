import { defineConfig, devices } from "@playwright/test";

const fakeApiPort = 3434;
const fakeApiUrl = `http://127.0.0.1:${fakeApiPort}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "bun run e2e:fake-api",
      env: { E2E_FAKE_API_PORT: String(fakeApiPort) },
      url: `${fakeApiUrl}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: "bun run dev",
      env: { API_BASE_URL: fakeApiUrl },
      url: "http://127.0.0.1:3000",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
