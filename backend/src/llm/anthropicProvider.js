const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

// Forcing the verdict through a tool call (instead of parsing free-text)
// means we get back validated JSON in the shape we asked for, not prose we
// have to hope parses -- the model literally cannot reply with anything else.
const RECORD_ASSESSMENT_TOOL = {
  name: "record_claim_assessment",
  description:
    "Record the assessment of whether a clinical study justifies a cosmetic product claim.",
  input_schema: {
    type: "object",
    properties: {
      verdict: {
        type: "string",
        enum: ["justified", "not_justified", "inconclusive"],
        description:
          "'justified' if the study data supports the claim as stated, 'not_justified' if it " +
          "contradicts or clearly fails to support it, 'inconclusive' if the study is too weak " +
          "(sample size, methodology, missing data) to say either way.",
      },
      confidence: {
        type: "number",
        description: "Confidence in this verdict, from 0 (guessing) to 1 (certain).",
      },
      reasoning: {
        type: "string",
        description:
          "2-4 sentences a claims reviewer could put in a report: cite the specific numbers/" +
          "methodology that drove the verdict.",
      },
    },
    required: ["verdict", "confidence", "reasoning"],
  },
};

function buildPrompt(input) {
  const {
    claimText,
    claimType,
    formulaSummary,
    studySummary,
    sampleSize,
    methodology,
    measuredOutcome,
  } = input;

  return `You are supporting a regulatory/claims-substantiation review at a cosmetics company.

Assess whether the clinical study below justifies the proposed product claim. Be skeptical:
a study only justifies a claim if its measured outcome, sample size, and methodology actually
support the specific wording of the claim (magnitude, timeframe, population). Vague or
underpowered studies should be 'inconclusive', not 'justified'.

## Proposed claim
Type: ${claimType}
Claim: "${claimText}"

## Product formulation
${formulaSummary}

## Clinical study submitted as evidence
Summary: ${studySummary}
Sample size: ${sampleSize ?? "not provided"}
Methodology: ${methodology || "not provided"}
Measured outcome: ${measuredOutcome || "not provided"}

Call record_claim_assessment with your verdict.`;
}

async function assessClaim(input) {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    tools: [RECORD_ASSESSMENT_TOOL],
    tool_choice: { type: "tool", name: "record_claim_assessment" },
    messages: [{ role: "user", content: buildPrompt(input) }],
  });

  const toolUse = message.content.find((block) => block.type === "tool_use");
  if (!toolUse) {
    throw new Error("Anthropic response did not include the expected tool_use block");
  }

  const { verdict, confidence, reasoning } = toolUse.input;
  return {
    verdict,
    confidence,
    reasoning,
    raw: message,
  };
}

module.exports = { assessClaim, providerName: "anthropic", model: MODEL };
