import { isIP } from "node:net";

import { BlockedSourceUrlError, InvalidSourceUrlError } from "./source.errors";

/** URL sources stay inside the 013 contract as `txt` with a private MIME marker. */
export const URL_SOURCE_MIME_TYPE = "text/plain+url";

/** Aligned with the existing `sources.name` database constraint. */
export const MAX_SOURCE_URL_LENGTH = 255;
export const MAX_URL_RESPONSE_BYTES = 2 * 1024 * 1024;
export const URL_FETCH_TIMEOUT_MS = 8_000;
export const MAX_URL_REDIRECTS = 3;
export const URL_FETCH_RETRIES = 1;

export type SourceUrlFetchOptions = {
  /** Test-only escape hatch; never enabled by user input or the environment. */
  allowPrivateHosts: boolean;
  timeoutMs: number;
  maxBytes: number;
  maxRedirects: number;
  retries: number;
};

export const DEFAULT_SOURCE_URL_FETCH_OPTIONS: SourceUrlFetchOptions = {
  allowPrivateHosts: false,
  timeoutMs: URL_FETCH_TIMEOUT_MS,
  maxBytes: MAX_URL_RESPONSE_BYTES,
  maxRedirects: MAX_URL_REDIRECTS,
  retries: URL_FETCH_RETRIES,
};

const TRACKING_PARAMS = new Set([
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

const BLOCKED_HOSTNAMES = new Set([
  "metadata",
  "metadata.google.internal",
  "metadata.goog",
  "instance-data",
  "kubernetes.default.svc",
]);

function isBlockedHostnameSuffix(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".cluster.local") ||
    hostname.endsWith(".svc")
  );
}

/** Removes tracking noise and normalizes the address used to group versions. */
export function normalizeSourceUrl(input: string): string {
  const trimmed = input.trim();

  if (trimmed.length === 0 || trimmed.length > MAX_SOURCE_URL_LENGTH) {
    throw new InvalidSourceUrlError();
  }

  let parsed: URL;

  try {
    parsed = new URL(trimmed);
  } catch {
    throw new InvalidSourceUrlError();
  }

  if (
    (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
    parsed.hostname === "" ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    /\s/.test(trimmed)
  ) {
    throw new InvalidSourceUrlError();
  }

  for (const key of Array.from(parsed.searchParams.keys())) {
    const lower = key.toLowerCase();

    if (lower.startsWith("utm_") || TRACKING_PARAMS.has(lower)) {
      parsed.searchParams.delete(key);
    }
  }

  parsed.host = parsed.host.toLowerCase();
  parsed.hash = "";

  let normalized = parsed.toString();

  if (normalized.endsWith("/") && parsed.pathname === "/") {
    normalized = normalized.slice(0, -1);
  }
  if (normalized.length === 0 || normalized.length > MAX_SOURCE_URL_LENGTH) {
    throw new InvalidSourceUrlError();
  }

  return normalized;
}

function ipv4Parts(address: string): number[] | null {
  const parts = address.split(".");

  if (parts.length !== 4) return null;

  const numbers: number[] = [];

  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;

    const value = Number(part);

    if (value > 255) return null;
    numbers.push(value);
  }

  return numbers;
}

function isBlockedIpv4(address: string): boolean {
  const parts = ipv4Parts(address);

  if (parts === null) return true;

  const [a = 0, b = 0] = parts;

  if (a === 0 || a === 10 || a === 127 || a >= 224) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 198 && b === 51) return true;
  if (a === 203 && b === 0) return true;

  return false;
}

function mappedIpv4(address: string): string | null {
  const match = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i.exec(address);

  return match?.[1] ?? null;
}

/** Blocks private, loopback, link-local, metadata and special-use addresses. */
export function isBlockedIpAddress(address: string): boolean {
  const candidate = address
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "");
  const mapped = mappedIpv4(candidate);

  if (mapped !== null) return isBlockedIpv4(mapped);

  const version = isIP(candidate);

  if (version === 4) return isBlockedIpv4(candidate);
  if (version !== 6) return true;

  if (candidate === "::" || candidate === "::1") return true;
  if (/^f[cd][0-9a-f]{2}:/.test(candidate)) return true;
  if (/^fe[89ab][0-9a-f]:/.test(candidate)) return true;
  if (/^fec[0-9a-f]:/.test(candidate)) return true;
  if (candidate.startsWith("ff")) return true;
  if (candidate.startsWith("2001:db8:")) return true;
  if (candidate.startsWith("100::")) return true;
  if (candidate.startsWith("64:ff9b:")) return true;
  if (candidate.startsWith("::ffff:")) return true;

  return false;
}

/** Fast hostname rejection before DNS resolution. */
export function assertPublicHostname(hostname: string): void {
  const normalized = hostname
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "");

  if (
    normalized === "" ||
    BLOCKED_HOSTNAMES.has(normalized) ||
    isBlockedHostnameSuffix(normalized) ||
    (isIP(normalized) !== 0 && isBlockedIpAddress(normalized))
  ) {
    throw new BlockedSourceUrlError();
  }
}

/** DNS answers are checked before any connection is attempted. */
export function assertPublicAddresses(addresses: string[]): void {
  if (addresses.length === 0 || addresses.some(isBlockedIpAddress)) {
    throw new BlockedSourceUrlError();
  }
}

function decodeHtmlEntities(value: string): string {
  return value.replace(
    /&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,
    (entity) => {
      if (entity.startsWith("&#x")) {
        const code = Number.parseInt(entity.slice(3, -1), 16);

        return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : " ";
      }
      if (entity.startsWith("&#")) {
        const code = Number.parseInt(entity.slice(2, -1), 10);

        return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : " ";
      }

      switch (entity.toLowerCase()) {
        case "&amp;":
          return "&";
        case "&lt;":
          return "<";
        case "&gt;":
          return ">";
        case "&quot;":
          return '"';
        case "&apos;":
          return "'";
        default:
          return " ";
      }
    },
  );
}

/** Extracts a title and plain text from untrusted HTML without executing it. */
export function extractHtmlContent(html: string): {
  title: string;
  text: string;
} {
  const titleMatch = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const title = titleMatch
    ? decodeHtmlEntities(titleMatch[1] ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 255)
    : "";
  const withoutComments = html.replace(/<!--[\s\S]*?-->/g, " ");
  const withoutHead = withoutComments.replace(
    /<head\b[^>]*>[\s\S]*?<\/head\s*>/gi,
    " ",
  );
  const withoutActive = withoutHead.replace(
    /<(script|style|noscript|svg|iframe|object|embed|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
    " ",
  );
  const withoutTags = withoutActive.replace(/<[^>]+>/g, " ");
  const text = decodeHtmlEntities(withoutTags).replace(/\s+/g, " ").trim();

  return { title, text };
}

/** Human-readable fallback when a page has no usable `<title>`. */
export function titleForUrl(url: string): string {
  const parsed = new URL(url);
  const path = decodeURIComponent(parsed.pathname)
    .replace(/^\/+|\/+$/g, "")
    .replace(/[-_/]+/g, " ")
    .trim();

  return (path === "" ? parsed.hostname : path).slice(0, 255) || "Web page";
}
