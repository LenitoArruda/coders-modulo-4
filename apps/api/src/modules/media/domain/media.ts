/**
 * Media domain (spec 017). Pure types and rules shared by the use cases. Every
 * user-facing string is en-US; prompts, bytes and provider details never reach
 * logs or telemetry.
 */

export type MediaKind = "image" | "video";
export type MediaStatus =
  "queued" | "generating" | "ready" | "failed" | "cancelled";
export type ImageSize = "1024x1024" | "1024x1536" | "1536x1024";
export type VideoDurationSeconds = 4 | 6 | 8;

export type MediaParameters = {
  kind: MediaKind;
  /** Selected only for images. */
  size?: ImageSize;
  /** Selected only for videos; capped at 8 seconds. */
  durationSeconds?: VideoDurationSeconds;
  /** Always 720p for the first video release. */
  resolution?: "720p";
  /** Short style phrase extracted from the briefing, when present. */
  style?: string;
  /** Optional [n] marker resolved against the last Expert answer. */
  citationNumber?: number;
};

/** Citation metadata attached to a deliverable when a connected source was used. */
export type MediaCitation = {
  citationNumber: number;
  sourceName: string;
  locationLabel: string;
};

/** Public attachment contract, mirrored by the web chat. */
export type MediaAttachment = {
  mediaId: string;
  kind: MediaKind;
  status: MediaStatus;
  uri: string;
  mimeType: string | null;
  sizeBytes: number | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  modelId: string;
  modelVersion: string | null;
  parameters: MediaParameters;
  createdAt: string;
  citation?: MediaCitation;
  /** Stable error code; present only when status is `failed`. */
  errorCode?: MediaErrorCode;
  /** Short en-US message; never a provider response or a prompt excerpt. */
  errorMessage?: string;
  attempts?: number;
};

export type MediaErrorCode =
  | "INVALID_BRIEF"
  | "LIMIT_EXCEEDED"
  | "QUOTA_EXCEEDED"
  | "PROVIDER_UNAVAILABLE"
  | "CONTENT_REFUSED"
  | "CANCELLED"
  | "NOT_FOUND";

export type MediaGeneratorResult = {
  bytes: Buffer;
  mimeType: string;
  width: number | null;
  height: number | null;
  modelId: string;
  modelVersion: string | null;
  estimatedCostUsd: number | null;
};

export type MediaIntent =
  | { outcome: "generate"; parameters: MediaParameters }
  | { outcome: "needs_type" | "needs_topic" | "limit"; message: string }
  | { outcome: "none" };

export const DEFAULT_MEDIA_BRIEFING_MAX_LENGTH = 2_000;
export const DEFAULT_MEDIA_MAX_FILE_BYTES = 20 * 1024 * 1024;
export const DEFAULT_MEDIA_IMAGE_QUOTA_PER_HOUR = 10;
export const DEFAULT_MEDIA_VIDEO_QUOTA_PER_HOUR = 2;
export const DEFAULT_MEDIA_QUOTA_WINDOW_SECONDS = 3_600;
export const MAX_MEDIA_ATTEMPTS = 3;

export const IMAGE_SIZES: readonly ImageSize[] = [
  "1024x1024",
  "1024x1536",
  "1536x1024",
];
export const VIDEO_DURATIONS: readonly VideoDurationSeconds[] = [4, 6, 8];

export const MEDIA_MESSAGES = {
  needsType: "What should I create — an image or a short video?",
  needsTopic: "What should it show? Send me a short topic or briefing.",
  briefingTooLong:
    "Keep the briefing under 2,000 characters so I can create a focused deliverable.",
  duration:
    "Short videos can be 4, 6 or 8 seconds long. Which duration should I use?",
  resolution: "Short videos are available in 720p only for now.",
  imageSize:
    "Images are available in square, portrait or landscape sizes. Which one should I use?",
  quota:
    "You've reached the generation limit for this hour. Try again later or request the other format.",
  unavailable:
    "The media service is unavailable right now. Try again in a moment.",
  refused:
    "The provider declined this briefing. Try rephrasing it without restricted content.",
  fileTooLarge:
    "The generated file is larger than the 20 MB limit. Try a smaller format.",
  failed: "We couldn't create this file. Try again.",
  partial: "No partial file was kept.",
  cancelled: "Generation cancelled. No file was kept.",
  notFound: "That file is no longer available.",
  downloadFailed:
    "The download failed. Try again without regenerating the file.",
} as const;

const IMAGE_KEYWORDS =
  /\b(image|picture|photo|poster|thumbnail|illustration|banner|graphic|cover art|social media post)\b/i;
const VIDEO_KEYWORDS = /\b(video|clip|animation|reel|story|motion|movie)\b/i;
const GENERATION_KEYWORDS =
  /\b(create|generate|make|draw|produce|design|render|build)\b/i;
const TOPIC_KEYWORDS =
  /\b(about|of|for|featuring|showing|depicting|with|on)\b/i;
const STYLE_KEYWORDS =
  /\b(minimalist|minimalistic|bold|vintage|modern|abstract|flat|cinematic|colorful|simple|retro)\b/i;

function sizeFromPrompt(prompt: string): ImageSize | undefined {
  if (/\b(portrait|vertical|story)\b/i.test(prompt)) return "1024x1536";
  if (/\b(landscape|horizontal|banner|wide)\b/i.test(prompt))
    return "1536x1024";
  if (/\b(square|post)\b/i.test(prompt)) return "1024x1024";
  return undefined;
}

function styleFromPrompt(prompt: string): string | undefined {
  return prompt.match(STYLE_KEYWORDS)?.[0]?.toLowerCase();
}

function durationFromPrompt(prompt: string): number | null {
  const match = /(\d+)\s*(?:s|sec|secs|second|seconds)\b/i.exec(prompt);

  return match?.[1] === undefined ? null : Number(match[1]);
}

function exceedsImageLimit(prompt: string): boolean {
  return /\b(4k|8k|ultra hd|3840|4096)\b/i.test(prompt);
}

/** Extracts the subject while ignoring command words and explicit parameters. */
export function extractMediaTopic(prompt: string): string {
  const cleaned = prompt
    .replace(GENERATION_KEYWORDS, " ")
    .replace(IMAGE_KEYWORDS, " ")
    .replace(VIDEO_KEYWORDS, " ")
    .replace(/\b(a|an|the|me|please|short|new|some)\b/gi, " ")
    .replace(/\b\d+\s*(?:s|sec|secs|second|seconds)\b/gi, " ")
    .replace(
      /\b(720p|4k|8k|square|portrait|vertical|landscape|horizontal)\b/gi,
      " ",
    )
    .replace(/\[\d+\]/g, " ")
    .replace(/[,.;:!?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const match = TOPIC_KEYWORDS.exec(cleaned);

  if (match !== null && match.index !== undefined) {
    const after = cleaned.slice(match.index + match[0].length).trim();

    if (after.length > 0) return after;
  }

  return cleaned;
}

/**
 * Keyword-based intent detection for en-US briefings. A missing type or topic
 * produces one short confirmation question and no job; explicit limits are
 * rejected before any provider call.
 */
export function detectMediaIntent(prompt: string): MediaIntent {
  const text = prompt.trim();

  if (text.length === 0 || !GENERATION_KEYWORDS.test(text)) {
    return { outcome: "none" };
  }

  const isImage = IMAGE_KEYWORDS.test(text);
  const isVideo = VIDEO_KEYWORDS.test(text);

  if (isImage === isVideo) {
    return { outcome: "needs_type", message: MEDIA_MESSAGES.needsType };
  }

  if (text.length > DEFAULT_MEDIA_BRIEFING_MAX_LENGTH) {
    return { outcome: "limit", message: MEDIA_MESSAGES.briefingTooLong };
  }

  const kind: MediaKind = isImage ? "image" : "video";
  const topic = extractMediaTopic(text);

  if (topic.length === 0) {
    return { outcome: "needs_topic", message: MEDIA_MESSAGES.needsTopic };
  }

  if (kind === "image" && exceedsImageLimit(text)) {
    return { outcome: "limit", message: MEDIA_MESSAGES.imageSize };
  }

  const citationNumber = /\[(\d+)\]/.exec(text)?.[1];
  const parameters: MediaParameters = { kind };
  const style = styleFromPrompt(text);
  const size = sizeFromPrompt(text);

  if (style !== undefined) parameters.style = style;
  if (citationNumber !== undefined) {
    parameters.citationNumber = Number(citationNumber);
  }

  if (kind === "image") {
    if (size !== undefined) parameters.size = size;
  } else {
    const duration = durationFromPrompt(text);

    if (
      duration !== null &&
      !VIDEO_DURATIONS.includes(duration as VideoDurationSeconds)
    ) {
      return { outcome: "limit", message: MEDIA_MESSAGES.duration };
    }

    parameters.durationSeconds = (duration ?? 6) as VideoDurationSeconds;
    parameters.resolution = "720p";
  }

  return { outcome: "generate", parameters };
}

/** Builds the prompt sent to a provider from validated parameters and topic. */
export function buildMediaPrompt(
  parameters: MediaParameters,
  topic: string,
  expertTone: string,
): string {
  const parts = [
    `Create a ${parameters.kind} in a ${expertTone} professional tone: ${topic}.`,
  ];

  if (parameters.style !== undefined) parts.push(`Style: ${parameters.style}.`);
  if (parameters.size !== undefined) parts.push(`Size: ${parameters.size}.`);
  if (parameters.durationSeconds !== undefined) {
    parts.push(`Duration: ${parameters.durationSeconds} seconds.`);
  }
  if (parameters.resolution !== undefined) {
    parts.push(`Resolution: ${parameters.resolution}.`);
  }

  return parts.join(" ");
}

/** Text shown with a queued or ready deliverable. */
export function mediaIntroduction(
  expertName: string,
  parameters: MediaParameters,
): string {
  const detail =
    parameters.kind === "video"
      ? `${parameters.durationSeconds ?? 6}-second 720p video`
      : `${parameters.size ?? "1024x1024"} image`;

  return `As the ${expertName}, I started your ${detail}. The preview and download link appear below as soon as it is ready.`;
}

export function isTerminalStatus(status: MediaStatus): boolean {
  return status === "ready" || status === "failed" || status === "cancelled";
}

export function nextAttempt(attempts: number): number {
  return attempts + 1;
}

/** Human-readable label used by `alt` text and the download link. */
export function mediaAltText(attachment: MediaAttachment): string {
  const kind = attachment.kind === "image" ? "image" : "short video";

  return attachment.status === "ready"
    ? `Generated ${kind} preview, ${attachment.parameters.size ?? `${attachment.parameters.durationSeconds ?? 6} seconds`}`
    : `Generated ${kind}, status ${attachment.status}`;
}
