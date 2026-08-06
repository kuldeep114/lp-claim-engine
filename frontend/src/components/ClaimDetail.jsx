import { useEffect, useState } from "react";
import { api } from "../api";

const STATUS_OPTIONS = ["proposed", "filtered_in", "filtered_out", "approved", "rejected"];

const VERDICT_LABELS = {
  justified: "Justified",
  not_justified: "Not justified",
  inconclusive: "Inconclusive",
};

function FormulationForm({ claimId, onAdded }) {
  const [form, setForm] = useState({ scientist_name: "", formula_summary: "", test_results: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.addFormulation(claimId, form);
      setForm({ scientist_name: "", formula_summary: "", test_results: "" });
      onAdded();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="stack">
      <h4>Submit formulation</h4>
      <p className="hint">Scientist submits a product formula in support of this claim.</p>
      {error && <p className="error">{error}</p>}
      <label>
        Scientist name
        <input
          required
          value={form.scientist_name}
          onChange={(e) => setForm({ ...form, scientist_name: e.target.value })}
        />
      </label>
      <label>
        Formula summary
        <textarea
          required
          value={form.formula_summary}
          onChange={(e) => setForm({ ...form, formula_summary: e.target.value })}
          placeholder="2% retinal + 5% niacinamide base, applied nightly"
        />
      </label>
      <label>
        Internal test results (optional)
        <textarea
          value={form.test_results}
          onChange={(e) => setForm({ ...form, test_results: e.target.value })}
          placeholder="In-vitro collagen synthesis assay showed 18% increase at 4 weeks"
        />
      </label>
      <button type="submit" disabled={submitting}>
        {submitting ? "Submitting..." : "Submit formulation"}
      </button>
    </form>
  );
}

function StudyForm({ formulationId, onAdded }) {
  const [form, setForm] = useState({
    evaluator_name: "",
    study_summary: "",
    sample_size: "",
    methodology: "",
    measured_outcome: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.addStudy(formulationId, {
        ...form,
        sample_size: form.sample_size ? Number(form.sample_size) : null,
      });
      setForm({
        evaluator_name: "",
        study_summary: "",
        sample_size: "",
        methodology: "",
        measured_outcome: "",
      });
      onAdded();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="stack">
      <h5>Attach clinical study</h5>
      <p className="hint">
        Evaluator attaches study results. Submitting triggers the LLM assessment.
      </p>
      {error && <p className="error">{error}</p>}
      <label>
        Evaluator name
        <input
          required
          value={form.evaluator_name}
          onChange={(e) => setForm({ ...form, evaluator_name: e.target.value })}
        />
      </label>
      <label>
        Study summary
        <textarea
          required
          value={form.study_summary}
          onChange={(e) => setForm({ ...form, study_summary: e.target.value })}
          placeholder="12-week double-blind, placebo-controlled study, 45 participants"
        />
      </label>
      <label>
        Sample size
        <input
          type="number"
          value={form.sample_size}
          onChange={(e) => setForm({ ...form, sample_size: e.target.value })}
        />
      </label>
      <label>
        Methodology
        <input
          value={form.methodology}
          onChange={(e) => setForm({ ...form, methodology: e.target.value })}
          placeholder="double-blind, placebo-controlled"
        />
      </label>
      <label>
        Measured outcome
        <input
          value={form.measured_outcome}
          onChange={(e) => setForm({ ...form, measured_outcome: e.target.value })}
          placeholder="21% reduction in wrinkle depth at week 4 vs baseline (p<0.01)"
        />
      </label>
      <button type="submit" disabled={submitting}>
        {submitting ? "Running LLM assessment..." : "Submit study & assess"}
      </button>
    </form>
  );
}

function EvaluationCard({ evaluation }) {
  if (!evaluation) return <p className="hint">Assessment not yet available.</p>;
  return (
    <div className={`eval-card verdict-${evaluation.verdict}`}>
      <div className="eval-header">
        <span className="badge">{VERDICT_LABELS[evaluation.verdict] || evaluation.verdict}</span>
        <span className="hint">confidence {Math.round(evaluation.confidence * 100)}%</span>
        <span className="hint">via {evaluation.llm_provider}</span>
      </div>
      <p>{evaluation.reasoning}</p>
    </div>
  );
}

export default function ClaimDetail({ claimId, onBack }) {
  const [claim, setClaim] = useState(null);
  const [error, setError] = useState(null);
  const [statusDraft, setStatusDraft] = useState({ status: "", filter_notes: "" });

  async function load() {
    setError(null);
    try {
      const data = await api.getClaim(claimId);
      setClaim(data);
      setStatusDraft({ status: data.status, filter_notes: data.filter_notes || "" });
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claimId]);

  async function handleStatusUpdate(e) {
    e.preventDefault();
    try {
      await api.updateClaimStatus(claimId, statusDraft);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (error) return <p className="error">{error}</p>;
  if (!claim) return <p className="hint">Loading...</p>;

  return (
    <div className="page">
      <button className="link-button" onClick={onBack}>
        &larr; Back to claims
      </button>

      <section className="panel">
        <h2>{claim.product_name}</h2>
        <p>"{claim.claim_text}"</p>
        <p className="hint">Type: {claim.claim_type}</p>

        <form onSubmit={handleStatusUpdate} className="inline-form">
          <label>
            Status (claim manager filter)
            <select
              value={statusDraft.status}
              onChange={(e) => setStatusDraft({ ...statusDraft, status: e.target.value })}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label>
            Notes
            <input
              value={statusDraft.filter_notes}
              onChange={(e) => setStatusDraft({ ...statusDraft, filter_notes: e.target.value })}
              placeholder="Feasibility / applicability notes"
            />
          </label>
          <button type="submit">Update</button>
        </form>
      </section>

      <section className="panel">
        <h3>Formulations</h3>
        {claim.formulations.length === 0 && (
          <p className="hint">No formulations submitted yet.</p>
        )}
        {claim.formulations.map((formulation) => (
          <div key={formulation.id} className="formulation-card">
            <h4>{formulation.scientist_name}</h4>
            <p>{formulation.formula_summary}</p>
            {formulation.test_results && (
              <p className="hint">Internal test results: {formulation.test_results}</p>
            )}

            <h5>Studies</h5>
            {formulation.studies.length === 0 ? (
              <p className="hint">No study attached yet.</p>
            ) : (
              formulation.studies.map((study) => (
                <div key={study.id} className="study-card">
                  <p>
                    <strong>{study.evaluator_name}</strong>: {study.study_summary}
                  </p>
                  <p className="hint">
                    n={study.sample_size ?? "?"} · {study.methodology || "no methodology given"} ·
                    outcome: {study.measured_outcome || "not stated"}
                  </p>
                  <EvaluationCard evaluation={study.evaluation} />
                </div>
              ))
            )}

            {formulation.studies.length === 0 && (
              <StudyForm formulationId={formulation.id} onAdded={load} />
            )}
          </div>
        ))}

        <FormulationForm claimId={claim.id} onAdded={load} />
      </section>
    </div>
  );
}
