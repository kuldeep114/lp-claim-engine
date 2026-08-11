const express = require("express");
const { pool } = require("../db");
const { getLlmProvider } = require("../llm/llmProvider");

const router = express.Router();

function badRequest(res, message) {
  return res.status(400).json({ error: message });
}

function notFound(res, message) {
  return res.status(404).json({ error: message });
}

// A claim manager's "filtered_out" or "rejected" call ends the claim's
// pipeline. Formulations and studies shouldn't be submittable against a
// claim that's already been killed off.
const DEAD_CLAIM_STATUSES = ["filtered_out", "rejected"];

// -- Claims ------------------------------------------------------------

// Business team proposes a product + claim.
router.post("/claims", async (req, res, next) => {
  try {
    const { product_name, claim_text, claim_type } = req.body;
    if (!product_name || !claim_text || !claim_type) {
      return badRequest(res, "product_name, claim_text and claim_type are required");
    }

    const { rows } = await pool.query(
      `INSERT INTO claims (product_name, claim_text, claim_type)
       VALUES ($1, $2, $3) RETURNING *`,
      [product_name, claim_text, claim_type]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.get("/claims", async (req, res, next) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM claims ORDER BY created_at DESC`);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Claim manager filters a claim for applicability/feasibility.
router.patch("/claims/:id/status", async (req, res, next) => {
  try {
    const { status, filter_notes } = req.body;
    const allowed = ["proposed", "filtered_in", "filtered_out", "approved", "rejected"];
    if (!allowed.includes(status)) {
      return badRequest(res, `status must be one of: ${allowed.join(", ")}`);
    }

    const { rows } = await pool.query(
      `UPDATE claims SET status = $1, filter_notes = $2 WHERE id = $3 RETURNING *`,
      [status, filter_notes || null, req.params.id]
    );
    if (rows.length === 0) return notFound(res, "claim not found");
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// Full detail view: claim + its formulations, each with their studies + evaluation.
router.get("/claims/:id", async (req, res, next) => {
  try {
    const { rows: claimRows } = await pool.query(`SELECT * FROM claims WHERE id = $1`, [
      req.params.id,
    ]);
    const claim = claimRows[0];
    if (!claim) return notFound(res, "claim not found");

    const { rows: formulations } = await pool.query(
      `SELECT * FROM formulations WHERE claim_id = $1 ORDER BY created_at ASC`,
      [claim.id]
    );

    for (const formulation of formulations) {
      const { rows: studies } = await pool.query(
        `SELECT * FROM studies WHERE formulation_id = $1 ORDER BY created_at ASC`,
        [formulation.id]
      );

      for (const study of studies) {
        const { rows: evalRows } = await pool.query(
          `SELECT * FROM evaluations WHERE study_id = $1 ORDER BY created_at DESC LIMIT 1`,
          [study.id]
        );
        study.evaluation = evalRows[0] || null;
      }

      formulation.studies = studies;
    }

    claim.formulations = formulations;
    res.json(claim);
  } catch (err) {
    next(err);
  }
});

// -- Formulations --------------------------------------------------------

// Scientist submits a product formulation in support of a claim.
router.post("/claims/:id/formulations", async (req, res, next) => {
  try {
    const { rows: claimRows } = await pool.query(`SELECT * FROM claims WHERE id = $1`, [
      req.params.id,
    ]);
    const claim = claimRows[0];
    if (!claim) return notFound(res, "claim not found");
    if (DEAD_CLAIM_STATUSES.includes(claim.status)) {
      return badRequest(
        res,
        `cannot submit a formulation against a claim with status "${claim.status}"`
      );
    }

    const { scientist_name, formula_summary, test_results } = req.body;
    if (!scientist_name || !formula_summary) {
      return badRequest(res, "scientist_name and formula_summary are required");
    }

    const { rows } = await pool.query(
      `INSERT INTO formulations (claim_id, scientist_name, formula_summary, test_results)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [claim.id, scientist_name, formula_summary, test_results || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// -- Studies + LLM assessment --------------------------------------------

// Evaluator attaches a clinical study to a formulation. This is the step
// that triggers the LLM assessment described in the task: does the study
// justify the claim? The verdict is persisted before the response is sent,
// so the UI and the DB never disagree about what the LLM said.
router.post("/formulations/:id/studies", async (req, res, next) => {
  try {
    const { rows: formRows } = await pool.query(`SELECT * FROM formulations WHERE id = $1`, [
      req.params.id,
    ]);
    const formulation = formRows[0];
    if (!formulation) return notFound(res, "formulation not found");

    const { rows: claimRows } = await pool.query(`SELECT * FROM claims WHERE id = $1`, [
      formulation.claim_id,
    ]);
    const claim = claimRows[0];
    if (DEAD_CLAIM_STATUSES.includes(claim.status)) {
      return badRequest(
        res,
        `cannot submit a study against a claim with status "${claim.status}"`
      );
    }

    const { evaluator_name, study_summary, sample_size, methodology, measured_outcome } =
      req.body;
    if (!evaluator_name || !study_summary) {
      return badRequest(res, "evaluator_name and study_summary are required");
    }

    const { rows: studyRows } = await pool.query(
      `INSERT INTO studies
         (formulation_id, evaluator_name, study_summary, sample_size, methodology, measured_outcome)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        formulation.id,
        evaluator_name,
        study_summary,
        sample_size ?? null,
        methodology || null,
        measured_outcome || null,
      ]
    );
    const study = studyRows[0];

    let assessment;
    try {
      const provider = getLlmProvider();
      assessment = await provider.assessClaim({
        claimText: claim.claim_text,
        claimType: claim.claim_type,
        formulaSummary: formulation.formula_summary,
        studySummary: study.study_summary,
        sampleSize: study.sample_size,
        methodology: study.methodology,
        measuredOutcome: study.measured_outcome,
      });
    } catch (err) {
      console.error("LLM assessment failed:", err);
      return res.status(502).json({
        error: "LLM assessment failed",
        detail: err.message,
        study, // study is already saved; caller can retry the assessment separately in a real system
      });
    }

    const { rows: evalRows } = await pool.query(
      `INSERT INTO evaluations
         (study_id, verdict, confidence, reasoning, llm_provider, llm_model, raw_response)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        study.id,
        assessment.verdict,
        assessment.confidence,
        assessment.reasoning,
        process.env.LLM_PROVIDER || "mock",
        assessment.raw && assessment.raw.model,
        JSON.stringify(assessment.raw ?? {}),
      ]
    );

    res.status(201).json({ study, evaluation: evalRows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
