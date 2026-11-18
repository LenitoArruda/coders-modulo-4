import type {
  MediaGeneratorResult,
  MediaKind,
  MediaParameters,
} from "../../domain/media";

export type MediaGenerationRequest = {
  userId: string;
  kind: MediaKind;
  /** Full provider prompt assembled from validated parameters and topic. */
  prompt: string;
  parameters: MediaParameters;
  modelId: string;
};

/** Provider boundary: OpenAI for images, Gemini for videos. */
export abstract class MediaGeneratorPort {
  abstract generate(
    request: MediaGenerationRequest,
  ): Promise<MediaGeneratorResult>;
}
