type ModelRates = {
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
};

/** USD per one million tokens. Kept in code so estimates stay deterministic. */
const MODEL_RATES: Record<string, ModelRates> = {
  "gpt-4o-mini": {
    inputUsdPerMillion: 0.15,
    outputUsdPerMillion: 0.6,
  },
  "text-embedding-3-small": {
    inputUsdPerMillion: 0.02,
    outputUsdPerMillion: 0,
  },
};

export type CostEstimate = {
  estimatedCostUsd: number;
  rateKnown: boolean;
};

/** Costs are rounded to six decimal places (thousandths of a millicent). */
export function estimateCost(
  modelId: string,
  tokensIn = 0,
  tokensOut = 0,
): CostEstimate {
  const rates = MODEL_RATES[modelId];

  if (rates === undefined) {
    return { estimatedCostUsd: 0, rateKnown: false };
  }

  const raw =
    (tokensIn * rates.inputUsdPerMillion +
      tokensOut * rates.outputUsdPerMillion) /
    1_000_000;

  return {
    estimatedCostUsd: Math.round(raw * 1_000_000) / 1_000_000,
    rateKnown: true,
  };
}
