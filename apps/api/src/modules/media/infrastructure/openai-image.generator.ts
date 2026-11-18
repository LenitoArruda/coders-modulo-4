import { Inject, Injectable, Optional } from "@nestjs/common";

import {
  MEDIA_MESSAGES,
  type MediaGeneratorResult,
  type ImageSize,
} from "../domain/media";
import { MediaProviderError } from "../domain/media.errors";
import {
  MEDIA_OPENAI_API_BASE_URL,
  MEDIA_OPENAI_API_KEY,
} from "../media.tokens";

import {
  MediaGeneratorPort,
  type MediaGenerationRequest,
} from "../application/ports/media-generator.port";

type OpenAIResponse = {
  data?: Array<{ b64_json?: string; url?: string }>;
  error?: { message?: string; type?: string };
};

const DEFAULT_IMAGE_COST_USD = 0.04;

/** OpenAI Images REST adapter. The key is only ever sent as a bearer header. */
@Injectable()
export class OpenAIImageGenerator extends MediaGeneratorPort {
  constructor(
    @Optional()
    @Inject(MEDIA_OPENAI_API_KEY)
    private readonly apiKey: string = "",
    @Optional()
    @Inject(MEDIA_OPENAI_API_BASE_URL)
    private readonly baseUrl: string = "https://api.openai.com",
  ) {
    super();
  }

  async generate(
    request: MediaGenerationRequest,
  ): Promise<MediaGeneratorResult> {
    if (this.apiKey === "") throw new MediaProviderError();

    let response: Response;

    try {
      response = await fetch(new URL("/v1/images/generations", this.baseUrl), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: request.modelId,
          prompt: request.prompt,
          n: 1,
          response_format: "b64_json",
          size: request.parameters.size ?? "1024x1024",
        }),
      });
    } catch (error) {
      throw new MediaProviderError(error);
    }

    if (!response.ok) {
      if (response.status === 400 || response.status === 403) {
        throw new MediaProviderError(undefined, MEDIA_MESSAGES.refused);
      }
      throw new MediaProviderError();
    }

    let body: OpenAIResponse;

    try {
      body = (await response.json()) as OpenAIResponse;
    } catch (error) {
      throw new MediaProviderError(error);
    }

    const encoded = body.data?.[0]?.b64_json;

    if (encoded === undefined) throw new MediaProviderError();

    const bytes = Buffer.from(encoded, "base64");
    const size = (request.parameters.size ?? "1024x1024") as ImageSize;
    const [width, height] = size.split("x");

    return {
      bytes,
      mimeType: "image/png",
      width: width === undefined ? null : Number(width),
      height: height === undefined ? null : Number(height),
      modelId: request.modelId,
      modelVersion: null,
      estimatedCostUsd: DEFAULT_IMAGE_COST_USD,
    };
  }
}
