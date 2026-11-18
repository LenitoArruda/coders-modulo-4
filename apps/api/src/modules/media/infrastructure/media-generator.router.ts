import { Injectable } from "@nestjs/common";

import {
  MediaGeneratorPort,
  type MediaGenerationRequest,
} from "../application/ports/media-generator.port";
import type { MediaGeneratorResult } from "../domain/media";

import { GeminiVideoGenerator } from "./gemini-video.generator";
import { OpenAIImageGenerator } from "./openai-image.generator";

/** Sends images only to OpenAI and videos only to Gemini. */
@Injectable()
export class MediaGeneratorRouter extends MediaGeneratorPort {
  constructor(
    private readonly imageGenerator: OpenAIImageGenerator,
    private readonly videoGenerator: GeminiVideoGenerator,
  ) {
    super();
  }

  generate(request: MediaGenerationRequest): Promise<MediaGeneratorResult> {
    return request.kind === "image"
      ? this.imageGenerator.generate(request)
      : this.videoGenerator.generate(request);
  }
}
