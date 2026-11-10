import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from "@nestjs/common";
import type { Response } from "express";

import type { RequestWithId } from "../logging/request-logging.middleware";
import { log } from "../observability/app-logger";
import { toErrorContract } from "./error-contract";

/**
 * Global filter that renders every error with the stable API contract
 * (`code`, `message` and `fieldErrors` when present). Internal details such as
 * stack traces or SQL are logged server-side only and never returned.
 */
@Catch()
export class ErrorContractFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<RequestWithId>();
    const { status, body } = toErrorContract(exception);

    if (!(exception instanceof HttpException) || status >= 500) {
      log("error", "Exceção não tratada", {
        requestId: request?.requestId,
        statusCode: status,
        error:
          exception instanceof Error
            ? `${exception.name}: ${exception.message}`
            : "unknown",
      });
    }

    response.status(status).json(body);
  }
}
