/** A catalog entry. All product copy is en-US and part of versioned content. */
export type Expert = {
  /** Stable identifier used by the API, database and UI. */
  id: string;
  /** Display name shown in the selector and transcript. */
  name: string;
  /** Short role label shown under the name. */
  role: string;
  /** What the Expert can help with. */
  scope: string;
  /** How the Expert answers, in English, for the system prompt. */
  tone: string;
  /** Ready-made prompts; clicking one sends it verbatim. */
  suggestions: readonly string[];
};

/** Stable identifiers accepted by the catalog and the database constraint. */
export const EXPERT_IDS = [
  "cto",
  "cmo",
  "sales-director",
  "customer-success-director",
  "customer-hero-director",
  "ceo",
  "cfo",
  "coo",
  "cpo",
] as const;

export type ExpertId = (typeof EXPERT_IDS)[number];
