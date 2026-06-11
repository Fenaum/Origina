import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { apiRequest } from "@/services/apiClient";
import { useAuth } from "@/state/auth";
import { loanStatusLabels } from "@/types/loan";
import type { LoanQuickInfoOut } from "@/types/api";

type Props = {
  loanId: string;
  x: number;
  y: number;
  onClose: () => void;
};

const fmt    = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const fmtPct = (v: number | null | undefined) => (v != null ? `${(v * 100).toFixed(1)}%` : "—");

const PURPOSE_LABELS: Record<string, string> = {
  purchase: "Purchase", refinance: "Rate & Term Refi", cash_out: "Cash-Out", other: "Other",
};

export function QuickLoanInfoCard({ loanId, x, y, onClose }: Props) {
  const { token } = useAuth();
  const cardRef    = useRef<HTMLDivElement>(null);
  const [info, setInfo]       = useState<LoanQuickInfoOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setLoading(true);
      apiRequest<LoanQuickInfoOut>(`/loans/${loanId}/quick-info`, { token })
        .then((d) => { if (!cancelled) { setInfo(d); setLoading(false); } })
        .catch((e: Error) => { if (!cancelled) { setError(e.message); setLoading(false); } });
    });
    return () => { cancelled = true; };
  }, [loanId, token]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    function handleClick(e: MouseEvent) {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [onClose]);

  const adjustedX = Math.max(8, Math.min(x + 8, window.innerWidth - 300));
  const adjustedY = Math.max(8, Math.min(y, window.innerHeight - 340));
  const displayError = token ? error : "You must be signed in to view quick info.";
  const isLoading = token ? loading : false;

  const card = (
    <div
      ref={cardRef}
      className="quick-info-card"
      style={{ left: adjustedX, top: adjustedY }}
      role="dialog"
      aria-label="Loan quick info"
    >
      {isLoading && (
        <div className="quick-info-loading">
          <span className="quick-info-spinner" /> Loading…
        </div>
      )}
      {displayError && <p className="quick-info-error">Could not load: {displayError}</p>}
      {info && !isLoading && (
        <>
          <div className="quick-info-header">
            <span className="quick-info-loan-number">{info.loan_number ?? "—"}</span>
            <span className={`status-pill status-pill--${info.status.replace(/_/g, "-")}`}>
              {loanStatusLabels[info.status as keyof typeof loanStatusLabels] ?? info.status}
            </span>
          </div>
          <p className="quick-info-borrower">{info.borrower_name}</p>
          {info.loan_program && <p className="quick-info-program">{info.loan_program.toUpperCase()}</p>}

          <div className="quick-info-grid">
            <QiField label="Loan Amount" value={info.loan_amount != null ? fmt.format(info.loan_amount) : "—"} />
            <QiField label="Purpose"     value={info.purpose ? (PURPOSE_LABELS[info.purpose] ?? info.purpose) : "—"} />
            <QiField label="State"       value={info.property_state ?? "—"} />
            <QiField label="LTV"         value={fmtPct(info.ltv)}           flag={flagLTV(info.ltv)} />
            <QiField label="CLTV"        value={fmtPct(info.cltv)}          flag={flagLTV(info.cltv)} />
            <QiField label="FICO"        value={info.fico_score != null ? String(info.fico_score) : "—"} flag={flagFICO(info.fico_score)} />
            <QiField label="DTI"         value={fmtPct(info.debt_to_income)} flag={flagDTI(info.debt_to_income)} />
            <QiField label="DSCR"        value={info.dscr != null ? info.dscr.toFixed(2) : "—"}          flag={flagDSCR(info.dscr)} />
          </div>

          <p className="quick-info-updated">Updated {formatAgo(info.updated_at)}</p>
        </>
      )}
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(card, document.body);
}

function QiField({ label, value, flag }: { label: string; value: string; flag?: "warn" | "danger" | "" }) {
  return (
    <div className="qi-field">
      <span className="qi-label">{label}</span>
      <span className={`qi-value${flag ? ` qi-value--${flag}` : ""}`}>{value}</span>
    </div>
  );
}

function flagLTV(v: number | null | undefined): "warn" | "danger" | "" {
  if (v == null) return "";
  return v > 0.9 ? "danger" : v > 0.8 ? "warn" : "";
}
function flagFICO(v: number | null | undefined): "warn" | "danger" | "" {
  if (v == null) return "";
  return v < 620 ? "danger" : v < 680 ? "warn" : "";
}
function flagDTI(v: number | null | undefined): "warn" | "danger" | "" {
  if (v == null) return "";
  return v > 0.5 ? "danger" : v > 0.43 ? "warn" : "";
}
function flagDSCR(v: number | null | undefined): "warn" | "danger" | "" {
  if (v == null) return "";
  return v < 1.0 ? "danger" : v < 1.25 ? "warn" : "";
}

function formatAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const h  = Math.floor(ms / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 30 ? `${d}d ago` : `${Math.floor(d / 30)}mo ago`;
}
