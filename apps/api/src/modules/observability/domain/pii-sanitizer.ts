export type PiiPatternName = "email" | "phone" | "token";

export type SanitizedText = {
  value: string;
  sanitized: boolean;
  patterns: PiiPatternName[];
};

type SanitizerRule = {
  name: PiiPatternName;
  pattern: RegExp;
  replacement: string;
};

const RULES: readonly SanitizerRule[] = [
  {
    name: "email",
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    replacement: "[EMAIL]",
  },
  {
    name: "token",
    pattern:
      /(?:sk-[A-Za-z0-9_-]{12,}|ghp_[A-Za-z0-9]{20,}|Bearer\s+[A-Za-z0-9._~+/=-]{8,})/gi,
    replacement: "[TOKEN]",
  },
  {
    name: "token",
    pattern:
      /\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|session[_-]?token)\s*[:=]\s*[A-Za-z0-9._~+/=-]{8,}/gi,
    replacement: "[TOKEN]",
  },
  {
    name: "phone",
    pattern:
      /(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)[\s.-]?)?\d{2,4}[\s.-]\d{3,4}[\s.-]\d{3,4}(?:[\s.-]\d{2,4})?/g,
    replacement: "[PHONE]",
  },
];

/** Masks known PII shapes without keeping the original value in the result. */
export function sanitizePii(value: string): SanitizedText {
  const patterns = new Set<PiiPatternName>();
  let sanitized = value;

  for (const rule of RULES) {
    sanitized = sanitized.replace(rule.pattern, () => {
      patterns.add(rule.name);

      return rule.replacement;
    });
  }

  return {
    value: sanitized,
    sanitized: sanitized !== value,
    patterns: [...patterns],
  };
}

function sanitizeValue(value: unknown, patterns: Set<PiiPatternName>): unknown {
  if (typeof value === "string") {
    const result = sanitizePii(value);

    for (const pattern of result.patterns) patterns.add(pattern);

    return result.value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValue(entry, patterns));
  }

  if (typeof value === "object" && value !== null) {
    return sanitizeObject(value as Record<string, unknown>, patterns);
  }

  return value;
}

function sanitizeObject(
  metadata: Record<string, unknown>,
  patterns: Set<PiiPatternName>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    result[key] = sanitizeValue(value, patterns);
  }

  return result;
}

/**
 * Sanitizes all string values of a metadata object. Pattern names are
 * returned so the emitter can log `obs.pii.sanitized` without logging data.
 */
export function sanitizePiiMetadata(metadata: Record<string, unknown>): {
  metadata: Record<string, unknown>;
  patterns: PiiPatternName[];
} {
  const patterns = new Set<PiiPatternName>();

  return {
    metadata: sanitizeObject(metadata, patterns),
    patterns: [...patterns],
  };
}
