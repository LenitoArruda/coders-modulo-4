import { describe, expect, it } from "vitest";

import { sanitizePii, sanitizePiiMetadata } from "./pii-sanitizer";

describe("sanitizePii", () => {
  it("mascara e-mail e registra apenas o nome do padrão", () => {
    const result = sanitizePii("Contato: person@example.test");

    expect(result.value).toBe("Contato: [EMAIL]");
    expect(result.sanitized).toBe(true);
    expect(result.patterns).toContain("email");
    expect(result.value).not.toContain("person@example.test");
  });

  it("mascara telefone", () => {
    const result = sanitizePii("Telefone sintético: 11 9876-4321");

    expect(result.value).toBe("Telefone sintético: [PHONE]");
    expect(result.patterns).toContain("phone");
  });

  it("mascara tokens comuns", () => {
    const apiKey = sanitizePii("chave sk-abcdefghijklmnop");
    const bearer = sanitizePii("Authorization: Bearer abcdefgh123456");
    const session = sanitizePii("sessionToken=abcdefgh123456");

    expect(apiKey.value).toBe("chave [TOKEN]");
    expect(bearer.value).toBe("Authorization: [TOKEN]");
    expect(session.value).toBe("[TOKEN]");
    expect(apiKey.patterns).toContain("token");
    expect(bearer.patterns).toContain("token");
    expect(session.patterns).toContain("token");
  });

  it("não altera texto sem PII", () => {
    const result = sanitizePii("Resumo operacional sem dados pessoais");

    expect(result.value).toBe("Resumo operacional sem dados pessoais");
    expect(result.sanitized).toBe(false);
    expect(result.patterns).toEqual([]);
  });

  it("não confunde datas ISO com telefone", () => {
    const result = sanitizePii("2026-11-18T12:00:00.000Z");

    expect(result.value).toBe("2026-11-18T12:00:00.000Z");
    expect(result.patterns).not.toContain("phone");
  });
});

describe("sanitizePiiMetadata", () => {
  it("sanitiza valores aninhados e acumula padrões sem duplicar", () => {
    const result = sanitizePiiMetadata({
      note: "person@example.test",
      details: {
        phones: ["11 9876-4321", "11 9876-4321"],
        count: 2,
      },
    });

    expect(result.metadata).toEqual({
      note: "[EMAIL]",
      details: {
        phones: ["[PHONE]", "[PHONE]"],
        count: 2,
      },
    });
    expect(result.patterns).toEqual(["email", "phone"]);
  });
});
