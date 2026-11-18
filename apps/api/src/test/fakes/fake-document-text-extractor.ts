import { DocumentTextExtractorPort } from "../../modules/sources/application/ports/document-text-extractor.port";
import type { SourceType } from "../../modules/sources/domain/source";
import type { SourceUploadFile } from "../../modules/sources/domain/source-file-policy";
import { EmptySourceFileError } from "../../modules/sources/domain/source.errors";

/** Returns the UTF-8 text of a file; can be told to fail for a corrupt file. */
export class FakeDocumentTextExtractor extends DocumentTextExtractorPort {
  failure: Error | null = null;
  readonly calls: string[] = [];

  async extract(file: SourceUploadFile, _type: SourceType): Promise<string> {
    this.calls.push(file.originalName);

    if (this.failure !== null) throw this.failure;

    const text = file.buffer.toString("utf8").trim();

    if (text === "") throw new EmptySourceFileError();

    return text;
  }
}
