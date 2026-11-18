import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { Injectable } from "@nestjs/common";

import {
  MediaTextExtractorPort,
  type MediaExtractionResult,
} from "../application/ports/media-text-extractor.port";
import type { MediaType } from "../domain/source";
import type { SourceUploadFile } from "../domain/source-file-policy";
import { MediaExtractionUnavailableError } from "../domain/source.errors";

const execFileAsync = promisify(execFile);

const COMMAND_TIMEOUT_MS = 5 * 60 * 1_000;
const OUTPUT_MAX_CHARS = 8 * 1024 * 1024;

/** Keeps the original extension so local tools detect the container format. */
function inputExtension(file: SourceUploadFile, type: MediaType): string {
  const extension = /\.([a-z0-9]+)$/i
    .exec(file.originalName)?.[1]
    ?.toLowerCase();

  if (extension === "png" || extension === "jpg" || extension === "jpeg") {
    return extension;
  }
  if (type !== "image" && extension === "mp3") return "mp3";
  if (type !== "image" && extension === "mp4") return "mp4";

  return "bin";
}

/** Splits a configured command without invoking a shell. */
function commandTokens(command: string): string[] {
  const tokens: string[] = [];
  const pattern = /[^\s"']+|"([^"]*)"|'([^']*)'/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(command)) !== null) {
    tokens.push(match[1] ?? match[2] ?? match[0]);
  }

  return tokens;
}

function env(name: string): string {
  return process.env[name]?.trim() ?? "";
}

/**
 * Local OCR/transcription runner. Commands come from server-only environment
 * variables and receive a temporary file through `{file}`; `{output}` is
 * optional. Extracted text, file names and hashes are never logged.
 */
@Injectable()
export class LocalMediaTextExtractorAdapter extends MediaTextExtractorPort {
  async extract(
    file: SourceUploadFile,
    type: MediaType,
    durationSeconds?: number | null,
  ): Promise<MediaExtractionResult> {
    const configured =
      type === "image"
        ? env("MEDIA_OCR_COMMAND")
        : env("MEDIA_TRANSCRIPTION_COMMAND");

    if (configured === "") throw new MediaExtractionUnavailableError();

    const method = type === "image" ? "ocr" : "transcription";
    const modelVersion =
      env(
        type === "image"
          ? "MEDIA_OCR_MODEL_VERSION"
          : "MEDIA_TRANSCRIPTION_MODEL_VERSION",
      ) || "local-default";
    const directory = env("MEDIA_TEMP_DIR") || tmpdir();
    const runId = randomUUID();
    const inputPath = join(
      directory,
      `media-${runId}.${inputExtension(file, type)}`,
    );
    const outputPath = join(directory, `media-${runId}.txt`);

    await mkdir(directory, { recursive: true });
    await writeFile(inputPath, file.buffer);

    try {
      const usesOutput = configured.includes("{output}");
      const args = commandTokens(configured).map((token) =>
        token
          .replaceAll("{file}", inputPath)
          .replaceAll("{output}", outputPath),
      );
      const executable = args.shift();

      if (executable === undefined) throw new MediaExtractionUnavailableError();

      const { stdout } = await execFileAsync(executable, args, {
        timeout: COMMAND_TIMEOUT_MS,
        maxBuffer: OUTPUT_MAX_CHARS,
      });
      const text = usesOutput
        ? (await readFile(outputPath, "utf8")).trim()
        : stdout.trim();

      return {
        text: text.slice(0, OUTPUT_MAX_CHARS),
        method,
        modelVersion,
        durationSeconds: durationSeconds ?? null,
      };
    } finally {
      await rm(inputPath, { force: true }).catch(() => {});
      await rm(outputPath, { force: true }).catch(() => {});
    }
  }
}
