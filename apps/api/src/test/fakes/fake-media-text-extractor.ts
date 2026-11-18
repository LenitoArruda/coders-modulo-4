import {
  MediaTextExtractorPort,
  type MediaExtractionResult,
} from "../../modules/sources/application/ports/media-text-extractor.port";
import type { MediaType } from "../../modules/sources/domain/source";
import type { SourceUploadFile } from "../../modules/sources/domain/source-file-policy";

/** Deterministic, hermetic OCR/transcription used by API tests. */
export class FakeMediaTextExtractor extends MediaTextExtractorPort {
  readonly calls: Array<{ name: string; type: MediaType }> = [];
  /** File names whose transcription is intentionally empty. */
  readonly silentNames = new Set<string>();

  async extract(
    file: SourceUploadFile,
    type: MediaType,
    durationSeconds?: number | null,
  ): Promise<MediaExtractionResult> {
    this.calls.push({ name: file.originalName, type });

    const silent = this.silentNames.has(file.originalName);

    return {
      text: silent ? "" : `Extracted ${type} text from ${file.originalName}.`,
      method: type === "image" ? "ocr" : "transcription",
      modelVersion: "fake-local-v1",
      durationSeconds: durationSeconds ?? null,
    };
  }
}
