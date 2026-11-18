import { describe, expect, it } from "vitest";

import {
  EMPTY_PROMPT_MESSAGE,
  PROMPT_TOO_LONG_MESSAGE,
  validateSendMessageInput,
} from "./send-message-input";

describe("validateSendMessageInput", () => {
  it("aceita um prompt válido e faz trim do texto", () => {
    const result = validateSendMessageInput(
      { expertId: " cto ", prompt: "  Review our architecture.  " },
      4000,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        expertId: "cto",
        prompt: "Review our architecture.",
        source: "typed",
      });
    }
  });

  it("mantém a origem suggestion quando informada", () => {
    const result = validateSendMessageInput(
      { expertId: "cmo", prompt: "Draft a brief.", source: "suggestion" },
      4000,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.source).toBe("suggestion");
    }
  });

  it("rejeita prompt vazio ou somente espaços", () => {
    for (const prompt of ["", "   ", 42, undefined]) {
      const result = validateSendMessageInput(
        { expertId: "cto", prompt },
        4000,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.fieldErrors.prompt).toBe(EMPTY_PROMPT_MESSAGE);
      }
    }
  });

  it("rejeita prompt acima do limite configurado", () => {
    const result = validateSendMessageInput(
      { expertId: "cto", prompt: "x".repeat(11) },
      10,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors.prompt).toBe(PROMPT_TOO_LONG_MESSAGE);
    }
  });

  it("rejeita expertId ausente e origem desconhecida", () => {
    const result = validateSendMessageInput(
      { prompt: "Question?", source: "injected" },
      4000,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors.expertId).toBeDefined();
      expect(result.fieldErrors.source).toBeDefined();
    }
  });
});
