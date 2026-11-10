import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
} from "@nestjs/common";

import { ValidateSessionUseCase } from "../application/validate-session.use-case";
import { InvalidSessionError } from "../domain/invalid-session.error";
import { sessionUnauthorizedException } from "../../shared/interface/error-contract";

import type { AuthenticatedRequest } from "./authenticated-request";

/**
 * Extracts the token from an `Authorization: Bearer <jwt>` header. The scheme
 * is case-insensitive (RFC 6750) and extra whitespace between the parts is
 * tolerated; anything else is treated as absent.
 */
export function extractBearerToken(header: string | undefined): string | null {
  if (header === undefined) {
    return null;
  }

  const parts = header.trim().split(/\s+/);

  if (parts.length !== 2 || parts[0]?.toLowerCase() !== "bearer" || !parts[1]) {
    return null;
  }

  return parts[1];
}

/**
 * Validates the bearer JWT and the server-side session on every protected
 * request. Missing, malformed, expired, revoked or mismatched sessions all
 * become the same 401 contract, so the client cannot distinguish causes.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    @Inject(ValidateSessionUseCase)
    private readonly validateSession: ValidateSessionUseCase,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractBearerToken(request.headers.authorization);

    if (token === null) {
      throw sessionUnauthorizedException();
    }

    try {
      request.user = await this.validateSession.execute(token);
    } catch (error) {
      if (error instanceof InvalidSessionError) {
        throw sessionUnauthorizedException();
      }

      throw error;
    }

    return true;
  }
}
