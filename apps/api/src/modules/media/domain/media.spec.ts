import { describe, expect, it } from "vitest";

import {
  DEFAULT_MEDIA_BRIEFING_MAX_LENGTH,
  detectMediaIntent,
  isTerminalStatus,
  MEDIA_MESSAGES,
  mediaIntroduction,
  nextAttempt,
} from "./media";

describe("detectMediaIntent", () => {
  it("detecta imagem com parâmetros controlados", () => {
    const intent = detectMediaIntent(
      "Create a minimalist portrait image about the product launch",
    );

    expect(intent).toEqual({
      outcome: "generate",
      parameters: {
        kind: "image",
        size: "1024x1536",
        style: "minimalist",
      },
    });
  });

  it("detecta vídeo com duração válida e resolução fixa", () => {
    const intent = detectMediaIntent(
      "Generate a 6 second video about onboarding",
    );

    expect(intent).toEqual({
      outcome: "generate",
      parameters: {
        kind: "video",
        durationSeconds: 6,
        resolution: "720p",
      },
    });
  });

  it("não cria job quando o tipo está ausente", () => {
    expect(detectMediaIntent("Create something about the launch")).toEqual({
      outcome: "needs_type",
      message: MEDIA_MESSAGES.needsType,
    });
  });

  it("não cria job quando o tema está ausente", () => {
    expect(detectMediaIntent("Generate an image")).toEqual({
      outcome: "needs_topic",
      message: MEDIA_MESSAGES.needsTopic,
    });
  });

  it("sugere ajuste quando a duração excede o limite", () => {
    expect(detectMediaIntent("Make a 20 second video about the demo")).toEqual({
      outcome: "limit",
      message: MEDIA_MESSAGES.duration,
    });
  });

  it("sugere ajuste quando o briefing excede o limite", () => {
    const prompt = `Create an image about ${"x".repeat(DEFAULT_MEDIA_BRIEFING_MAX_LENGTH)}`;

    expect(detectMediaIntent(prompt)).toEqual({
      outcome: "limit",
      message: MEDIA_MESSAGES.briefingTooLong,
    });
  });

  it("não gera mídia em texto comum", () => {
    expect(detectMediaIntent("What does the handbook say?")).toEqual({
      outcome: "none",
    });
  });

  it("extrai marcador de citação sem enviar conteúdo da fonte", () => {
    const intent = detectMediaIntent("Create an image about the plan [2]");

    expect(intent).toMatchObject({
      outcome: "generate",
      parameters: { citationNumber: 2 },
    });
  });
});

describe("estados e mensagens", () => {
  it("considera terminais apenas ready, failed e cancelled", () => {
    expect(isTerminalStatus("queued")).toBe(false);
    expect(isTerminalStatus("generating")).toBe(false);
    expect(isTerminalStatus("ready")).toBe(true);
    expect(isTerminalStatus("failed")).toBe(true);
    expect(isTerminalStatus("cancelled")).toBe(true);
  });

  it("limita tentativas subsequentes", () => {
    expect(nextAttempt(0)).toBe(1);
    expect(nextAttempt(2)).toBe(3);
  });

  it("descreve o entregável mantendo o tom do Expert", () => {
    expect(
      mediaIntroduction("CMO Expert", {
        kind: "video",
        durationSeconds: 8,
        resolution: "720p",
      }),
    ).toContain("As the CMO Expert");
  });
});
