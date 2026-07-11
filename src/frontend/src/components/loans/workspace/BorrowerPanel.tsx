// BorrowerPanel — read-only borrower summary panel for the loan workspace
// home. Split out from WorkspaceHome in Sprint 6 §6.2 so it can be unit-
// tested in isolation.
//
// Inputs come from `GET /loans/{id}/detail`'s `primary_borrower` and
// `co_borrowers` projections. The full BorrowerOut record is still
// available via `GET /borrowers/{id}` and via the legacy `borrowers`
// field on the LoanDetail hook.
import type {
  BorrowerOut,
  BorrowerSummaryOut,
  LoanFinancialsOut,
} from "@/types/api";

type Props = {
  primary: BorrowerSummaryOut | BorrowerOut | null;
  coBorrower: BorrowerSummaryOut | BorrowerOut | null;
  financials: LoanFinancialsOut | null;
};

const INCOME_LABELS: Record<string, string> = {
  salary: "Salary",
  hourly_wage: "Hourly Wage",
  commission: "Commission",
  bonus: "Bonus",
  self_employment: "Self-Employment",
  rental_income: "Rental",
  investment_income: "Investment",
  retirement_income: "Retirement",
  other: "Other",
};

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function nameOf(b: BorrowerSummaryOut | BorrowerOut | null): string {
  if (!b) return "—";
  const first = b.first_name ?? "";
  const last = b.last_name ?? "";
  const joined = `${first} ${last}`.trim();
  return joined || "—";
}

function incomeTypeLabel(value: string | null): string {
  if (!value) return "—";
  return INCOME_LABELS[value] ?? value;
}

function ficoTone(value: number | null | undefined): "" | "warn" | "danger" {
  if (value == null) return "";
  if (value < 620) return "danger";
  if (value < 680) return "warn";
  return "";
}

function FieldRow({
  label,
  value,
  tone = "",
}: {
  label: string;
  value: string;
  tone?: "" | "warn" | "danger";
}) {
  return (
    <div className={`home-field-row${tone ? ` home-field-row--${tone}` : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function BorrowerPanel({ primary, coBorrower, financials }: Props) {
  return (
    <div className="home-block">
      <h4>Borrowers</h4>
      <FieldRow label="Primary" value={nameOf(primary)} />
      <FieldRow label="Co-borrower" value={nameOf(coBorrower)} />
      <FieldRow label="Email" value={primary?.email ?? "—"} />
      <FieldRow label="Phone" value={primary?.phone ?? "—"} />
      <FieldRow
        label="FICO"
        value={financials?.fico_score != null ? String(financials.fico_score) : "—"}
        tone={ficoTone(financials?.fico_score)}
      />
      <FieldRow
        label="Monthly income"
        value={
          primary?.income_amount != null
            ? money.format(Number(primary.income_amount))
            : "—"
        }
      />
      <FieldRow label="Income type" value={incomeTypeLabel(primary?.income_type ?? null)} />
      <FieldRow label="Employer" value={primary?.employer_name ?? "—"} />
    </div>
  );
}
