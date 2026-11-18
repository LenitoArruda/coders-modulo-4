import { Inject, Injectable, Optional } from "@nestjs/common";

import { MEDIA_MESSAGES, type MediaGeneratorResult } from "../domain/media";
import { MediaProviderError } from "../domain/media.errors";
import {
  MEDIA_GEMINI_API_BASE_URL,
  MEDIA_GEMINI_API_KEY,
} from "../media.tokens";

import {
  MediaGeneratorPort,
  type MediaGenerationRequest,
} from "../application/ports/media-generator.port";

type OperationResponse = {
  name?: string;
  done?: boolean;
  error?: { message?: string };
  response?: {
    generatedVideos?: Array<{
      video?: { uri?: string; base64?: string; mimeType?: string };
    }>;
    video?: { uri?: string; base64?: string; mimeType?: string };
  };
};

const DEFAULT_VIDEO_COST_USD = 0.4;
const MAX_POLLS = 40;
const POLL_INTERVAL_MS = 250;

/** Gemini video adapter using the long-running prediction contract. */
@Injectable()
export class GeminiVideoGenerator extends MediaGeneratorPort {
  constructor(
    @Optional()
    @Inject(MEDIA_GEMINI_API_KEY)
    private readonly apiKey: string = "",
    @Optional()
    @Inject(MEDIA_GEMINI_API_BASE_URL)
    private readonly baseUrl: string = "https://generativelanguage.googleapis.com",
  ) {
    super();
  }

  async generate(
    request: MediaGenerationRequest,
  ): Promise<MediaGeneratorResult> {
    if (this.apiKey === "") throw new MediaProviderError();

    const base = this.baseUrl.replace(/\/$/, "");
    const model = encodeURIComponent(request.modelId);
    let operation: OperationResponse;

    try {
      const started = await fetch(
        `${base}/v1beta/models/${model}:predictLongRunning`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": this.apiKey,
          },
          body: JSON.stringify({
            instances: [{ prompt: request.prompt }],
            parameters: {
              durationSeconds: request.parameters.durationSeconds ?? 6,
              resolution: request.parameters.resolution ?? "720p",
              aspectRatio: "16:9",
            },
          }),
        },
      );

      if (!started.ok) throw new MediaProviderError();
      operation = (await started.json()) as OperationResponse;
    } catch (error) {
      if (error instanceof MediaProviderError) throw error;
      throw new MediaProviderError(error);
    }

    if (operation.error !== undefined) {
      throw new MediaProviderError(undefined, MEDIA_MESSAGES.refused);
    }

    const name = operation.name;

    if (name === undefined) throw new MediaProviderError();

    for (let poll = 0; poll < MAX_POLLS; poll += 1) {
      if (operation.done === true) return this.readResult(operation, request);

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

      try {
        const response = await fetch(`${base}/v1beta/${name}`, {
          headers: { "x-goog-api-key": this.apiKey },
        });

        if (!response.ok) throw new MediaProviderError();
        operation = (await response.json()) as OperationResponse;
      } catch (error) {
        if (error instanceof MediaProviderError) throw error;
        throw new MediaProviderError(error);
      }

      if (operation.error !== undefined) {
        throw new MediaProviderError(undefined, MEDIA_MESSAGES.refused);
      }
    }

    throw new MediaProviderError();
  }

  private async readResult(
    operation: OperationResponse,
    request: MediaGenerationRequest,
  ): Promise<MediaGeneratorResult> {
    const video =
      operation.response?.generatedVideos?.[0]?.video ??
      operation.response?.video;
    const encoded = video?.base64;
    const uri = video?.uri;

    let bytes: Buffer;

    if (encoded !== undefined) {
      bytes = Buffer.from(encoded, "base64");
    } else if (uri !== undefined) {
      try {
        const downloaded = await fetch(uri, {
          headers: { "x-goog-api-key": this.apiKey },
        });

        if (!downloaded.ok) throw new MediaProviderError();
        bytes = Buffer.from(await downloaded.arrayBuffer());
      } catch (error) {
        if (error instanceof MediaProviderError) throw error;
        throw new MediaProviderError(error);
      }
    } else {
      throw new MediaProviderError();
    }

    return {
      bytes,
      mimeType: video?.mimeType ?? "video/mp4",
      width: null,
      height: 720,
      modelId: request.modelId,
      modelVersion: null,
      estimatedCostUsd: DEFAULT_VIDEO_COST_USD,
    };
  }
}
