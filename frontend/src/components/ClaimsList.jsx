import { useEffect, useState } from "react";
import { api } from "../api";

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

const EMPTY_FORM = { product_name: "", claim_text: "", claim_type: "" };

function StatusBadge({ status }) {
  return (
    <span className={`badge ${STATUS_BADGE_CLASS[status] || "badge-neutral"}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function NewClaimModal({ onClose, onCreated }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.createClaim(form);
      onCreated();
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>New claim</h2>
          <button className="modal-close" onClick={onClose} type="button" aria-label="Close">
            &times;
          </button>
        </div>
        <div className="modal-body">
          <p className="hint" style={{ marginTop: 0, marginBottom: 14 }}>
            Business team proposes a product and a claim to substantiate.
          </p>
          <form onSubmit={handleSubmit} className="stack">
            {error && <p className="error">{error}</p>}
            <div className="field">
              <label className="field-label">Product name</label>
              <input
                required
                value={form.product_name}
                onChange={(e) => setForm({ ...form, product_name: e.target.value })}
                placeholder="HydraGlow Night Serum"
              />
            </div>
            <div className="field">
              <label className="field-label">Claim</label>
              <input
                required
                value={form.claim_text}
                onChange={(e) => setForm({ ...form, claim_text: e.target.value })}
                placeholder="Reduces the appearance of wrinkles by 20% in 4 weeks"
              />
            </div>
            <div className="field">
              <label className="field-label">Claim type</label>
              <input
                required
                value={form.claim_type}
                onChange={(e) => setForm({ ...form, claim_type: e.target.value })}
                placeholder="anti-aging"
              />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? "Submitting..." : "Submit claim"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function ClaimsList({ onSelectClaim }) {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);

  async function loadClaims() {
    setLoading(true);
    setError(null);
    try {
      setClaims(await api.listClaims());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadClaims();
  }, []);

  const total = claims.length;
  const inReview = claims.filter((c) => c.status === "proposed" || c.status === "filtered_in")
    .length;
  const approved = claims.filter((c) => c.status === "approved").length;
  const closed = claims.filter((c) => c.status === "rejected" || c.status === "filtered_out")
    .length;

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">
          <h1>Claims</h1>
          <p className="hint">Track claim substantiation from proposal to LLM assessment.</p>
        </div>
        <div className="topbar-actions">
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + New claim
          </button>
        </div>
      </div>

      <div className="content">
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-value">{total}</div>
            <div className="stat-label">Total claims</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{inReview}</div>
            <div className="stat-label">Proposed / filtered in</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{approved}</div>
            <div className="stat-label">Approved</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{closed}</div>
            <div className="stat-label">Rejected / filtered out</div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2>All claims</h2>
          </div>

          {error && (
            <div style={{ padding: 16 }}>
              <p className="error">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="empty-state">Loading...</div>
          ) : claims.length === 0 ? (
            <div className="empty-state">No claims yet. Create one to get started.</div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Claim</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {claims.map((claim) => (
                    <tr key={claim.id} onClick={() => onSelectClaim(claim.id)}>
                      <td className="cell-primary">{claim.product_name}</td>
                      <td>
                        <div className="cell-sub">{claim.claim_text}</div>
                      </td>
                      <td>{claim.claim_type}</td>
                      <td>
                        <StatusBadge status={claim.status} />
                      </td>
                      <td className="hint">
                        {new Date(claim.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <NewClaimModal
          onClose={() => setShowModal(false)}
          onCreated={async () => {
            setShowModal(false);
            await loadClaims();
          }}
        />
      )}
    </>
  );
}
