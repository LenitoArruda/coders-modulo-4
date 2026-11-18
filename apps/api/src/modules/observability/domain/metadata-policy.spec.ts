import { describe, expect, it } from "vitest";

import { stripForbiddenMetadata } from "./metadata-policy";

describe("stripForbiddenMetadata", () => {
  it("remove chaves proibidas em todos os níveis", () => {
    const result = stripForbiddenMetadata({
      expertId: "cto",
      prompt: "texto sintético",
      nested: {
        api_key: "valor sintético",
        allowed: "ok",
        list: [{ answer: "x", sourceId: "source-1" }],
      },
    });

    expect(result).toEqual({
      expertId: "cto",
      nested: {
        allowed: "ok",
        list: [{ sourceId: "source-1" }],
      },
    });
  });

  it("normaliza variações de nome de chave", () => {
    expect(
      stripForbiddenMetadata({
        session_token: "valor sintético",
        authorization: "valor sintético",
        emailAddress: "valor sintético",
        traceId: "trace-1",
      }),
    ).toEqual({ traceId: "trace-1" });
  });
});
