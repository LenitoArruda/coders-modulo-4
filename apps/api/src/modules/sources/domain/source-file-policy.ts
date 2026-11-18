import { createHash } from "node:crypto";

import type { MediaType, SourceType } from "./source";
import {
  EmptySourceFileError,
  InvalidMediaDurationError,
  MediaDurationTooLongError,
  SourceFileTooLargeError,
  TooManySourceFilesError,
  UnsupportedSourceFileError,
} from "./source.errors";

/** Temporary owner-approved defaults; the open decision stays in the spec. */
export const MAX_SOURCE_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_FILES_PER_UPLOAD = 5;

export const MAX_IMAGE_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_AUDIO_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_VIDEO_FILE_BYTES = 200 * 1024 * 1024;
export const MAX_MEDIA_FILE_BYTES = MAX_VIDEO_FILE_BYTES;
export const MAX_MEDIA_DURATION_SECONDS = 60 * 60;

/** Widest multer limit; the domain applies the per-type limit afterwards. */
export const MAX_UPLOAD_FILE_BYTES = MAX_MEDIA_FILE_BYTES;

const CHUNK_TARGET_CHARS = 1_200;
const CHUNK_OVERLAP_CHARS = 200;

export type SourceUploadFile = {
  originalName: string;
  mimeType: string;
  buffer: Buffer;
  durationSeconds?: number | null;
};

export type ValidatedSourceFile = SourceUploadFile & {
  type: SourceType;
  normalizedName: string;
  contentHash: string;
  byteSize: number;
  durationSeconds: number | null;
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

const mediaExtensionTypes: Record<string, MediaType> = {
  ".jpg": "image",
  ".jpeg": "image",
  ".png": "image",
  ".mp3": "audio",
  ".mp4": "video",
};

const mediaMimeTypes: Record<string, MediaType> = {
  "image/jpeg": "image",
  "image/png": "image",
  "audio/mpeg": "audio",
  "audio/mp3": "audio",
  "video/mp4": "video",
};

const mediaSizeLimits: Record<MediaType, number> = {
  image: MAX_IMAGE_FILE_BYTES,
  audio: MAX_AUDIO_FILE_BYTES,
  video: MAX_VIDEO_FILE_BYTES,
};

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

function isJpeg(buffer: Buffer): boolean {
  return (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  );
}

function isPng(buffer: Buffer): boolean {
  return (
    buffer.length >= PNG_SIGNATURE.length &&
    buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)
  );
}

function isMp3(buffer: Buffer): boolean {
  if (
    buffer.length >= 3 &&
    buffer.subarray(0, 3).toString("latin1") === "ID3"
  ) {
    return true;
  }

  // MPEG audio frame sync: 11 set bits followed by a valid version bits value.
  return buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] ?? 0) >= 0xe0;
}

function isMp4(buffer: Buffer): boolean {
  return (
    buffer.length >= 12 && buffer.subarray(4, 8).toString("latin1") === "ftyp"
  );
}

/** Guards against a disallowed MIME/extension claiming to be another format. */
export function hasValidMediaSignature(
  type: MediaType,
  buffer: Buffer,
): boolean {
  switch (type) {
    case "image":
      return isJpeg(buffer) || isPng(buffer);
    case "audio":
      return isMp3(buffer);
    case "video":
      return isMp4(buffer);
  }
}

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

/** Media-only resolver including magic bytes. Never trusts the declared MIME alone. */
export function mediaTypeFor(
  originalName: string,
  mimeType: string,
  buffer: Buffer,
): MediaType | null {
  const name = normalizeSourceName(originalName);
  const extension = Object.keys(mediaExtensionTypes).find((candidate) =>
    name.endsWith(candidate),
  );
  const declared = mimeType.trim().toLowerCase().split(";")[0] ?? "";
  const byMime = mediaMimeTypes[declared];
  const isGeneric = declared === "" || declared === "application/octet-stream";

  if (extension === undefined) return null;
  const byExtension = mediaExtensionTypes[extension];

  if (byMime !== undefined && byMime !== byExtension) return null;
  if (byMime === undefined && !isGeneric) return null;
  if (
    byExtension === undefined ||
    !hasValidMediaSignature(byExtension, buffer)
  ) {
    return null;
  }

  return byExtension;
}

/** Resolves any source type, with media only when the rollout flag is enabled. */
export function sourceTypeForUpload(
  originalName: string,
  mimeType: string,
  buffer: Buffer,
  allowMedia: boolean,
): SourceType | null {
  const documentType = sourceTypeFor(originalName, mimeType);

  if (documentType !== null) return documentType;
  if (!allowMedia) return null;

  return mediaTypeFor(originalName, mimeType, buffer);
}

export function maxBytesForSourceType(type: SourceType): number {
  return isMediaType(type) ? mediaSizeLimits[type] : MAX_SOURCE_FILE_BYTES;
}

function isMediaType(type: SourceType): type is MediaType {
  return type === "image" || type === "audio" || type === "video";
}

/** Accepts a number or a numeric multipart field; rejects anything else. */
export function validateDurationSeconds(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;

  const parsed =
    typeof value === "number" ? value : Number(String(value).trim());

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new InvalidMediaDurationError();
  }
  if (parsed > MAX_MEDIA_DURATION_SECONDS) {
    throw new MediaDurationTooLongError();
  }

  return Math.round(parsed);
}

export function sha256Hex(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/**
 * Validates the untrusted multipart payload before any version is persisted.
 * Every rejection uses public copy that lists the accepted formats where useful.
 * The default arguments keep the document-only behavior of the previous slice.
 */
export function validateSourceFiles(
  files: SourceUploadFile[],
  maxBytes = MAX_SOURCE_FILE_BYTES,
  maxFiles = MAX_FILES_PER_UPLOAD,
  options: { allowMedia?: boolean } = {},
): ValidatedSourceFile[] {
  if (files.length === 0) {
    throw new UnsupportedSourceFileError(options.allowMedia === true);
  }
  if (files.length > maxFiles) {
    throw new TooManySourceFilesError();
  }

  return files.map((file) => {
    const type = sourceTypeForUpload(
      file.originalName,
      file.mimeType,
      file.buffer,
      options.allowMedia === true,
    );

    if (type === null) {
      throw new UnsupportedSourceFileError(options.allowMedia === true);
    }

    const byteSize = file.buffer.byteLength;
    const limit =
      options.allowMedia === true ? maxBytesForSourceType(type) : maxBytes;

    if (byteSize === 0) {
      throw new EmptySourceFileError();
    }
    if (byteSize > limit) {
      throw new SourceFileTooLargeError();
    }

    const durationSeconds = isMediaType(type)
      ? validateDurationSeconds(file.durationSeconds)
      : null;

    return {
      ...file,
      originalName: safeFileName(file.originalName),
      type,
      normalizedName: normalizeSourceName(file.originalName),
      contentHash: sha256Hex(file.buffer),
      byteSize,
      durationSeconds,
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
