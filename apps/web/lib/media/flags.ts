import { cookies } from "next/headers";

/** Server-only rollout flag for multimedia deliverables (spec 017). */
export const MULTIMEDIA_FLAG_COOKIE = "multimedia_deliverables_enabled";

function enabledByEnvironment(): boolean {
  const value =
    process.env.MULTIMEDIA_DELIVERABLES_ENABLED?.trim().toLowerCase();

  return value === "1" || value === "true" || value === "yes";
}

/** Off by default; the E2E suite enables it for its own browser context only. */
export async function isMultimediaEnabled(): Promise<boolean> {
  if (enabledByEnvironment()) return true;

  try {
    const store = await cookies();
    const value = store.get(MULTIMEDIA_FLAG_COOKIE)?.value?.toLowerCase();

    return value === "1" || value === "true" || value === "yes";
  } catch {
    return false;
  }
}
