import type { SourceType } from "../../domain/source";
import type { SourceUploadFile } from "../../domain/source-file-policy";

/** Extracts untrusted document text. Implementations reject corrupt content. */
export abstract class DocumentTextExtractorPort {
  abstract extract(file: SourceUploadFile, type: SourceType): Promise<string>;
}
