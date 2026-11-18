import { defineConfig, devices } from "@playwright/test";

import {
  FAKE_API_PORT,
  FAKE_API_URL,
  WEB_PORT,
  WEB_URL,
} from "./e2e/support/ports";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  // Cold `next dev` compiles of /app and sign-in Server Actions can take longer
  // than the 5 s default when the fully parallel suite shares one dev server.
  // Keep two workers and generous timeouts so a loaded machine does not produce
  // false negatives in the E2E gate.
  timeout: 90_000,
  expect: { timeout: 60_000 },
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: WEB_URL,
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "bun run e2e:fake-api",
      env: { E2E_FAKE_API_PORT: String(FAKE_API_PORT) },
      url: `${FAKE_API_URL}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: "bun run dev",
      env: { PORT: String(WEB_PORT), API_BASE_URL: FAKE_API_URL },
      url: WEB_URL,
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
