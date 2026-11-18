import {
  Inject,
  Injectable,
  CanActivate,
  type ExecutionContext,
  NotFoundException,
} from "@nestjs/common";

import { MEDIA_ENABLED } from "../media.tokens";

/** Media routes are hidden entirely while the rollout flag is off. */
@Injectable()
export class MediaFlagGuard implements CanActivate {
  constructor(@Inject(MEDIA_ENABLED) private readonly enabled: boolean) {}

  canActivate(_context: ExecutionContext): boolean {
    if (!this.enabled) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Resource not found.",
      });
    }

    return true;
  }
}
