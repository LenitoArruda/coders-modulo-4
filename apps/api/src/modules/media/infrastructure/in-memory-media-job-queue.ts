import { Injectable } from "@nestjs/common";

import {
  MediaJobQueuePort,
  type MediaJob,
} from "../application/ports/media-job-queue.port";
import { MediaQuotaPort } from "../application/ports/media-quota.port";
import { ProcessMediaGenerationUseCase } from "../application/process-media-generation.use-case";

type PendingJob = {
  job: MediaJob;
  controller: AbortController;
};

/**
 * In-process queue with one abort controller per job. A queued job can be
 * cancelled with a quota refund; an in-flight job is aborted without refund.
 */
@Injectable()
export class InMemoryMediaJobQueue extends MediaJobQueuePort {
  private readonly pending = new Map<string, PendingJob>();
  private readonly running = new Map<string, Promise<void>>();

  constructor(
    private readonly processJob: ProcessMediaGenerationUseCase,
    private readonly quota: MediaQuotaPort,
  ) {
    super();
  }

  enqueue(job: MediaJob): void {
    this.pending.set(job.mediaId, { job, controller: new AbortController() });
    const task = new Promise<void>((resolve) => {
      setImmediate(() => {
        void this.run(job.mediaId).finally(resolve);
      });
    });

    this.running.set(job.mediaId, task);
    void task.finally(() => this.running.delete(job.mediaId));
  }

  async cancel(mediaId: string): Promise<boolean> {
    const queued = this.pending.get(mediaId);

    if (queued !== undefined) {
      queued.controller.abort();
      this.pending.delete(mediaId);
      this.quota.refund(queued.job.userId, queued.job.kind);

      return true;
    }

    return false;
  }

  /** Test helper: waits until all accepted jobs settle. */
  async idle(): Promise<void> {
    await Promise.all(Array.from(this.running.values()));
  }

  private async run(mediaId: string): Promise<void> {
    const entry = this.pending.get(mediaId);

    if (entry === undefined || entry.controller.signal.aborted) {
      this.pending.delete(mediaId);
      return;
    }

    this.pending.delete(mediaId);

    try {
      await this.processJob.execute(entry.job);
    } catch {
      // The use case persists a clean failure; unexpected errors never escape
      // into the request path or leak provider details.
    }
  }
}
