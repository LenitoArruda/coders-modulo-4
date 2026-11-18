import { cookies } from "next/headers";

/**
 * Server-only rollout flag for the media slice. The default is off: media
 * controls stay hidden until local OCR/transcription is validated. The E2E
 * suite enables the cookie for its own browser context only.
 */
export const KNOWLEDGE_MEDIA_FLAG_COOKIE = "knowledge_media_enabled";

function enabledByEnvironment(): boolean {
  const value = process.env.KNOWLEDGE_MEDIA_ENABLED?.trim().toLowerCase();

  return value === "1" || value === "true";
}

export async function isKnowledgeMediaEnabled(): Promise<boolean> {
  if (enabledByEnvironment()) return true;

  try {
    const store = await cookies();

    return (
      store.get(KNOWLEDGE_MEDIA_FLAG_COOKIE)?.value === "1" ||
      store.get(KNOWLEDGE_MEDIA_FLAG_COOKIE)?.value === "true"
    );
  } catch {
    // Outside a request (for example, in unit tests) the flag stays off.
    return false;
  }
}
