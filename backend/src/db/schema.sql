-- Claims Intelligence Engine schema (PostgreSQL)
--
-- Mirrors the business flow: business team proposes a claim on a product ->
-- claim manager filters it (applicability/feasibility) -> scientist submits a
-- formulation to support it -> evaluator attaches a clinical study -> the
-- system asks an LLM whether the study justifies the claim.
--
-- One evaluation per study, kept as its own table (not a column on `studies`)
-- so re-running an assessment later is an insert, not a destructive update --
-- the history of what the LLM said, and when, is preserved.

CREATE TABLE IF NOT EXISTS claims (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_name TEXT NOT NULL,
  claim_text TEXT NOT NULL,
  claim_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed', 'filtered_in', 'filtered_out', 'approved', 'rejected')),
  filter_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS formulations (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  claim_id INTEGER NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  scientist_name TEXT NOT NULL,
  formula_summary TEXT NOT NULL,
  test_results TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS studies (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  formulation_id INTEGER NOT NULL REFERENCES formulations(id) ON DELETE CASCADE,
  evaluator_name TEXT NOT NULL,
  study_summary TEXT NOT NULL,
  sample_size INTEGER,
  methodology TEXT,
  measured_outcome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS evaluations (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  study_id INTEGER NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  verdict TEXT NOT NULL CHECK (verdict IN ('justified', 'not_justified', 'inconclusive')),
  confidence REAL NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  reasoning TEXT NOT NULL,
  llm_provider TEXT NOT NULL,
  llm_model TEXT,
  raw_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_formulations_claim_id ON formulations(claim_id);
CREATE INDEX IF NOT EXISTS idx_studies_formulation_id ON studies(formulation_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_study_id ON evaluations(study_id);
