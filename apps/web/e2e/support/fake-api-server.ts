import { createServer, type ServerResponse } from "node:http";

import { E2E_VALID_SESSION_TOKEN } from "./fake-session";

/**
 * Minimal API used only by Playwright. Session validation happens on the Next
 * server, so `page.route` cannot stub it; pointing `API_BASE_URL` at this fake
 * keeps the E2E deterministic without touching the shared database.
 */
const port = Number(process.env.E2E_FAKE_API_PORT ?? 3434);
const host = "127.0.0.1";

const user = {
  id: "11111111-1111-1111-1111-111111111111",
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
};

function sendJson(
  response: ServerResponse,
  status: number,
  body: unknown,
): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

const server = createServer((request, response) => {
  const pathname = new URL(request.url ?? "/", `http://${host}:${port}`)
    .pathname;

  if (pathname === "/health") {
    response.writeHead(200, { "Content-Type": "text/plain" });
    response.end("ok");
    return;
  }

  if (pathname === "/api/v1/auth/me") {
    const authorization = request.headers.authorization;

    if (authorization === `Bearer ${E2E_VALID_SESSION_TOKEN}`) {
      sendJson(response, 200, { user });
      return;
    }

    sendJson(response, 401, {
      code: "UNAUTHORIZED",
      message: "Your session is invalid or has expired. Sign in again.",
    });
    return;
  }

  sendJson(response, 404, {
    code: "NOT_FOUND",
    message: "Resource not found.",
  });
});

server.listen(port, host, () => {
  console.log(`E2E fake API listening on http://${host}:${port}`);
});
