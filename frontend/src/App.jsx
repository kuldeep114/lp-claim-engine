import { useState } from "react";
import ClaimsList from "./components/ClaimsList";
import ClaimDetail from "./components/ClaimDetail";
import "./App.css";

export default function App() {
  const [selectedClaimId, setSelectedClaimId] = useState(null);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Claims Intelligence Engine</h1>
        <p className="hint">L'Oréal Paris R&I — claim substantiation via LLM assessment</p>
      </header>

      {selectedClaimId ? (
        <ClaimDetail claimId={selectedClaimId} onBack={() => setSelectedClaimId(null)} />
      ) : (
        <ClaimsList onSelectClaim={setSelectedClaimId} />
      )}
    </div>
  );
}
