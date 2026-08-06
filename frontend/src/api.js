const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((data && data.error) || `Request failed: ${res.status}`);
  }
  return data;
}

export const api = {
  listClaims: () => request("/api/claims"),
  getClaim: (id) => request(`/api/claims/${id}`),
  createClaim: (body) => request("/api/claims", { method: "POST", body: JSON.stringify(body) }),
  updateClaimStatus: (id, body) =>
    request(`/api/claims/${id}/status`, { method: "PATCH", body: JSON.stringify(body) }),
  addFormulation: (claimId, body) =>
    request(`/api/claims/${claimId}/formulations`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  addStudy: (formulationId, body) =>
    request(`/api/formulations/${formulationId}/studies`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
