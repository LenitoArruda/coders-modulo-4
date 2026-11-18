import type {
  MediaCitation,
  MediaKind,
  MediaParameters,
} from "../../domain/media";

export type MediaJob = {
  mediaId: string;
  userId: string;
  kind: MediaKind;
  parameters: MediaParameters;
  prompt: string;
  modelId: string;
  citation: MediaCitation | null;
  attempts: number;
};

/** In-process queue; jobs are not durable across restarts (spec 017). */
export abstract class MediaJobQueuePort {
  abstract enqueue(job: MediaJob): void;

  /** Returns true when the queued job was removed before it started (quota refund). */
  abstract cancel(mediaId: string): Promise<boolean>;
}
