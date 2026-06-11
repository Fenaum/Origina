import { useState } from "react";
import { apiRequest } from "@/services/apiClient";
import { useAuth } from "@/state/auth";
import type { LoanSummary } from "@/types/loan";

type Props = {
  loan: LoanSummary;
  onClose: () => void;
  onSuccess: () => void;
};

// TODO: Replace with real tenant list from GET /tenants when available
const MOCK_TENANTS = [
  { id: "00000000-0000-0000-0000-000000000002", name: "Pacific Wholesale" },
  { id: "00000000-0000-0000-0000-000000000003", name: "Western Capital" },
  { id: "00000000-0000-0000-0000-000000000004", name: "Summit Lending" },
];

export function MoveTenantModal({ loan, onClose, onSuccess }: Props) {
  const { token } = useAuth();
  const [targetTenantId, setTargetTenantId] = useState("");
  const [reason, setReason]                 = useState("");
  const [isMoving, setIsMoving]             = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [confirmed, setConfirmed]           = useState(false);

  async function handleMove() {
    if (!token || !targetTenantId) return;
    setIsMoving(true);
    setError(null);
    try {
      await apiRequest(`/loans/${loan.id}/tenant`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ target_tenant_id: targetTenantId, reason: reason || null }),
      });
      onSuccess();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsMoving(false);
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Move loan to tenant">
      <div className="modal-box">
        <div className="modal-header">
          <h2 className="modal-title">Move Loan to Tenant</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="modal-body">
          <div className="modal-warn-banner">
            ⚠️ This is an administrative action. Moving a loan changes its visibility and ownership. This action will be logged.
          </div>

          <p className="modal-loan-ref">
            Loan <strong>{loan.loanNumber}</strong> — {loan.borrowerName}
          </p>

          <div className="modal-field">
            <label className="modal-label" htmlFor="target-tenant">Target Tenant</label>
            <select
              id="target-tenant"
              className="modal-select"
              value={targetTenantId}
              onChange={(e) => { setTargetTenantId(e.target.value); setConfirmed(false); }}
            >
              <option value="">— Select tenant —</option>
              {MOCK_TENANTS.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <p className="modal-hint">
              {/* TODO: Replace MOCK_TENANTS with real tenant API when GET /tenants is available */}
              Tenant list is currently using mock data.
            </p>
          </div>

          <div className="modal-field">
            <label className="modal-label" htmlFor="move-reason">Reason (recommended)</label>
            <textarea
              id="move-reason"
              className="modal-textarea"
              rows={3}
              placeholder="Describe why this loan is being moved…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {targetTenantId && !confirmed && (
            <label className="modal-confirm-check">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              I understand this action moves the loan and changes data access
            </label>
          )}

          {error && <p className="modal-error">{error}</p>}
        </div>

        <div className="modal-footer">
          <button type="button" className="modal-btn modal-btn--ghost" onClick={onClose} disabled={isMoving}>
            Cancel
          </button>
          <button
            type="button"
            className="modal-btn modal-btn--warn"
            onClick={handleMove}
            disabled={!targetTenantId || !confirmed || isMoving}
          >
            {isMoving ? "Moving…" : "Move Loan"}
          </button>
        </div>
      </div>
    </div>
  );
}
