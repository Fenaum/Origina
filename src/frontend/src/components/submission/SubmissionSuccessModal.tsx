import { useEffect, useRef } from "react";
import type { SubmitResult } from "@/types/submission";

type Props = {
  result: SubmitResult;
  onOpenLoan: () => void;
  onReturnToPipeline: () => void;
};

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function SubmissionSuccessModal({
  result,
  onOpenLoan,
  onReturnToPipeline,
}: Props) {
  const primaryRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    primaryRef.current?.focus();
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onReturnToPipeline();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onReturnToPipeline]);

  return (
    <div className="submission-result-backdrop" role="presentation">
      <section
        className="submission-result-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="submission-success-title"
      >
        <button
          type="button"
          className="submission-result-close"
          onClick={onReturnToPipeline}
          aria-label="Close and return to pipeline"
        >
          X
        </button>

        <div className="submission-success-mark" aria-hidden>
          <svg viewBox="0 0 52 52">
            <circle cx="26" cy="26" r="24" />
            <path d="M15 27.5 22.5 35 38 18" />
          </svg>
        </div>

        <div className="submission-result-heading">
          <p className="eyebrow">Workflow started</p>
          <h2 id="submission-success-title">Loan Submitted Successfully</h2>
          <p>
            Your loan has been submitted and entered the workflow.
            {result.loanNumber ? ` Loan Number: ${result.loanNumber}` : ""}
          </p>
        </div>

        <dl className="submission-result-summary">
          <SummaryItem label="Loan Number" value={result.loanNumber} />
          <SummaryItem label="Borrower" value={result.borrowerName} />
          <SummaryItem label="Product Type" value={formatProduct(result.productType)} />
          <SummaryItem
            label="Loan Amount"
            value={result.loanAmount != null ? currency.format(result.loanAmount) : null}
          />
          <SummaryItem label="Submitted" value={formatSubmittedAt(result.submittedAt)} />
        </dl>

        <div className="submission-result-actions">
          <button
            ref={primaryRef}
            type="button"
            className="primary-button"
            onClick={onOpenLoan}
          >
            Open Loan File
          </button>
          <button type="button" className="ghost-button" onClick={onReturnToPipeline}>
            Return to Pipeline
          </button>
        </div>
      </section>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value || "Not provided"}</dd>
    </div>
  );
}

function formatProduct(value: string | null): string | null {
  if (!value) return null;
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatSubmittedAt(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
