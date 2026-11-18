import { createHash } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { isIP } from "node:net";

import {
  E2E_CONFIRM_RATE_LIMITED_TOKEN,
  E2E_CONFIRM_TOKEN,
  E2E_CONFIRM_USED_TOKEN,
  E2E_RESET_RATE_LIMITED_TOKEN,
  E2E_RESET_TOKEN_PREFIX,
  E2E_SIGN_IN_DOMAIN,
  E2E_SIGN_IN_PASSWORD,
  E2E_VALID_SESSION_TOKEN,
} from "./fake-session";
import { FAKE_EXPERTS } from "./fake-experts";

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

const CONFIRM_INVALID_MESSAGE =
  "This confirmation link is invalid or has expired.";
const CONFIRM_ALREADY_CONFIRMED_MESSAGE =
  "This account is already confirmed. Sign in instead.";
const CONFIRM_RATE_LIMITED_MESSAGE =
  "Too many attempts. Wait a moment and try again.";

const SIGN_IN_INVALID_MESSAGE = "Invalid email or password.";
const SIGN_IN_NOT_CONFIRMED_MESSAGE =
  "Please confirm your email before signing in.";

type Body = Record<string, unknown>;

/**
 * Stateful single-session policy for sign-in: only the latest token issued to
 * each `<local>@signin.example.com` account is accepted by `/me`, mirroring
 * the real API where a new session revokes the previous one. Each E2E test
 * uses its own local part, so parallel tests never invalidate each other.
 */
const latestSignInSession = new Map<string, number>();

/** Passwords changed by a successful reset, per `<local>` of the sign-in account. */
const passwordByLocal = new Map<string, string>();

/** Reset tokens already consumed: a token works exactly once. */
const usedResetTokens = new Set<string>();

const RESET_PASSWORD_SUCCESS_MESSAGE =
  "Your password has been updated. Sign in with your new password.";
const RESET_PASSWORD_INVALID_MESSAGE =
  "This password reset link is invalid or has expired.";

function signInTokenOwner(token: string): { local: string; n: number } | null {
  const match = /^signin-(.+)-(\d+)$/.exec(token);

  return match === null ? null : { local: match[1] ?? "", n: Number(match[2]) };
}

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

type ChatMessage = {
  id: string;
  role: "user" | "expert";
  content: string;
  createdAt: string;
};

type StoredConversation = {
  conversationId: string;
  messages: ChatMessage[];
};

/**
 * Transcripts are keyed by session token and Expert, so every E2E test (which
 * signs in with a unique account) sees only its own history. State lives only
 * for the lifetime of the fake API process.
 */
const storedConversations = new Map<string, StoredConversation>();
let chatSequence = 0;

function bearerToken(request: IncomingMessage): string {
  return (request.headers.authorization ?? "").replace(/^Bearer /, "");
}

function isAuthenticated(request: IncomingMessage): boolean {
  const token = bearerToken(request);

  if (token === E2E_VALID_SESSION_TOKEN) {
    return true;
  }

  const owner = signInTokenOwner(token);

  return owner !== null && latestSignInSession.get(owner.local) === owner.n;
}

function unauthorized(response: ServerResponse): void {
  sendJson(response, 401, {
    code: "UNAUTHORIZED",
    message: "Your session is invalid or has expired. Sign in again.",
  });
}

function conversationKey(token: string, expertId: string): string {
  return `${token}|${expertId}`;
}

function nextChatId(prefix: string): string {
  chatSequence += 1;

  return `${prefix}-${chatSequence}`;
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

async function handleConfirm(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const body = asRecord(await readJsonBody(request));
  const token = readString(body, "token").trim();

  if (token === E2E_CONFIRM_TOKEN) {
    sendJson(response, 200, {
      accessToken: E2E_VALID_SESSION_TOKEN,
      tokenType: "Bearer",
      expiresIn: 604_800,
      user,
    });
    return;
  }

  if (token === E2E_CONFIRM_USED_TOKEN) {
    sendJson(response, 409, {
      code: "ACCOUNT_ALREADY_CONFIRMED",
      message: CONFIRM_ALREADY_CONFIRMED_MESSAGE,
    });
    return;
  }

  if (token === E2E_CONFIRM_RATE_LIMITED_TOKEN) {
    response.setHeader("Retry-After", "60");
    sendJson(response, 429, {
      code: "TOO_MANY_REQUESTS",
      message: CONFIRM_RATE_LIMITED_MESSAGE,
    });
    return;
  }

  sendJson(response, 400, {
    code: "INVALID_CONFIRMATION_TOKEN",
    message: CONFIRM_INVALID_MESSAGE,
  });
}

async function handleSignIn(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const body = asRecord(await readJsonBody(request));
  const email = readString(body, "email").trim().toLowerCase();
  const password = readString(body, "password");
  const local = email.slice(0, Math.max(email.indexOf("@"), 0));

  if (email === "rate-limited@example.com") {
    response.setHeader("Retry-After", "60");
    sendJson(response, 429, {
      code: "TOO_MANY_REQUESTS",
      message: "Too many attempts. Wait a moment and try again.",
    });
    return;
  }

  // Like the real API, 403 only follows a correct password.
  if (email === "unconfirmed@example.com") {
    if (password === E2E_SIGN_IN_PASSWORD) {
      sendJson(response, 403, {
        code: "EMAIL_NOT_CONFIRMED",
        message: SIGN_IN_NOT_CONFIRMED_MESSAGE,
      });
      return;
    }
  }

  if (email === "server-error@example.com") {
    sendJson(response, 500, {
      code: "INTERNAL_SERVER_ERROR",
      message: "Internal server error.",
    });
    return;
  }

  if (
    password !== (passwordByLocal.get(local) ?? E2E_SIGN_IN_PASSWORD) ||
    !email.endsWith(`@${E2E_SIGN_IN_DOMAIN}`)
  ) {
    sendJson(response, 401, {
      code: "INVALID_CREDENTIALS",
      message: SIGN_IN_INVALID_MESSAGE,
    });
    return;
  }

  const n = (latestSignInSession.get(local) ?? 0) + 1;

  latestSignInSession.set(local, n);
  sendJson(response, 200, {
    accessToken: `signin-${local}-${n}`,
    tokenType: "Bearer",
    expiresIn: 604_800,
    user: { ...user, email },
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

function resetTokenOwner(token: string): string | null {
  const match = /^reset-token:([^:]+):[^:]+$/.exec(token);

  return match === null ? null : (match[1] ?? null);
}

/**
 * Mirrors the real contract: rate limit first, then password validation (which
 * never burns the token), then the single-use token. A successful reset
 * changes the password and revokes every session of the account.
 */
async function handleResetPassword(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const body = asRecord(await readJsonBody(request));
  const token = readString(body, "token").trim();
  const password = readString(body, "password");
  const passwordConfirmation = readString(body, "passwordConfirmation");

  if (token === E2E_RESET_RATE_LIMITED_TOKEN) {
    response.setHeader("Retry-After", "60");
    sendJson(response, 429, {
      code: "TOO_MANY_REQUESTS",
      message: "Too many attempts. Wait a moment and try again.",
    });
    return;
  }

  const fieldErrors: Record<string, string> = {};

  if (password.length === 0) fieldErrors.password = "Enter a password.";
  else if (password.length < 8)
    fieldErrors.password = "Password must be at least 8 characters.";
  else if (password.length > 128)
    fieldErrors.password = "Password must be 128 characters or fewer.";

  if (passwordConfirmation.length === 0)
    fieldErrors.passwordConfirmation = "Confirm your password.";
  else if (passwordConfirmation !== password || fieldErrors.password)
    fieldErrors.passwordConfirmation = "Passwords do not match.";

  if (Object.keys(fieldErrors).length > 0) {
    sendJson(response, 400, {
      code: "VALIDATION_ERROR",
      message: "Check the highlighted fields and try again.",
      fieldErrors,
    });
    return;
  }

  const local = token.startsWith(E2E_RESET_TOKEN_PREFIX)
    ? resetTokenOwner(token)
    : null;

  if (local === null || usedResetTokens.has(token)) {
    sendJson(response, 400, {
      code: "INVALID_RESET_TOKEN",
      message: RESET_PASSWORD_INVALID_MESSAGE,
    });
    return;
  }

  usedResetTokens.add(token);
  passwordByLocal.set(local, password);
  // Revoke every issued session: only a token newer than the last one is valid.
  latestSignInSession.set(local, (latestSignInSession.get(local) ?? 0) + 1);
  sendJson(response, 200, { message: RESET_PASSWORD_SUCCESS_MESSAGE });
}

type SourceType = "pdf" | "txt" | "markdown";
type SourceStatus = "queued" | "processing" | "ready" | "failed";

type UploadedFile = {
  originalName: string;
  mimeType: string;
  buffer: Buffer;
};

type FakeSourceVersion = {
  id: string;
  contentHash: string;
  name: string;
  type: SourceType;
  byteSize: number;
  status: SourceStatus;
  chunkCount: number;
  createdAt: string;
  polls: number;
  url?: string;
  errorMessage?: string;
};

type FakeSource = {
  id: string;
  normalizedName: string;
  currentVersionId: string;
  versions: FakeSourceVersion[];
};

type FakeSourceSummary = {
  id: string;
  name: string;
  type: SourceType;
  byteSize: number;
  status: SourceStatus;
  versionId: string;
  versionNumber: number;
  chunkCount: number;
  isStale: boolean;
  createdAt: string;
  url?: string;
  errorMessage?: string;
};

type FakePageKind = "text" | "no-text" | "unavailable";

type FakePage = {
  title: string;
  text: string;
  kind: FakePageKind;
};

const MAX_FAKE_SOURCE_FILE_BYTES = 10 * 1024 * 1024;
const MAX_FAKE_SOURCE_FILES = 5;

const UNSUPPORTED_SOURCE_MESSAGE =
  "Only PDF, TXT or Markdown files are supported.";
const TOO_MANY_SOURCES_MESSAGE =
  "Too many files. Send up to 5 files at a time.";
const EMPTY_SOURCE_MESSAGE = "The file has no text we can index.";
const SOURCE_TOO_LARGE_MESSAGE =
  "One of the files is too large. Try a smaller file.";
const SOURCE_NOT_FOUND_MESSAGE = "That source is no longer available.";
const SOURCE_VERSION_NOT_FOUND_MESSAGE = "That version is no longer available.";
const INVALID_URL_MESSAGE =
  "Enter a valid public HTTP or HTTPS URL (255 characters or fewer).";
const BLOCKED_URL_MESSAGE =
  "That address is not allowed. Use a public HTTP or HTTPS link.";
const NO_TEXT_URL_MESSAGE =
  "That page has no text we can index. Try another URL or upload a file.";
const UNAVAILABLE_URL_MESSAGE =
  "We could not load that page. Check the address and try again.";

/** Source state is keyed by session token so parallel E2E tests stay isolated. */
const sourcesByToken = new Map<string, FakeSource[]>();
/** Fake page contents, keyed by normalized URL; tests may update them. */
const fakePages = new Map<string, FakePage>();
let sourceSequence = 0;

function nextSourceId(prefix: string): string {
  sourceSequence += 1;

  return `${prefix}-${sourceSequence}`;
}

function tokenSources(token: string): FakeSource[] {
  let sources = sourcesByToken.get(token);

  if (sources === undefined) {
    sources = [];
    sourcesByToken.set(token, sources);
  }

  return sources;
}

const FAKE_TRACKING_PARAMS = new Set([
  "fbclid",
  "gclid",
  "igshid",
  "mc_cid",
  "mc_eid",
  "msclkid",
  "ref",
  "ref_src",
  "source",
]);

/** Mirrors the API's public-URL normalization closely enough for E2E. */
function normalizeFakeSourceUrl(input: string): string | null {
  const trimmed = input.trim();

  if (trimmed.length === 0 || trimmed.length > 255 || /\s/.test(trimmed)) {
    return null;
  }

  let parsed: URL;

  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (
    (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
    parsed.hostname === "" ||
    parsed.username !== "" ||
    parsed.password !== ""
  ) {
    return null;
  }

  for (const key of Array.from(parsed.searchParams.keys())) {
    const lower = key.toLowerCase();

    if (lower.startsWith("utm_") || FAKE_TRACKING_PARAMS.has(lower)) {
      parsed.searchParams.delete(key);
    }
  }

  parsed.host = parsed.host.toLowerCase();
  parsed.hash = "";

  let normalized = parsed.toString();

  if (normalized.endsWith("/") && parsed.pathname === "/") {
    normalized = normalized.slice(0, -1);
  }

  return normalized.length > 0 && normalized.length <= 255 ? normalized : null;
}

function isBlockedFakeHost(hostname: string): boolean {
  const normalized = hostname
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "");

  if (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".cluster.local") ||
    normalized.endsWith(".svc") ||
    normalized === "metadata" ||
    normalized === "metadata.google.internal" ||
    normalized === "metadata.goog" ||
    normalized === "instance-data" ||
    normalized === "kubernetes.default.svc"
  ) {
    return true;
  }

  if (isIP(normalized) === 0) return false;

  if (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("0.") ||
    normalized.startsWith("10.") ||
    normalized.startsWith("127.") ||
    normalized.startsWith("169.254.") ||
    normalized.startsWith("192.168.") ||
    normalized.startsWith("192.0.")
  ) {
    return true;
  }

  const parts = normalized.split(".");
  const second = parts.length > 1 ? Number(parts[1]) : 0;

  return normalized.startsWith("172.") && second >= 16 && second <= 31;
}

function fakePageTitle(url: string): string {
  const parsed = new URL(url);
  const segment =
    decodeURIComponent(parsed.pathname).split("/").filter(Boolean).pop() ??
    parsed.hostname;
  const titled = segment
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

  return titled === "" ? parsed.hostname : titled;
}

function fakePageFor(url: string): FakePage {
  const configured = fakePages.get(url);

  if (configured !== undefined) return configured;

  const title = fakePageTitle(url);

  return { title, text: `${title}: public knowledge page.`, kind: "text" };
}

function readRawBody(request: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];

    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", () => resolve(Buffer.alloc(0)));
  });
}

/** Minimal multipart reader for the browser's `FormData` upload payload. */
async function readMultipartFiles(
  request: IncomingMessage,
): Promise<UploadedFile[]> {
  const contentType = request.headers["content-type"] ?? "";
  const boundaryMatch = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  const boundary = (boundaryMatch?.[1] ?? boundaryMatch?.[2] ?? "").trim();

  if (boundary === "") return [];

  const raw = await readRawBody(request);
  const delimiter = Buffer.from(`--${boundary}`);
  const files: UploadedFile[] = [];
  let cursor = raw.indexOf(delimiter);

  while (cursor >= 0) {
    const partStart = cursor + delimiter.length;
    const next = raw.indexOf(delimiter, partStart);

    if (next < 0) break;

    let part = raw.subarray(partStart, next);

    if (part[0] === 13 && part[1] === 10) part = part.subarray(2);
    if (part[part.length - 2] === 13 && part[part.length - 1] === 10) {
      part = part.subarray(0, part.length - 2);
    }

    const headerEnd = part.indexOf(Buffer.from("\r\n\r\n"));

    if (headerEnd >= 0) {
      const headers = part.subarray(0, headerEnd).toString("utf8");
      const disposition =
        headers
          .split("\r\n")
          .find((line) => /^content-disposition:/i.test(line)) ?? "";
      const fieldName = /name="([^"]+)"/i.exec(disposition)?.[1];
      const fileName = /filename="([^"]*)"/i.exec(disposition)?.[1];
      const declaredType = /^content-type:\s*(.+)$/im.exec(headers)?.[1];

      if (fieldName === "files" && fileName !== undefined && fileName !== "") {
        files.push({
          originalName: fileName.split(/[\\/]/).pop()?.trim() ?? fileName,
          mimeType: declaredType?.trim() ?? "application/octet-stream",
          buffer: Buffer.from(part.subarray(headerEnd + 4)),
        });
      }
    }

    cursor = next;
  }

  return files;
}

function fakeSourceType(file: UploadedFile): SourceType | null {
  const name = file.originalName.trim().toLowerCase();

  if (name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".txt")) return "txt";
  if (name.endsWith(".md") || name.endsWith(".markdown")) return "markdown";

  return null;
}

function normalizeFakeSourceName(name: string): string {
  return (
    name
      .split(/[\\/]/)
      .pop()
      ?.trim()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim() ?? ""
  );
}

function fakeChunkCount(version: FakeSourceVersion): number {
  return Math.max(1, Math.ceil(version.byteSize / 24));
}

function currentVersion(source: FakeSource): FakeSourceVersion | undefined {
  return source.versions.find(
    (version) => version.id === source.currentVersionId,
  );
}

function toFakeSummary(source: FakeSource): FakeSourceSummary | null {
  const version = currentVersion(source);

  if (version === undefined) return null;

  return {
    id: source.id,
    name: version.name,
    type: version.type,
    byteSize: version.byteSize,
    status: version.status,
    versionId: version.id,
    versionNumber: source.versions.indexOf(version) + 1,
    chunkCount: version.chunkCount,
    isStale: false,
    createdAt: version.createdAt,
    ...(version.url === undefined ? {} : { url: version.url }),
    ...(version.errorMessage === undefined
      ? {}
      : { errorMessage: version.errorMessage }),
  };
}

function sourceError(
  response: ServerResponse,
  status: number,
  code: string,
  message: string,
): void {
  sendJson(response, status, { code, message });
}

/** GET /api/v1/sources — processing versions settle after a second poll. */
function handleListSources(
  request: IncomingMessage,
  response: ServerResponse,
): void {
  if (!isAuthenticated(request)) {
    unauthorized(response);
    return;
  }

  const sources = tokenSources(bearerToken(request));

  for (const source of sources) {
    const version = currentVersion(source);

    if (version?.status !== "processing") continue;

    version.polls += 1;

    if (version.polls >= 2) {
      version.status = "ready";
      version.chunkCount = fakeChunkCount(version);
    }
  }

  const summaries = sources
    .map(toFakeSummary)
    .filter((summary): summary is FakeSourceSummary => summary !== null);

  sendJson(response, 200, { sources: summaries });
}

/** POST /api/v1/sources — mirrors the real 202 + async processing contract. */
async function handleConnectSources(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  if (!isAuthenticated(request)) {
    unauthorized(response);
    return;
  }

  const files = await readMultipartFiles(request);

  if (files.length === 0) {
    sourceError(
      response,
      400,
      "UNSUPPORTED_SOURCE_FILE",
      UNSUPPORTED_SOURCE_MESSAGE,
    );
    return;
  }
  if (files.length > MAX_FAKE_SOURCE_FILES) {
    sourceError(
      response,
      400,
      "TOO_MANY_SOURCE_FILES",
      TOO_MANY_SOURCES_MESSAGE,
    );
    return;
  }

  for (const file of files) {
    if (fakeSourceType(file) === null) {
      sourceError(
        response,
        400,
        "UNSUPPORTED_SOURCE_FILE",
        UNSUPPORTED_SOURCE_MESSAGE,
      );
      return;
    }
    if (file.buffer.byteLength === 0) {
      sourceError(response, 400, "EMPTY_SOURCE_FILE", EMPTY_SOURCE_MESSAGE);
      return;
    }
    if (file.buffer.byteLength > MAX_FAKE_SOURCE_FILE_BYTES) {
      sourceError(
        response,
        400,
        "SOURCE_FILE_TOO_LARGE",
        SOURCE_TOO_LARGE_MESSAGE,
      );
      return;
    }
  }

  const sources = tokenSources(bearerToken(request));
  const results = files.map((file) => {
    const type = fakeSourceType(file) as SourceType;
    const contentHash = createHash("sha256").update(file.buffer).digest("hex");
    const existing = sources
      .flatMap((source) =>
        source.versions.map((version) => ({ source, version })),
      )
      .find((candidate) => candidate.version.contentHash === contentHash);

    if (existing !== undefined) {
      return {
        name: file.originalName,
        type,
        byteSize: file.buffer.byteLength,
        sourceId: existing.source.id,
        versionId: existing.version.id,
        status: existing.version.status,
        alreadyConnected: true,
      };
    }

    const normalizedName = normalizeFakeSourceName(file.originalName);
    let source = sources.find(
      (candidate) => candidate.normalizedName === normalizedName,
    );

    if (source === undefined) {
      source = {
        id: nextSourceId("src"),
        normalizedName,
        currentVersionId: "",
        versions: [],
      };
      sources.unshift(source);
    }

    const shouldFail = /fail|broken|corrupt/i.test(file.originalName);
    const status: SourceStatus = shouldFail ? "failed" : "processing";
    const version: FakeSourceVersion = {
      id: nextSourceId("ver"),
      contentHash,
      name: file.originalName,
      type,
      byteSize: file.buffer.byteLength,
      status,
      chunkCount: 0,
      createdAt: new Date().toISOString(),
      polls: /pending/i.test(file.originalName) ? 0 : 1,
    };

    source.versions.push(version);
    source.currentVersionId = version.id;

    return {
      name: file.originalName,
      type,
      byteSize: file.buffer.byteLength,
      sourceId: source.id,
      versionId: version.id,
      status,
      alreadyConnected: false,
    };
  });

  sendJson(response, 202, { results });
}

/** POST /api/v1/sources/urls — one public page, same source contract as files. */
async function handleConnectSourceUrl(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  if (!isAuthenticated(request)) {
    unauthorized(response);
    return;
  }

  const body = asRecord(await readJsonBody(request));
  const url = normalizeFakeSourceUrl(readString(body, "url"));

  if (url === null) {
    sourceError(response, 400, "INVALID_SOURCE_URL", INVALID_URL_MESSAGE);
    return;
  }

  const hostname = new URL(url).hostname;

  if (isBlockedFakeHost(hostname)) {
    sourceError(response, 400, "BLOCKED_SOURCE_URL", BLOCKED_URL_MESSAGE);
    return;
  }

  const page = fakePageFor(url);
  const failed = page.kind !== "text";
  const contentHash = createHash("sha256")
    .update(failed ? `failed:${url}` : page.text)
    .digest("hex");
  const sources = tokenSources(bearerToken(request));
  const existing = sources
    .flatMap((source) =>
      source.versions.map((version) => ({ source, version })),
    )
    .find(
      (candidate) =>
        candidate.version.contentHash === contentHash &&
        candidate.version.status !== "failed",
    );

  if (existing !== undefined) {
    sendJson(response, 202, {
      results: [
        {
          name: page.title,
          type: "txt",
          byteSize: Buffer.byteLength(page.text, "utf8"),
          sourceId: existing.source.id,
          versionId: existing.version.id,
          status: existing.version.status,
          alreadyConnected: true,
          url,
        },
      ],
    });
    return;
  }

  let source = sources.find(
    (candidate) => candidate.normalizedName === url.toLowerCase(),
  );

  if (source === undefined) {
    source = {
      id: nextSourceId("src"),
      normalizedName: url.toLowerCase(),
      currentVersionId: "",
      versions: [],
    };
    sources.unshift(source);
  }

  const errorMessage = failed
    ? page.kind === "no-text"
      ? NO_TEXT_URL_MESSAGE
      : UNAVAILABLE_URL_MESSAGE
    : undefined;
  const version: FakeSourceVersion = {
    id: nextSourceId("ver"),
    contentHash,
    name: page.title,
    type: "txt",
    byteSize: failed ? 1 : Buffer.byteLength(page.text, "utf8"),
    status: failed ? "failed" : "processing",
    chunkCount: 0,
    createdAt: new Date().toISOString(),
    polls: 1,
    url,
    ...(errorMessage === undefined ? {} : { errorMessage }),
  };

  source.versions.push(version);
  source.currentVersionId = version.id;

  sendJson(response, 202, {
    results: [
      {
        name: page.title,
        type: "txt",
        byteSize: version.byteSize,
        sourceId: source.id,
        versionId: version.id,
        status: version.status,
        alreadyConnected: false,
        url,
      },
    ],
  });
}

/** Test-only control for simulated page changes and fetch failures. */
async function handleSetFakePage(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const body = asRecord(await readJsonBody(request));
  const url = normalizeFakeSourceUrl(readString(body, "url"));

  if (url === null) {
    sendJson(response, 400, {
      code: "INVALID_SOURCE_URL",
      message: INVALID_URL_MESSAGE,
    });
    return;
  }

  const previous = fakePageFor(url);
  const requestedKind = readString(body, "kind");
  const kind: FakePageKind =
    requestedKind === "no-text" || requestedKind === "unavailable"
      ? requestedKind
      : "text";
  const title = readString(body, "title").trim() || previous.title;
  const text = typeof body.text === "string" ? body.text : previous.text;

  fakePages.set(url, { title, text, kind });
  sendJson(response, 200, { url, title, kind });
}

/** DELETE /api/v1/sources/:sourceId */
function handleDeleteSource(
  request: IncomingMessage,
  response: ServerResponse,
  sourceId: string,
): void {
  if (!isAuthenticated(request)) {
    unauthorized(response);
    return;
  }

  const sources = tokenSources(bearerToken(request));
  const index = sources.findIndex((source) => source.id === sourceId);

  if (index < 0) {
    sourceError(response, 404, "SOURCE_NOT_FOUND", SOURCE_NOT_FOUND_MESSAGE);
    return;
  }

  sources.splice(index, 1);
  response.writeHead(204);
  response.end();
}

/** POST /api/v1/sources/:versionId/retry — failures recover deterministically. */
function handleRetrySourceVersion(
  request: IncomingMessage,
  response: ServerResponse,
  versionId: string,
): void {
  if (!isAuthenticated(request)) {
    unauthorized(response);
    return;
  }

  const match = tokenSources(bearerToken(request))
    .flatMap((source) => source.versions)
    .find((version) => version.id === versionId);

  if (match === undefined) {
    sourceError(
      response,
      404,
      "SOURCE_VERSION_NOT_FOUND",
      SOURCE_VERSION_NOT_FOUND_MESSAGE,
    );
    return;
  }

  if (match.url !== undefined) {
    // A failed URL version is re-fetched on retry, just like the real use case.
    const page = fakePageFor(match.url);

    if (page.kind !== "text") {
      sourceError(
        response,
        422,
        page.kind === "no-text"
          ? "SOURCE_URL_NO_TEXT"
          : "SOURCE_URL_UNAVAILABLE",
        page.kind === "no-text" ? NO_TEXT_URL_MESSAGE : UNAVAILABLE_URL_MESSAGE,
      );
      return;
    }

    match.name = page.title;
    match.byteSize = Buffer.byteLength(page.text, "utf8");
    match.contentHash = createHash("sha256").update(page.text).digest("hex");
    delete match.errorMessage;
  }

  match.status = "ready";
  match.chunkCount = fakeChunkCount(match);
  sendJson(response, 202, { versionId: match.id, status: "processing" });
}

function handleListExperts(
  request: IncomingMessage,
  response: ServerResponse,
): void {
  if (!isAuthenticated(request)) {
    unauthorized(response);
    return;
  }

  sendJson(response, 200, { experts: FAKE_EXPERTS });
}

/** GET /api/v1/conversations?expertId=... — empty until the first prompt. */
function handleGetConversation(
  request: IncomingMessage,
  response: ServerResponse,
): void {
  if (!isAuthenticated(request)) {
    unauthorized(response);
    return;
  }

  const url = new URL(request.url ?? "/", `http://${host}:${port}`);
  const expertId = url.searchParams.get("expertId") ?? "";

  if (FAKE_EXPERTS.every((expert) => expert.id !== expertId)) {
    sendJson(response, 404, {
      code: "UNKNOWN_EXPERT",
      message: "That Expert is not available.",
    });
    return;
  }

  const stored = storedConversations.get(
    conversationKey(bearerToken(request), expertId),
  );

  sendJson(response, 200, {
    conversationId: stored?.conversationId ?? null,
    messages: stored?.messages ?? [],
  });
}

/** POST /api/v1/conversations/messages — a prompt containing "fail" returns 503. */
async function handleSendMessage(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  if (!isAuthenticated(request)) {
    unauthorized(response);
    return;
  }

  const body = asRecord(await readJsonBody(request));
  const expertId = readString(body, "expertId").trim();
  const prompt = readString(body, "prompt").trim();
  const expert = FAKE_EXPERTS.find((candidate) => candidate.id === expertId);

  if (expert === undefined) {
    sendJson(response, 404, {
      code: "UNKNOWN_EXPERT",
      message: "That Expert is not available.",
    });
    return;
  }

  if (prompt === "") {
    sendJson(response, 400, {
      code: "VALIDATION_ERROR",
      message: "Check your message and try again.",
      fieldErrors: { prompt: "Enter a message before sending." },
    });
    return;
  }

  if (prompt.toLowerCase().includes("fail")) {
    sendJson(response, 503, {
      code: "MODEL_UNAVAILABLE",
      message: "The Expert could not respond right now. Try again in a moment.",
    });
    return;
  }

  const key = conversationKey(bearerToken(request), expertId);
  const existing = storedConversations.get(key);
  const stored =
    existing ??
    (() => {
      const created: StoredConversation = {
        conversationId: nextChatId("conv"),
        messages: [],
      };

      storedConversations.set(key, created);

      return created;
    })();

  const userMessage: ChatMessage = {
    id: nextChatId("msg"),
    role: "user",
    content: prompt,
    createdAt: new Date().toISOString(),
  };
  const expertMessage: ChatMessage = {
    id: nextChatId("msg"),
    role: "expert",
    content: `As the ${expert.name}, here is a focused answer.`,
    createdAt: new Date().toISOString(),
  };

  stored.messages.push(userMessage, expertMessage);
  sendJson(response, 201, {
    conversationId: stored.conversationId,
    userMessage,
    expertMessage,
  });
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

  if (pathname === "/api/v1/auth/confirm" && request.method === "POST") {
    await handleConfirm(request, response);
    return;
  }

  if (pathname === "/api/v1/auth/sign-in" && request.method === "POST") {
    await handleSignIn(request, response);
    return;
  }

  if (
    pathname === "/api/v1/auth/forgot-password" &&
    request.method === "POST"
  ) {
    await handleForgotPassword(request, response);
    return;
  }

  if (pathname === "/api/v1/auth/reset-password" && request.method === "POST") {
    await handleResetPassword(request, response);
    return;
  }

  if (pathname === "/api/v1/auth/sign-out" && request.method === "POST") {
    const owner = signInTokenOwner(
      (request.headers.authorization ?? "").replace(/^Bearer /, ""),
    );

    if (owner === null || latestSignInSession.get(owner.local) !== owner.n) {
      sendJson(response, 401, {
        code: "UNAUTHORIZED",
        message: "Your session is invalid or has expired. Sign in again.",
      });
      return;
    }

    // Revoke the session: only a token newer than this one stays valid.
    latestSignInSession.set(owner.local, owner.n + 1);
    response.writeHead(204);
    response.end();
    return;
  }

  if (pathname === "/api/v1/auth/me") {
    const authorization = request.headers.authorization;

    if (authorization === `Bearer ${E2E_VALID_SESSION_TOKEN}`) {
      sendJson(response, 200, { user });
      return;
    }

    const owner = signInTokenOwner(
      (authorization ?? "").replace(/^Bearer /, ""),
    );

    if (owner !== null && latestSignInSession.get(owner.local) === owner.n) {
      sendJson(response, 200, {
        user: { ...user, email: `${owner.local}@${E2E_SIGN_IN_DOMAIN}` },
      });
      return;
    }

    sendJson(response, 401, {
      code: "UNAUTHORIZED",
      message: "Your session is invalid or has expired. Sign in again.",
    });
    return;
  }

  if (pathname === "/api/v1/experts" && request.method === "GET") {
    handleListExperts(request, response);
    return;
  }

  if (pathname === "/api/v1/conversations" && request.method === "GET") {
    handleGetConversation(request, response);
    return;
  }

  if (
    pathname === "/api/v1/conversations/messages" &&
    request.method === "POST"
  ) {
    await handleSendMessage(request, response);
    return;
  }

  if (pathname === "/api/v1/sources" && request.method === "GET") {
    handleListSources(request, response);
    return;
  }

  if (pathname === "/api/v1/sources" && request.method === "POST") {
    await handleConnectSources(request, response);
    return;
  }

  if (pathname === "/api/v1/sources/urls" && request.method === "POST") {
    await handleConnectSourceUrl(request, response);
    return;
  }

  if (pathname === "/__fake/pages" && request.method === "POST") {
    await handleSetFakePage(request, response);
    return;
  }

  const retryMatch = /^\/api\/v1\/sources\/([^/]+)\/retry$/.exec(pathname);

  if (retryMatch !== null && request.method === "POST") {
    handleRetrySourceVersion(
      request,
      response,
      decodeURIComponent(retryMatch[1] ?? ""),
    );
    return;
  }

  const sourceMatch = /^\/api\/v1\/sources\/([^/]+)$/.exec(pathname);

  if (sourceMatch !== null && request.method === "DELETE") {
    handleDeleteSource(
      request,
      response,
      decodeURIComponent(sourceMatch[1] ?? ""),
    );
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
