import type { Request } from "express";

import type { AuthUser } from "../domain/auth-user";

/** Express request enriched by the session guard on protected routes. */
export type AuthenticatedRequest = Request & { user?: AuthUser };
