import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

import type { AuthUser } from "../domain/auth-user";

import type { AuthenticatedRequest } from "./authenticated-request";

/**
 * Injects the authenticated user resolved by `SessionGuard`. Only usable on
 * routes (or controllers) protected by the guard.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (request.user === undefined) {
      throw new Error("CurrentUser requires SessionGuard on the route");
    }

    return request.user;
  },
);
