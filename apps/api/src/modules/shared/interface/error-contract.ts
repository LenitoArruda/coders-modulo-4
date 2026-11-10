import { HttpException, UnauthorizedException } from "@nestjs/common";

export type FieldErrors = Record<string, string[]>;

export type ErrorContract = {
  code: string;
  message: string;
  fieldErrors?: FieldErrors;
};

export const SESSION_INVALID_MESSAGE =
  "Your session is invalid or has expired. Sign in again.";

const codeByStatus: Record<number, string> = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  422: "UNPROCESSABLE_ENTITY",
  429: "TOO_MANY_REQUESTS",
};

const messageByStatus: Record<number, string> = {
  400: "The request is invalid.",
  401: "Your session is invalid or has expired. Sign in again.",
  403: "You are not allowed to perform this action.",
  404: "Resource not found.",
  409: "The request conflicts with the current state.",
  422: "The request could not be processed.",
  429: "Too many requests. Try again later.",
};

const INTERNAL_ERROR_CODE = "INTERNAL_ERROR";
const INTERNAL_ERROR_MESSAGE = "An unexpected error occurred. Try again later.";

function isContractPayload(payload: unknown): payload is ErrorContract {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }

  const candidate = payload as Record<string, unknown>;

  return (
    typeof candidate.code === "string" && typeof candidate.message === "string"
  );
}

function hasFieldErrors(
  payload: unknown,
): payload is { fieldErrors: FieldErrors } {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }

  const candidate = (payload as Record<string, unknown>).fieldErrors;

  return typeof candidate === "object" && candidate !== null;
}

/**
 * Maps any thrown value to the stable API error contract
 * (`code`, `message` and `fieldErrors` when present) without exposing stack
 * traces, SQL or internal details.
 */
export function toErrorContract(exception: unknown): {
  status: number;
  body: ErrorContract;
} {
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const payload = exception.getResponse();

    if (status >= 500) {
      return {
        status,
        body: { code: INTERNAL_ERROR_CODE, message: INTERNAL_ERROR_MESSAGE },
      };
    }

    if (isContractPayload(payload)) {
      return {
        status,
        body: {
          code: payload.code,
          message: payload.message,
          ...(hasFieldErrors(payload)
            ? { fieldErrors: payload.fieldErrors }
            : {}),
        },
      };
    }

    return {
      status,
      body: {
        code: codeByStatus[status] ?? `HTTP_${status}`,
        message:
          messageByStatus[status] ?? "The request could not be completed.",
      },
    };
  }

  return {
    status: 500,
    body: { code: INTERNAL_ERROR_CODE, message: INTERNAL_ERROR_MESSAGE },
  };
}

/** Standard 401 used by session-protected endpoints. */
export function sessionUnauthorizedException(): UnauthorizedException {
  return new UnauthorizedException({
    code: "UNAUTHORIZED",
    message: SESSION_INVALID_MESSAGE,
  });
}
