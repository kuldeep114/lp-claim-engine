import { useState } from "react";
import ClaimsList from "./components/ClaimsList";
import ClaimDetail from "./components/ClaimDetail";
import "./App.css";

export default function App() {
  const [selectedClaimId, setSelectedClaimId] = useState(null);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark">CE</span>
          <div>
            <div className="brand-name">Claims Engine</div>
            <div className="brand-sub">L'Oréal Paris R&I</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          <button
            className="nav-item active"
            onClick={() => setSelectedClaimId(null)}
            type="button"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4" />
              <path d="M14.5 3.5a2.121 2.121 0 1 1 3 3L9 15l-4 1 1-4 8.5-8.5Z" />
            </svg>
            Claims
          </button>
        </nav>
        <div className="sidebar-footer">Claim substantiation via LLM assessment</div>
      </aside>

      <div className="main">
        {selectedClaimId ? (
          <ClaimDetail claimId={selectedClaimId} onBack={() => setSelectedClaimId(null)} />
        ) : (
          <ClaimsList onSelectClaim={setSelectedClaimId} />
        )}
      </div>
    </div>
  );
}
