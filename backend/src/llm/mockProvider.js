// Deterministic stand-in behind the same interface as anthropicProvider.js.
// Useful for local dev without burning API calls, and for tests that assert
// on route/DB behavior without depending on a real model's output.
async function assessClaim(input) {
  const { sampleSize, methodology, measuredOutcome } = input;

  let verdict = "inconclusive";
  let confidence = 0.4;
  let reasoning =
    "Mock provider: insufficient structured data (sample size/methodology/outcome) to judge.";

  if (measuredOutcome && sampleSize && sampleSize >= 30 && methodology) {
    verdict = "justified";
    confidence = 0.75;
    reasoning = `Mock provider: study reports a measured outcome ("${measuredOutcome}") with a sample size of ${sampleSize} and a stated methodology, so the claim is treated as supported. This is a heuristic stand-in, not a real assessment -- set LLM_PROVIDER=anthropic for a real one.`;
  } else if (measuredOutcome && sampleSize && sampleSize < 30) {
    verdict = "inconclusive";
    confidence = 0.5;
    reasoning = `Mock provider: sample size of ${sampleSize} is below the n=30 heuristic threshold used here, so the result is treated as underpowered.`;
  }

  return {
    verdict,
    confidence,
    reasoning,
    raw: { mock: true, input },
  };
}

module.exports = { assessClaim, providerName: "mock", model: "heuristic-v1" };
