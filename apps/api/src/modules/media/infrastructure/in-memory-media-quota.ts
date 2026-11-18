import { Inject, Injectable, Optional } from "@nestjs/common";

import {
  DEFAULT_MEDIA_IMAGE_QUOTA_PER_HOUR,
  DEFAULT_MEDIA_QUOTA_WINDOW_SECONDS,
  DEFAULT_MEDIA_VIDEO_QUOTA_PER_HOUR,
  type MediaKind,
} from "../domain/media";
import { MediaQuotaError } from "../domain/media.errors";
import {
  MEDIA_IMAGE_QUOTA_PER_HOUR,
  MEDIA_QUOTA_WINDOW_SECONDS,
  MEDIA_VIDEO_QUOTA_PER_HOUR,
} from "../media.tokens";

import { MediaQuotaPort } from "../application/ports/media-quota.port";

/** Per-user, per-format sliding window. Never shared across users. */
@Injectable()
export class InMemoryMediaQuota extends MediaQuotaPort {
  private readonly windows = new Map<string, number[]>();

  constructor(
    @Optional()
    @Inject(MEDIA_IMAGE_QUOTA_PER_HOUR)
    private readonly imageLimit: number = DEFAULT_MEDIA_IMAGE_QUOTA_PER_HOUR,
    @Optional()
    @Inject(MEDIA_VIDEO_QUOTA_PER_HOUR)
    private readonly videoLimit: number = DEFAULT_MEDIA_VIDEO_QUOTA_PER_HOUR,
    @Optional()
    @Inject(MEDIA_QUOTA_WINDOW_SECONDS)
    private readonly windowSeconds: number = DEFAULT_MEDIA_QUOTA_WINDOW_SECONDS,
  ) {
    super();
  }

  consume(userId: string, kind: MediaKind): void {
    const key = `${userId}|${kind}`;
    const now = Date.now();
    const recent = (this.windows.get(key) ?? []).filter(
      (timestamp) => now - timestamp < this.windowSeconds * 1_000,
    );
    const limit = kind === "image" ? this.imageLimit : this.videoLimit;

    if (recent.length >= limit) {
      this.windows.set(key, recent);
      throw new MediaQuotaError();
    }

    recent.push(now);
    this.windows.set(key, recent);
  }

  refund(userId: string, kind: MediaKind): void {
    const key = `${userId}|${kind}`;
    const recent = this.windows.get(key) ?? [];
    const last = recent.length - 1;

    if (last >= 0) recent.splice(last, 1);
    this.windows.set(key, recent);
  }
}
