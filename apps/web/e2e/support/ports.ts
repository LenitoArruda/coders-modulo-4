/**
 * Isolated E2E ports. Defaults preserve the historical 3000/3434 pair; worktrees can set
 * E2E_WEB_PORT and E2E_FAKE_API_PORT to run suites in parallel without collisions.
 */
function readPort(name: string, fallback: number): number {
  const raw = process.env[name];

  if (raw === undefined || raw === "") return fallback;

  const port = Number(raw);

  return Number.isInteger(port) && port > 0 && port < 65_536 ? port : fallback;
}

export const WEB_PORT = readPort("E2E_WEB_PORT", 3000);
export const FAKE_API_PORT = readPort("E2E_FAKE_API_PORT", 3434);
export const WEB_URL = `http://127.0.0.1:${WEB_PORT}`;
export const FAKE_API_URL = `http://127.0.0.1:${FAKE_API_PORT}`;
