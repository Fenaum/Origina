import { useState } from "react";
import { apiRequest } from "@/services/apiClient";
import { useAuth } from "@/state/auth";
import type { LoanSummary } from "@/types/loan";

type Props = {
  loan: LoanSummary;
  onClose: () => void;
  onSuccess: () => void;
};

export function DeleteLoanModal({ loan, onClose, onSuccess }: Props) {
  const { token } = useAuth();
  const [reason, setReason]         = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [isArchiving, setIsArchiving] = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const CONFIRM_PHRASE = loan.loanNumber;
  const isConfirmed = confirmText === CONFIRM_PHRASE;

  async function handleArchive() {
    if (!token || !isConfirmed) return;
    setIsArchiving(true);
    setError(null);
    try {
      await apiRequest(`/loans/${loan.id}/archive`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ reason: reason || null }),
      });
      onSuccess();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsArchiving(false);
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Archive loan">
      <div className="modal-box modal-box--destructive">
        <div className="modal-header">
          <h2 className="modal-title modal-title--destructive">Archive Loan</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close" disabled={isArchiving}>✕</button>
        </div>

        <div className="modal-body">
          <div className="modal-danger-banner">
            🚫 This action archives the loan and removes it from the active pipeline. The loan record is retained for audit compliance. This action requires IT Admin or Account Manager permissions.
          </div>

          <p className="modal-loan-ref">
            Loan <strong>{loan.loanNumber}</strong> — {loan.borrowerName}
          </p>
          <p className="modal-loan-meta">Status: {loan.status} · {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(loan.loanAmount)}</p>

          <div className="modal-field">
            <label className="modal-label" htmlFor="archive-reason">Reason</label>
            <textarea
              id="archive-reason"
              className="modal-textarea"
              rows={2}
              placeholder="Provide a reason for archiving this loan…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div className="modal-field">
            <label className="modal-label" htmlFor="confirm-text">
              Type <strong>{CONFIRM_PHRASE}</strong> to confirm
            </label>
            <input
              id="confirm-text"
              className="modal-input"
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={CONFIRM_PHRASE}
              autoComplete="off"
            />
          </div>

          {error && <p className="modal-error">{error}</p>}
        </div>

        <div className="modal-footer">
          <button type="button" className="modal-btn modal-btn--ghost" onClick={onClose} disabled={isArchiving}>
            Cancel
          </button>
          <button
            type="button"
            className="modal-btn modal-btn--danger"
            onClick={handleArchive}
            disabled={!isConfirmed || isArchiving}
          >
            {isArchiving ? "Archiving…" : "Archive Loan"}
          </button>
        </div>
      </div>
    </div>
  );
}
