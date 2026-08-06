/**
 * Every provider implements a single method:
 *
 *   assessClaim(input) -> Promise<{
 *     verdict: 'justified' | 'not_justified' | 'inconclusive',
 *     confidence: number,   // 0..1
 *     reasoning: string,
 *     raw: object,          // provider's raw response, stored for audit
 *   }>
 *
 * `input` shape:
 *   { claimText, claimType, formulaSummary, studySummary,
 *     sampleSize, methodology, measuredOutcome }
 *
 * Routes never talk to Anthropic/OpenAI/etc directly -- they call
 * getLlmProvider().assessClaim(). Swapping providers, or A/B testing two of
 * them, is a config change, not a routes/schema change.
 */
function getLlmProvider() {
  const providerName = (process.env.LLM_PROVIDER || "mock").toLowerCase();

  switch (providerName) {
    case "anthropic":
      return require("./anthropicProvider");
    case "mock":
      return require("./mockProvider");
    default:
      throw new Error(`Unknown LLM_PROVIDER "${providerName}". Use "anthropic" or "mock".`);
  }
}

module.exports = { getLlmProvider };
