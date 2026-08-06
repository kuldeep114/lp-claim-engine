import { useEffect, useState } from "react";
import { api } from "../api";

const STATUS_LABELS = {
  proposed: "Proposed",
  filtered_in: "Filtered in",
  filtered_out: "Filtered out",
  approved: "Approved",
  rejected: "Rejected",
};

const EMPTY_FORM = { product_name: "", claim_text: "", claim_type: "" };

export default function ClaimsList({ onSelectClaim }) {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

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

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.createClaim(form);
      setForm(EMPTY_FORM);
      await loadClaims();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <section className="panel">
        <h2>New claim</h2>
        <p className="hint">Business team proposes a product + claim.</p>
        <form onSubmit={handleSubmit} className="stack">
          <label>
            Product name
            <input
              required
              value={form.product_name}
              onChange={(e) => setForm({ ...form, product_name: e.target.value })}
              placeholder="HydraGlow Night Serum"
            />
          </label>
          <label>
            Claim
            <input
              required
              value={form.claim_text}
              onChange={(e) => setForm({ ...form, claim_text: e.target.value })}
              placeholder="Reduces the appearance of wrinkles by 20% in 4 weeks"
            />
          </label>
          <label>
            Claim type
            <input
              required
              value={form.claim_type}
              onChange={(e) => setForm({ ...form, claim_type: e.target.value })}
              placeholder="anti-aging"
            />
          </label>
          <button type="submit" disabled={submitting}>
            {submitting ? "Submitting..." : "Submit claim"}
          </button>
        </form>
      </section>

      <section className="panel">
        <h2>Claims</h2>
        {error && <p className="error">{error}</p>}
        {loading ? (
          <p className="hint">Loading...</p>
        ) : claims.length === 0 ? (
          <p className="hint">No claims yet — submit one above.</p>
        ) : (
          <ul className="claim-list">
            {claims.map((claim) => (
              <li key={claim.id}>
                <button className="claim-row" onClick={() => onSelectClaim(claim.id)}>
                  <div>
                    <strong>{claim.product_name}</strong>
                    <div className="hint">{claim.claim_text}</div>
                  </div>
                  <span className={`badge status-${claim.status}`}>
                    {STATUS_LABELS[claim.status] || claim.status}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
