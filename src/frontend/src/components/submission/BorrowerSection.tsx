import { useLoanSubmissionStore } from "@/state/submissionStore";
import type { BorrowerDraft } from "@/types/submission";

export function BorrowerSection({ type = "primary_borrower" }: { type?: BorrowerDraft["type"] }) {
  const { draft, upsertBorrower, addCoBorrower, removeBorrower, saveDraft } =
    useLoanSubmissionStore();
  const borrower = draft.borrowers.find((item) => item.type === type);

  if (!borrower && type === "co_borrower") {
    return (
      <section className="submission-card fade-slide-in">
        <h3>Adding a co-borrower can strengthen the application.</h3>
        <p className="muted">
          {draft.setup.product === "dscr"
            ? "Most DSCR loans do not require a co-borrower. You can skip this step."
            : "Add one when additional income, assets, or credit support helps the file."}
        </p>
        <button className="primary-button" type="button" onClick={addCoBorrower}>
          Add Co-Borrower
        </button>
      </section>
    );
  }

  if (!borrower) return null;

  return (
    <section className="submission-card fade-slide-in">
      <div className="form-grid">
        <TextField label="First name" value={borrower.firstName} onChange={(firstName) => upsertBorrower(borrower.id, { firstName })} />
        <TextField label="Last name" value={borrower.lastName} onChange={(lastName) => upsertBorrower(borrower.id, { lastName })} />
        <TextField label="SSN" value={maskSsnForDisplay(borrower.ssn)} onBlur={() => void saveDraft()} onChange={(ssn) => upsertBorrower(borrower.id, { ssn: ssn.replace(/\D/g, "") })} />
        <TextField label="Date of birth" type="date" value={borrower.dob ?? ""} onChange={(dob) => upsertBorrower(borrower.id, { dob })} />
        <TextField label="Email" value={borrower.email} onChange={(email) => upsertBorrower(borrower.id, { email })} />
        <TextField label="Phone" value={borrower.phone} onChange={(phone) => upsertBorrower(borrower.id, { phone })} />
        <label className="field">
          <span>Estimated middle FICO</span>
          <input
            inputMode="numeric"
            value={borrower.estimatedFico ?? ""}
            onChange={(event) =>
              upsertBorrower(borrower.id, {
                estimatedFico: event.target.value ? Number(event.target.value) : null,
              })
            }
          />
        </label>
      </div>
      <label className="field wide">
        <span>Current residential address</span>
        <input
          value={borrower.address.street1}
          onChange={(event) =>
            upsertBorrower(borrower.id, {
              address: { ...borrower.address, street1: event.target.value },
            })
          }
        />
      </label>
      {type === "co_borrower" ? (
        <button className="ghost-button" type="button" onClick={() => removeBorrower(borrower.id)}>
          Mark as no co-borrower
        </button>
      ) : null}
    </section>
  );
}

function TextField({
  label,
  value,
  type = "text",
  onChange,
  onBlur,
}: {
  label: string;
  value: string;
  type?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type={type} value={value} onBlur={onBlur} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function maskSsnForDisplay(ssn: string) {
  if (ssn.length < 9) return ssn;
  return `***-**-${ssn.slice(-4)}`;
}
