import { describe, expect, it } from "vitest";

import { estimateCost } from "./cost-estimator";

describe("estimateCost", () => {
  it("calcula o custo de gpt-4o-mini por tokens de entrada e saída", () => {
    expect(estimateCost("gpt-4o-mini", 1_000_000, 1_000_000)).toEqual({
      estimatedCostUsd: 0.75,
      rateKnown: true,
    });
  });

  it("arredonda a estimativa para seis casas decimais", () => {
    expect(estimateCost("gpt-4o-mini", 1, 1)).toEqual({
      estimatedCostUsd: 0.000001,
      rateKnown: true,
    });
  });

  it("calcula o custo de embeddings apenas pela entrada", () => {
    expect(estimateCost("text-embedding-3-small", 2_000_000, 5_000)).toEqual({
      estimatedCostUsd: 0.04,
      rateKnown: true,
    });
  });

  it("não inventa preço para modelo desconhecido", () => {
    expect(estimateCost("unknown-model", 10_000, 10_000)).toEqual({
      estimatedCostUsd: 0,
      rateKnown: false,
    });
  });

  it("aceita contagens ausentes como zero", () => {
    expect(estimateCost("gpt-4o-mini")).toEqual({
      estimatedCostUsd: 0,
      rateKnown: true,
    });
  });
});
