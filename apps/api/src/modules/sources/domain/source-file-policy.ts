import { createHash } from "node:crypto";

import type { SourceType } from "./source";
import {
  EmptySourceFileError,
  SourceFileTooLargeError,
  TooManySourceFilesError,
  UnsupportedSourceFileError,
} from "./source.errors";

/** Temporary owner-approved defaults; the open decision stays in the spec. */
export const MAX_SOURCE_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_FILES_PER_UPLOAD = 5;

const CHUNK_TARGET_CHARS = 1_200;
const CHUNK_OVERLAP_CHARS = 200;

export type SourceUploadFile = {
  originalName: string;
  mimeType: string;
  buffer: Buffer;
};

export type ValidatedSourceFile = SourceUploadFile & {
  type: SourceType;
  normalizedName: string;
  contentHash: string;
  byteSize: number;
  /** Display name for URL sources; files keep their original name. */
  displayName?: string;
};

const extensionTypes: Record<string, SourceType> = {
  ".pdf": "pdf",
  ".txt": "txt",
  ".md": "markdown",
  ".markdown": "markdown",
};

const mimeTypes: Record<string, SourceType> = {
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/markdown": "markdown",
  "text/x-markdown": "markdown",
};

/** Removes path segments before a name is used for grouping or display. */
export function safeFileName(originalName: string): string {
  const base = originalName.split(/[\\/]/).pop()?.trim() ?? "";

  return base.slice(0, 255);
}

/**
 * Case- and accent-insensitive file name. The extension is intentionally kept:
 * `Report.txt` and `Report.md` are separate connections.
 */
export function normalizeSourceName(originalName: string): string {
  return safeFileName(originalName)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Maps an extension plus the declared MIME type to a supported source type. */
export function sourceTypeFor(
  originalName: string,
  mimeType: string,
): SourceType | null {
  const name = normalizeSourceName(originalName);
  const extension = Object.keys(extensionTypes).find((candidate) =>
    name.endsWith(candidate),
  );
  const declared = mimeType.trim().toLowerCase().split(";")[0] ?? "";
  const byMime = mimeTypes[declared];
  const isGeneric = declared === "" || declared === "application/octet-stream";

  if (extension === undefined) return null;
  if (byMime !== undefined && byMime !== extensionTypes[extension]) return null;
  if (byMime === undefined && !isGeneric) return null;

  return extensionTypes[extension] ?? null;
}

export function sha256Hex(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/**
 * Validates the untrusted multipart payload before any version is persisted.
 * Every rejection uses public copy that lists the accepted formats where useful.
 */
export function validateSourceFiles(
  files: SourceUploadFile[],
  maxBytes = MAX_SOURCE_FILE_BYTES,
  maxFiles = MAX_FILES_PER_UPLOAD,
): ValidatedSourceFile[] {
  if (files.length === 0) {
    throw new UnsupportedSourceFileError();
  }
  if (files.length > maxFiles) {
    throw new TooManySourceFilesError();
  }

  return files.map((file) => {
    const type = sourceTypeFor(file.originalName, file.mimeType);

    if (type === null) {
      throw new UnsupportedSourceFileError();
    }

    const byteSize = file.buffer.byteLength;

    if (byteSize === 0) {
      throw new EmptySourceFileError();
    }
    if (byteSize > maxBytes) {
      throw new SourceFileTooLargeError();
    }

    return {
      ...file,
      originalName: safeFileName(file.originalName),
      type,
      normalizedName: normalizeSourceName(file.originalName),
      contentHash: sha256Hex(file.buffer),
      byteSize,
    };
  });
}

function splitLongWord(word: string): string[] {
  const parts: string[] = [];

  for (let offset = 0; offset < word.length; offset += CHUNK_TARGET_CHARS) {
    parts.push(word.slice(offset, offset + CHUNK_TARGET_CHARS));
  }

  return parts;
}

/**
 * Deterministic, whitespace-aware chunking. Documents are treated as untrusted
 * data: this function only splits text and never interprets instructions in it.
 */
export function chunkText(text: string): string[] {
  const normalized = text.replace(/\r\n?/g, "\n").replace(/\s+/g, " ").trim();

  if (normalized === "") return [];

  const words = normalized
    .split(" ")
    .flatMap((word) => splitLongWord(word))
    .filter((word) => word !== "");

  const chunks: string[] = [];
  let current: string[] = [];
  let currentLength = 0;

  for (const word of words) {
    const nextLength =
      currentLength + (current.length === 0 ? 0 : 1) + word.length;

    if (current.length > 0 && nextLength > CHUNK_TARGET_CHARS) {
      chunks.push(current.join(" "));

      const overlap: string[] = [];
      let overlapLength = 0;

      for (let index = current.length - 1; index >= 0; index -= 1) {
        const candidate = current[index];
        if (candidate === undefined) continue;

        const candidateLength =
          overlap.length === 0 ? candidate.length : candidate.length + 1;

        if (overlapLength + candidateLength > CHUNK_OVERLAP_CHARS) break;

        overlap.unshift(candidate);
        overlapLength += candidateLength;
      }

      current = overlap;
      currentLength = overlapLength;
    }

    current.push(word);
    currentLength += (current.length === 1 ? 0 : 1) + word.length;
  }

  if (current.length > 0) {
    chunks.push(current.join(" "));
  }

  return chunks;
}

/** Decodes TXT/Markdown with fatal validation so corrupt bytes are rejected. */
export function decodeUtf8(buffer: Buffer): string {
  return new TextDecoder("utf-8", { fatal: true }).decode(buffer).trim();
}
