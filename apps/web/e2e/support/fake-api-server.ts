import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";

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

const SIGN_UP_SUCCESS_MESSAGE = "Check your email to confirm your account.";
const FORGOT_PASSWORD_SUCCESS_MESSAGE =
  "If an account exists for this email, we sent a password reset link.";

type Body = Record<string, unknown>;

function sendJson(
  response: ServerResponse,
  status: number,
  body: unknown,
): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

function asRecord(value: unknown): Body {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Body)
    : {};
}

function readString(body: Body, key: string): string {
  const value = body[key];

  return typeof value === "string" ? value : "";
}

function readJsonBody(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];

    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        resolve(null);
      }
    });
    request.on("error", () => resolve(null));
  });
}

function signUpFieldErrors(body: Body): Body {
  const errors: Record<string, string> = {};
  const firstName = readString(body, "firstName").trim();
  const lastName = readString(body, "lastName").trim();
  const email = readString(body, "email").trim().toLowerCase();
  const password = readString(body, "password");
  const passwordConfirmation = readString(body, "passwordConfirmation");

  if (firstName.length === 0) errors.firstName = "Enter your first name.";
  else if (firstName.length > 100)
    errors.firstName = "First name must be 100 characters or fewer.";

  if (lastName.length === 0) errors.lastName = "Enter your last name.";
  else if (lastName.length > 100)
    errors.lastName = "Last name must be 100 characters or fewer.";

  if (email.length === 0) errors.email = "Enter your email address.";
  else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    errors.email = "Enter a valid email address.";

  if (password.length === 0) errors.password = "Enter a password.";
  else if (password.length < 8)
    errors.password = "Password must be at least 8 characters.";
  else if (password.length > 128)
    errors.password = "Password must be 128 characters or fewer.";

  if (passwordConfirmation.length === 0)
    errors.passwordConfirmation = "Confirm your password.";
  else if (passwordConfirmation !== password)
    errors.passwordConfirmation = "Passwords do not match.";

  return errors;
}

async function handleSignUp(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const body = asRecord(await readJsonBody(request));
  const fieldErrors = signUpFieldErrors(body);

  if (Object.keys(fieldErrors).length > 0) {
    sendJson(response, 400, {
      code: "VALIDATION_ERROR",
      message: "Check the highlighted fields and try again.",
      fieldErrors,
    });
    return;
  }

  const email = readString(body, "email").trim().toLowerCase();

  if (email === "taken@example.com") {
    sendJson(response, 409, {
      code: "EMAIL_ALREADY_CONFIRMED",
      message: "An account with this email already exists. Sign in instead.",
    });
    return;
  }

  if (email === "rate-limited@example.com") {
    response.setHeader("Retry-After", "60");
    sendJson(response, 429, {
      code: "TOO_MANY_REQUESTS",
      message: "Too many attempts. Wait a moment and try again.",
    });
    return;
  }

  if (email === "mail-failure@example.com") {
    sendJson(response, 503, {
      code: "CONFIRMATION_EMAIL_FAILED",
      message:
        "We could not send the confirmation email. Try again in a moment.",
    });
    return;
  }

  if (email === "resend@example.com") {
    sendJson(response, 200, { message: SIGN_UP_SUCCESS_MESSAGE });
    return;
  }

  sendJson(response, 201, {
    message: SIGN_UP_SUCCESS_MESSAGE,
    user: {
      id: "22222222-2222-2222-2222-222222222222",
      firstName: readString(body, "firstName").trim(),
      lastName: readString(body, "lastName").trim(),
      email,
    },
  });
}

async function handleForgotPassword(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const body = asRecord(await readJsonBody(request));
  const email = readString(body, "email").trim().toLowerCase();

  if (email.length === 0) {
    sendJson(response, 400, {
      code: "VALIDATION_ERROR",
      message: "Check the highlighted fields and try again.",
      fieldErrors: { email: "Enter your email address." },
    });
    return;
  }

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    sendJson(response, 400, {
      code: "VALIDATION_ERROR",
      message: "Check the highlighted fields and try again.",
      fieldErrors: { email: "Enter a valid email address." },
    });
    return;
  }

  if (email === "rate-limited@example.com") {
    response.setHeader("Retry-After", "60");
    sendJson(response, 429, {
      code: "TOO_MANY_REQUESTS",
      message: "Too many attempts. Wait a moment and try again.",
    });
    return;
  }

  // Every syntactically valid email gets the same generic answer, existing
  // account or not, mirroring the real API's anti-enumeration contract.
  sendJson(response, 200, { message: FORGOT_PASSWORD_SUCCESS_MESSAGE });
}

const server = createServer(async (request, response) => {
  const pathname = new URL(request.url ?? "/", `http://${host}:${port}`)
    .pathname;

  if (pathname === "/health") {
    response.writeHead(200, { "Content-Type": "text/plain" });
    response.end("ok");
    return;
  }

  if (pathname === "/api/v1/auth/sign-up" && request.method === "POST") {
    await handleSignUp(request, response);
    return;
  }

  if (
    pathname === "/api/v1/auth/forgot-password" &&
    request.method === "POST"
  ) {
    await handleForgotPassword(request, response);
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
