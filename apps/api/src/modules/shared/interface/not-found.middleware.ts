import { NotFoundException } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

import { toErrorContract } from "./error-contract";

function normalizePrefix(prefix: string): string {
  return `/${prefix.replace(/^\/+/, "").replace(/\/+$/, "")}`;
}

/**
 * Nest mounts its own not-found handler only inside the global prefix, so
 * paths outside it (for example `GET /`) fall through to Express's default
 * HTML page. This middleware answers those paths with the stable API error
 * contract instead, so every error response shares the same shape.
 */
export function notFoundOutsidePrefixMiddleware(prefix: string) {
  const root = normalizePrefix(prefix);

  return (request: Request, response: Response, next: NextFunction): void => {
    if (request.path === root || request.path.startsWith(`${root}/`)) {
      next();

      return;
    }

    const { status, body } = toErrorContract(new NotFoundException());

    response.status(status).json(body);
  };
}
