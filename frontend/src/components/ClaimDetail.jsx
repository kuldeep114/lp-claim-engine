import { useEffect, useState } from "react";
import { api } from "../api";

const STATUS_OPTIONS = ["proposed", "filtered_in", "filtered_out", "approved", "rejected"];
const DEAD_STATUSES = ["filtered_out", "rejected"];

const STATUS_LABELS = {
  proposed: "Proposed",
  filtered_in: "Filtered in",
  filtered_out: "Filtered out",
  approved: "Approved",
  rejected: "Rejected",
};

const STATUS_BADGE_CLASS = {
  proposed: "badge-neutral",
  filtered_in: "badge-accent",
  filtered_out: "badge-bad",
  approved: "badge-good",
  rejected: "badge-bad",
};

const VERDICT_LABELS = {
  justified: "Justified",
  not_justified: "Not justified",
  inconclusive: "Inconclusive",
};

const VERDICT_BADGE_CLASS = {
  justified: "badge-good",
  not_justified: "badge-bad",
  inconclusive: "badge-warn",
};

function NewFormulationModal({ claimId, onClose, onAdded }) {
  const [form, setForm] = useState({ scientist_name: "", formula_summary: "", test_results: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.addFormulation(claimId, form);
      onAdded();
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Submit formulation</h2>
          <button className="modal-close" onClick={onClose} type="button" aria-label="Close">
            &times;
          </button>
        </div>
        <div className="modal-body">
          <p className="hint" style={{ marginTop: 0, marginBottom: 14 }}>
            Scientist submits a product formula in support of this claim.
          </p>
          <form onSubmit={handleSubmit} className="stack">
            {error && <p className="error">{error}</p>}
            <div className="field">
              <label className="field-label">Scientist name</label>
              <input
                required
                value={form.scientist_name}
                onChange={(e) => setForm({ ...form, scientist_name: e.target.value })}
              />
            </div>
            <div className="field">
              <label className="field-label">Formula summary</label>
              <textarea
                required
                value={form.formula_summary}
                onChange={(e) => setForm({ ...form, formula_summary: e.target.value })}
                placeholder="2% retinal + 5% niacinamide base, applied nightly"
              />
            </div>
            <div className="field">
              <label className="field-label">Internal test results (optional)</label>
              <textarea
                value={form.test_results}
                onChange={(e) => setForm({ ...form, test_results: e.target.value })}
                placeholder="In-vitro collagen synthesis assay showed 18% increase at 4 weeks"
              />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? "Submitting..." : "Submit formulation"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function StudyForm({ formulationId, onAdded, onCancel }) {
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
      onAdded();
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="study-row">
      <strong style={{ fontSize: 13 }}>Attach clinical study</strong>
      <p className="hint" style={{ margin: "4px 0 12px" }}>
        Evaluator attaches study results. Submitting triggers the LLM assessment.
      </p>
      <form onSubmit={handleSubmit} className="stack">
        {error && <p className="error">{error}</p>}
        <div className="form-row">
          <div className="field">
            <label className="field-label">Evaluator name</label>
            <input
              required
              value={form.evaluator_name}
              onChange={(e) => setForm({ ...form, evaluator_name: e.target.value })}
            />
          </div>
          <div className="field">
            <label className="field-label">Sample size</label>
            <input
              type="number"
              value={form.sample_size}
              onChange={(e) => setForm({ ...form, sample_size: e.target.value })}
            />
          </div>
        </div>
        <div className="field">
          <label className="field-label">Study summary</label>
          <textarea
            required
            value={form.study_summary}
            onChange={(e) => setForm({ ...form, study_summary: e.target.value })}
            placeholder="12-week double-blind, placebo-controlled study, 45 participants"
          />
        </div>
        <div className="form-row">
          <div className="field">
            <label className="field-label">Methodology</label>
            <input
              value={form.methodology}
              onChange={(e) => setForm({ ...form, methodology: e.target.value })}
              placeholder="double-blind, placebo-controlled"
            />
          </div>
          <div className="field">
            <label className="field-label">Measured outcome</label>
            <input
              value={form.measured_outcome}
              onChange={(e) => setForm({ ...form, measured_outcome: e.target.value })}
              placeholder="21% reduction at week 4 (p<0.01)"
            />
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Running LLM assessment..." : "Submit study & assess"}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function EvaluationPanel({ evaluation }) {
  if (!evaluation) return <p className="hint">Assessment not yet available.</p>;
  const badgeClass = VERDICT_BADGE_CLASS[evaluation.verdict] || "badge-neutral";
  return (
    <div className={`eval-panel verdict-${evaluation.verdict}`}>
      <div className="eval-header">
        <span className={`badge ${badgeClass}`}>
          {VERDICT_LABELS[evaluation.verdict] || evaluation.verdict}
        </span>
        <span className="hint">confidence {Math.round(evaluation.confidence * 100)}%</span>
        <span className="hint">via {evaluation.llm_provider}</span>
      </div>
      <p className="eval-reasoning">{evaluation.reasoning}</p>
    </div>
  );
}

export default function ClaimDetail({ claimId, onBack }) {
  const [claim, setClaim] = useState(null);
  const [error, setError] = useState(null);
  const [statusDraft, setStatusDraft] = useState({ status: "", filter_notes: "" });
  const [showFormulationModal, setShowFormulationModal] = useState(false);
  const [openStudyFormId, setOpenStudyFormId] = useState(null);

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

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">
          <button className="back-link" onClick={onBack} type="button">
            &larr; Back to claims
          </button>
        </div>
      </div>

      <div className="content">
        {error && <p className="error">{error}</p>}
        {!claim ? (
          <p className="hint">Loading...</p>
        ) : (
          <>
            <div className="panel">
              <div className="detail-header">
                <div>
                  <div className="detail-title">
                    <h1>{claim.product_name}</h1>
                    <span className={`badge ${STATUS_BADGE_CLASS[claim.status] || "badge-neutral"}`}>
                      {STATUS_LABELS[claim.status] || claim.status}
                    </span>
                  </div>
                  <p className="detail-claim-text">&ldquo;{claim.claim_text}&rdquo;</p>
                  <div className="detail-meta">
                    <span>Type: {claim.claim_type}</span>
                    <span>Created {new Date(claim.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              <form onSubmit={handleStatusUpdate} className="status-form">
                <div className="field">
                  <label className="field-label">Status (claim manager filter)</label>
                  <select
                    value={statusDraft.status}
                    onChange={(e) => setStatusDraft({ ...statusDraft, status: e.target.value })}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field grow">
                  <label className="field-label">Notes</label>
                  <input
                    value={statusDraft.filter_notes}
                    onChange={(e) =>
                      setStatusDraft({ ...statusDraft, filter_notes: e.target.value })
                    }
                    placeholder="Feasibility / applicability notes"
                  />
                </div>
                <button type="submit" className="btn btn-secondary">
                  Update
                </button>
              </form>
            </div>

            <div className="section-title">
              <h2>Formulations</h2>
              {!DEAD_STATUSES.includes(claim.status) && (
                <button
                  className="btn btn-secondary btn-sm"
                  type="button"
                  onClick={() => setShowFormulationModal(true)}
                >
                  + Add formulation
                </button>
              )}
            </div>

            {claim.formulations.length === 0 && (
              <p className="hint">
                No formulations submitted yet.
                {!DEAD_STATUSES.includes(claim.status) && ' Click "Add formulation" to start.'}
              </p>
            )}

            {claim.formulations.map((formulation) => (
              <div key={formulation.id} className="formulation-block">
                <div className="formulation-block-header">
                  <strong>{formulation.scientist_name}</strong>
                </div>
                <p className="formulation-summary">{formulation.formula_summary}</p>
                {formulation.test_results && (
                  <p className="hint" style={{ marginTop: 6 }}>
                    Internal test results: {formulation.test_results}
                  </p>
                )}

                {formulation.studies.map((study) => (
                  <div key={study.id} className="study-row">
                    <p style={{ margin: "0 0 4px" }}>
                      <strong>{study.evaluator_name}</strong>: {study.study_summary}
                    </p>
                    <div className="study-meta">
                      <span>n = {study.sample_size ?? "?"}</span>
                      <span>{study.methodology || "no methodology given"}</span>
                      <span>outcome: {study.measured_outcome || "not stated"}</span>
                    </div>
                    <EvaluationPanel evaluation={study.evaluation} />
                  </div>
                ))}

                {formulation.studies.length === 0 && (
                  <>
                    {DEAD_STATUSES.includes(claim.status) ? (
                      <p className="hint" style={{ marginTop: 12 }}>
                        This claim is {STATUS_LABELS[claim.status].toLowerCase()}, so no study can
                        be attached.
                      </p>
                    ) : openStudyFormId === formulation.id ? (
                      <StudyForm
                        formulationId={formulation.id}
                        onAdded={() => {
                          setOpenStudyFormId(null);
                          load();
                        }}
                        onCancel={() => setOpenStudyFormId(null)}
                      />
                    ) : (
                      <div className="study-row">
                        <button
                          className="btn btn-secondary btn-sm"
                          type="button"
                          onClick={() => setOpenStudyFormId(formulation.id)}
                        >
                          + Attach study
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </>
        )}
      </div>

      {showFormulationModal && (
        <NewFormulationModal
          claimId={claimId}
          onClose={() => setShowFormulationModal(false)}
          onAdded={async () => {
            setShowFormulationModal(false);
            await load();
          }}
        />
      )}
    </>
  );
}
