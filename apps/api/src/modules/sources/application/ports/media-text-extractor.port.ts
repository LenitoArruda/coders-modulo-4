import type { MediaExtractionMethod, MediaType } from "../../domain/source";
import type { SourceUploadFile } from "../../domain/source-file-policy";

/** Result of turning untrusted media bytes into untrusted plain text. */
export type MediaExtractionResult = {
  text: string;
  method: MediaExtractionMethod;
  modelVersion: string;
  durationSeconds?: number | null;
};

/**
 * New capability introduced by the media slice. It is deliberately separate
 * from the document extractor: OCR/transcription is local and command-driven.
 */
export abstract class MediaTextExtractorPort {
  abstract extract(
    file: SourceUploadFile,
    type: MediaType,
    durationSeconds?: number | null,
  ): Promise<MediaExtractionResult>;
}
