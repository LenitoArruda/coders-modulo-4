import { describe, expect, it, vi } from "vitest";

import { notFoundOutsidePrefixMiddleware } from "./not-found.middleware";

function call(path: string, prefix = "api/v1") {
  const next = vi.fn();
  const response = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  };

  notFoundOutsidePrefixMiddleware(prefix)(
    { path } as never,
    response as never,
    next,
  );

  return { next, response };
}

describe("notFoundOutsidePrefixMiddleware", () => {
  it("deve seguir adiante para caminhos dentro do prefixo", () => {
    expect(call("/api/v1/hello").next).toHaveBeenCalled();
    expect(call("/api/v1").next).toHaveBeenCalled();
    expect(call("/api/v1/").next).toHaveBeenCalled();
  });

  it("não deve tratar prefixos parciais como dentro do namespace", () => {
    expect(call("/api/v1outro").next).not.toHaveBeenCalled();
  });

  it("deve responder 404 com contrato para caminhos fora do prefixo", () => {
    const { next, response } = call("/");

    expect(next).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({
      code: "NOT_FOUND",
      message: "Resource not found.",
    });
  });

  it("deve responder 404 para outros namespaces", () => {
    const { next, response } = call("/api/v2/hello");

    expect(next).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(404);
  });
});
