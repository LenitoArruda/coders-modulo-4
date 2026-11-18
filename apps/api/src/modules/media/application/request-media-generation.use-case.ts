import { randomUUID } from "node:crypto";

import { Inject, Injectable, Optional } from "@nestjs/common";

import type { Citation } from "../../citations/domain/citation";
import {
  buildMediaPrompt,
  detectMediaIntent,
  extractMediaTopic,
  mediaIntroduction,
  type MediaAttachment,
  type MediaCitation,
  type MediaParameters,
} from "../domain/media";
import { MediaQuotaError } from "../domain/media.errors";
import { MEDIA_IMAGE_MODEL_ID, MEDIA_VIDEO_MODEL_ID } from "../media.tokens";
import { log } from "../../shared/observability/app-logger";

import { MediaGenerationRepositoryPort } from "./ports/media-generation-repository.port";
import { MediaJobQueuePort } from "./ports/media-job-queue.port";
import { MediaQuotaPort } from "./ports/media-quota.port";

export type RequestMediaInput = {
  userId: string;
  expertId: string;
  expertName: string;
  expertTone: string;
  prompt: string;
  citations: Citation[];
};

export type RequestMediaResult =
  | { outcome: "none" }
  | { outcome: "text"; message: string }
  | { outcome: "queued"; attachment: MediaAttachment; reply: string };

/**
 * Detects an explicit media request, validates its parameters, enforces quota
 * and enqueues the job. Ambiguous or over-limit briefings return one short
 * en-US question and never call a provider.
 */
@Injectable()
export class RequestMediaGenerationUseCase {
  constructor(
    @Inject(MediaGenerationRepositoryPort)
    private readonly repository: MediaGenerationRepositoryPort,
    @Inject(MediaJobQueuePort)
    private readonly queue: MediaJobQueuePort,
    @Inject(MediaQuotaPort)
    private readonly quota: MediaQuotaPort,
    @Optional()
    @Inject(MEDIA_IMAGE_MODEL_ID)
    private readonly imageModelId: string = "gpt-image-2",
    @Optional()
    @Inject(MEDIA_VIDEO_MODEL_ID)
    private readonly videoModelId: string = "gemini-omni-1.2-flash",
  ) {}

  async execute(input: RequestMediaInput): Promise<RequestMediaResult> {
    const intent = detectMediaIntent(input.prompt);

    if (intent.outcome === "none") return { outcome: "none" };
    if (intent.outcome !== "generate") {
      return { outcome: "text", message: intent.message };
    }

    const parameters: MediaParameters = intent.parameters;
    const citation = this.resolveCitation(parameters, input.citations);
    const modelId =
      parameters.kind === "image" ? this.imageModelId : this.videoModelId;
    const id = randomUUID();
    const extension = parameters.kind === "image" ? "png" : "mp4";

    try {
      this.quota.consume(input.userId, parameters.kind);
    } catch (error) {
      if (error instanceof MediaQuotaError) {
        return { outcome: "text", message: error.publicMessage };
      }
      throw error;
    }

    const topic = extractMediaTopic(input.prompt);
    const providerPrompt = buildMediaPrompt(
      parameters,
      topic,
      input.expertTone,
    );
    const providerPromptWithCitation =
      citation === null
        ? providerPrompt
        : `${providerPrompt} Use connected source ${citation.sourceName} (${citation.locationLabel}) as visual reference.`;

    const record = await this.repository.create({
      id,
      userId: input.userId,
      kind: parameters.kind,
      fileName: `${parameters.kind}-${id}.${extension}`,
      modelId,
      providerPrompt: providerPromptWithCitation,
      parameters,
      citation,
    });

    this.queue.enqueue({
      mediaId: id,
      userId: input.userId,
      kind: parameters.kind,
      parameters,
      prompt: providerPromptWithCitation,
      modelId,
      citation,
      attempts: 0,
    });

    log("info", "media_generation.requested", {
      event: "media_generation.requested",
      mediaId: id,
      userId: input.userId,
      expertId: input.expertId,
      kind: parameters.kind,
      modelId,
      outcome: "queued",
    });

    return {
      outcome: "queued",
      attachment: this.repository.toAttachment(record),
      reply: mediaIntroduction(input.expertName, parameters),
    };
  }

  /** `[n]` only ever resolves to a citation already validated by the chat. */
  private resolveCitation(
    parameters: MediaParameters,
    citations: Citation[],
  ): MediaCitation | null {
    if (parameters.citationNumber === undefined) return null;

    const match = citations.find(
      (citation) => citation.citationNumber === parameters.citationNumber,
    );

    if (match === undefined) return null;

    return {
      citationNumber: match.citationNumber,
      sourceName: match.sourceName,
      locationLabel: match.location.label,
    };
  }
}
