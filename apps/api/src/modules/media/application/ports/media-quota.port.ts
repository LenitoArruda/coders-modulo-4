import type { MediaKind } from "../../domain/media";

/** Per-user, per-format quota. No cross-user counter is ever shared. */
export abstract class MediaQuotaPort {
  abstract consume(userId: string, kind: MediaKind): void;

  abstract refund(userId: string, kind: MediaKind): void;
}
