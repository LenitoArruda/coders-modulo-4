import { ArgumentsHost, Catch, ExceptionFilter } from "@nestjs/common";
import type { Response } from "express";
import { MulterError } from "multer";

/** Translates multer's transport errors into the global error contract. */
@Catch(MulterError)
export class SourceUploadExceptionFilter implements ExceptionFilter {
  catch(exception: MulterError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const error = exception;

    if (error.code === "LIMIT_FILE_SIZE") {
      response.status(413).json({
        code: "SOURCE_FILE_TOO_LARGE",
        message: "One of the files is too large. Try a smaller file.",
      });
      return;
    }

    response.status(400).json({
      code: "VALIDATION_ERROR",
      message: "Check your files and try again.",
      fieldErrors: { files: "Check your files and try again." },
    });
  }
}
