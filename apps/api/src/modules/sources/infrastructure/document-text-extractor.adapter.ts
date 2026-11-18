import { Injectable } from "@nestjs/common";
import { PDFParse } from "pdf-parse";

import { DocumentTextExtractorPort } from "../application/ports/document-text-extractor.port";
import type { SourceType } from "../domain/source";
import {
  decodeUtf8,
  type SourceUploadFile,
} from "../domain/source-file-policy";
import {
  EmptySourceFileError,
  SourceProcessingError,
} from "../domain/source.errors";

/** Local PDF/TXT/Markdown extraction. File text is never logged. */
@Injectable()
export class DocumentTextExtractorAdapter extends DocumentTextExtractorPort {
  async extract(file: SourceUploadFile, type: SourceType): Promise<string> {
    try {
      const text =
        type === "pdf"
          ? await this.extractPdf(file.buffer)
          : decodeUtf8(file.buffer);

      if (text.trim() === "") throw new EmptySourceFileError();

      return text.trim();
    } catch (error) {
      if (error instanceof EmptySourceFileError) throw error;

      throw new SourceProcessingError();
    }
  }

  private async extractPdf(buffer: Buffer): Promise<string> {
    if (buffer.subarray(0, 5).toString("latin1") !== "%PDF-") {
      throw new SourceProcessingError();
    }

    const parser = new PDFParse({ data: new Uint8Array(buffer) });

    try {
      const result = await parser.getText();

      return result.text.trim();
    } finally {
      await parser.destroy();
    }
  }
}
