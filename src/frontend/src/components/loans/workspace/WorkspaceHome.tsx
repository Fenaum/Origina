import { useEffect } from "react";
import { useRouter } from "next/router";
import { LoadingSpinner } from "@/components/feedback/LoadingSpinner";
import { useLoanDetail } from "@/hooks/useLoanDetail";
import { useRecentLoansStore } from "@/state/recentLoansStore";
import { loanProgramLabels, loanStatusLabels, type LoanSummary } from "@/types/loan";
import type { BorrowerOut } from "@/types/api";

type Props = { loan: LoanSummary };

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const PURPOSE_LABELS: Record<string, string> = {
  purchase: "Purchase",
  refinance: "Rate-Term Refinance",
  cash_out: "Cash-Out Refinance",
  other: "Other",
};

const INCOME_LABELS: Record<string, string> = {
  w2: "W-2",
  self_employed: "Self-Employed",
  bank_statement: "Bank Statement",
  "1099": "1099",
  rental: "Rental",
  assets: "Asset Depletion",
  pension_retirement: "Pension / Retirement",
};

const MOCK_TEAM = [
  { role: "Account Executive", name: "Marcus Webb", email: "m.webb@origina.dev", status: "Assigned" },
  { role: "Account Manager", name: "Priya Nair", email: "p.nair@origina.dev", status: "Assigned" },
  { role: "Processor", name: "Jordan Ramos", email: "j.ramos@origina.dev", status: "Active" },
  { role: "Underwriter", name: "Dana Kim", email: "d.kim@origina.dev", status: "Queued" },
  { role: "Disclosure Desk", name: "Alex Torres", email: "a.torres@origina.dev", status: "Pending" },
  { role: "Closer", name: "Unassigned", email: null, status: "Open" },
  { role: "Funder", name: "Simone Liu", email: "s.liu@origina.dev", status: "Standby" },
];

function fmtMoney(value: number | null | undefined): string {
  return value != null ? money.format(value) : "-";
}

function fmtPct(value: number | null | undefined): string {
  return value != null ? `${(value * 100).toFixed(1)}%` : "-";
}

function fmtRatio(value: number | null | undefined): string {
  return value != null ? value.toFixed(2) : "-";
}

function fmtDate(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);
}

function timeAgo(value: string): string {
  const ms = Date.now() - new Date(value).getTime();
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 30 ? `${days}d ago` : `${Math.floor(days / 30)}mo ago`;
}

function borrowerName(borrower: BorrowerOut | null): string {
  if (!borrower) return "-";
  return [borrower.first_name, borrower.last_name].filter(Boolean).join(" ") || "-";
}

function riskTone(kind: "ltv" | "dti" | "dscr" | "fico", value: number | null | undefined) {
  if (value == null) return "";
  if (kind === "ltv") return value > 0.9 ? "danger" : value > 0.8 ? "warn" : "";
  if (kind === "dti") return value > 0.5 ? "danger" : value > 0.43 ? "warn" : "";
  if (kind === "dscr") return value < 1 ? "danger" : value < 1.25 ? "warn" : "";
  return value < 620 ? "danger" : value < 680 ? "warn" : "";
}

export function WorkspaceHome({ loan }: Props) {
  const router = useRouter();
  const pushRecent = useRecentLoansStore((state) => state.push);
  const { detail, loading } = useLoanDetail(loan.id);

  useEffect(() => {
    pushRecent({ id: loan.id, borrowerName: loan.borrowerName, loanNumber: loan.loanNumber });
  }, [loan.id, loan.borrowerName, loan.loanNumber, pushRecent]);

  function goTo(section: string) {
    void router.push({ query: { loanId: loan.id, section } }, undefined, { shallow: true });
  }

  if (loading) {
    return (
      <div className="urla-loading">
        <LoadingSpinner label="Loading loan dashboard" />
      </div>
    );
  }

  const loanData = detail?.loan;
  const financials = detail?.financials;
  const terms = detail?.terms;
  const property = detail?.property;
  const borrowers = detail?.borrowers ?? [];
  const primary = borrowers.find((item) => item.type === "primary_borrower") ?? borrowers[0] ?? null;
  const coBorrower = borrowers.find((item) => item.type === "co_borrower") ?? null;

  const purpose = loanData?.purpose ? (PURPOSE_LABELS[loanData.purpose] ?? loanData.purpose) : "-";
  const product = loan.loanProgram ? (loanProgramLabels[loan.loanProgram] ?? loan.loanProgram) : "-";
  const propertyAddress = property
    ? [property.address1, property.city, property.state, property.postal_code].filter(Boolean).join(", ")
    : "-";

  const workflow = [
    {
      label: "Conditions",
      status: loan.conditionsOpen > 0 ? "Needs review" : "Clear",
      count: loan.conditionsOpen,
      tone: loan.conditionsOpen > 0 ? "warn" : "ok",
      section: "conditions",
    },
    { label: "Exceptions", status: "None open", count: 0, tone: "ok", section: "underwriting" },
    {
      label: "Documents",
      status: loan.actionsNeeded > 0 ? "Items needed" : "Current",
      count: loan.actionsNeeded,
      tone: loan.actionsNeeded > 0 ? "warn" : "ok",
      section: "documents",
    },
    { label: "Disclosures", status: "Not started", count: 0, tone: "neutral", section: "disclosures" },
    { label: "Funding", status: "Pending", count: 0, tone: "neutral", section: "funding" },
    { label: "Closing", status: "Not scheduled", count: 0, tone: "neutral", section: "closing" },
    { label: "Conversation", status: "No new messages", count: 0, tone: "neutral", section: "conversation" },
  ] as const;

  const activity = [
    { label: `Loan ${loan.loanNumber} created`, detail: "Loan record opened", time: loan.updatedAt },
    ...(loan.submittedAt
      ? [{ label: "Loan submitted", detail: "Workflow entered submission queue", time: loan.submittedAt }]
      : []),
    { label: `Status changed to ${loanStatusLabels[loan.status]}`, detail: "System status event", time: loan.updatedAt },
    ...(loan.conditionsOpen > 0
      ? [{ label: `${loan.conditionsOpen} conditions open`, detail: "Processor review required", time: loan.updatedAt }]
      : []),
  ];

  return (
    <div className="home-command">
      <section className="home-hero-bar" aria-label="Loan command center summary">
        <HeroMetric label="Loan" value={loan.loanNumber} />
        <HeroMetric label="Status" value={loanStatusLabels[loan.status]} pill />
        <HeroMetric label="Amount" value={fmtMoney(financials?.loan_amount ?? loan.loanAmount)} />
        <HeroMetric label="Product" value={product} />
        <HeroMetric label="Purpose" value={purpose} />
        <HeroMetric label="LTV" value={fmtPct(financials?.ltv)} tone={riskTone("ltv", financials?.ltv)} />
        <HeroMetric label="CLTV" value={fmtPct(financials?.cltv)} tone={riskTone("ltv", financials?.cltv)} />
        <HeroMetric label="DTI" value={fmtPct(financials?.debt_to_income)} tone={riskTone("dti", financials?.debt_to_income)} />
        <HeroMetric label="DSCR" value={fmtRatio(financials?.dscr)} tone={riskTone("dscr", financials?.dscr)} />
        <HeroMetric label="Submitted" value={fmtDate(loan.submittedAt)} />
        <HeroMetric label="Lock" value={terms?.interest_rate_locked ? "Locked" : "Not locked"} />
      </section>

      <div className="home-command-grid">
        <section className="home-panel home-panel--tall">
          <PanelHeader title="Borrower & Property" actionLabel="Open URLA" onAction={() => goTo("borrower-urla")} />
          <div className="home-block">
            <h4>Borrowers</h4>
            <FieldRow label="Primary" value={borrowerName(primary)} />
            <FieldRow label="Co-borrower" value={borrowerName(coBorrower)} />
            <FieldRow label="Email" value={primary?.email ?? "-"} />
            <FieldRow label="Phone" value={primary?.phone ?? "-"} />
            <FieldRow label="FICO" value={financials?.fico_score != null ? String(financials.fico_score) : "-"} tone={riskTone("fico", financials?.fico_score)} />
            <FieldRow label="Monthly income" value={fmtMoney(primary?.income_amount ?? financials?.monthly_income)} />
            <FieldRow label="Income type" value={primary?.income_type ? (INCOME_LABELS[primary.income_type] ?? primary.income_type) : "-"} />
            <FieldRow label="Employer" value={primary?.employer_name ?? "-"} />
          </div>
          <div className="home-block">
            <h4>Subject Property</h4>
            <FieldRow label="Address" value={propertyAddress} />
            <FieldRow label="Occupancy" value={property?.occupancy ?? loanData?.occupancy_type ?? "-"} />
            <FieldRow label="Type" value={property?.property_type ?? "-"} />
            <FieldRow label="Units" value="-" />
            <FieldRow label="Appraised value" value={fmtMoney(financials?.appraised_value)} />
            <FieldRow label="Purchase price" value={fmtMoney(financials?.purchase_price)} />
          </div>
        </section>

        <section className="home-panel home-panel--tall">
          <PanelHeader title="Loan Summary" actionLabel="Processing" onAction={() => goTo("processing")} />
          <div className="home-block">
            <FieldRow label="Loan amount" value={fmtMoney(financials?.loan_amount ?? loan.loanAmount)} />
            <FieldRow label="Product" value={product} />
            <FieldRow label="Purpose" value={purpose} />
            <FieldRow label="Impounds" value="Not entered" />
            <FieldRow label="Prepay penalty" value="Not entered" />
            <FieldRow label="Cash to close" value={fmtMoney(financials?.down_payment)} />
            <FieldRow label="Reserves" value={fmtMoney(financials?.cash_reserves)} />
            <FieldRow label="Lock expiration" value={fmtDate(terms?.lock_expiration_date)} />
            <FieldRow label="Current milestone" value={loanStatusLabels[loan.status]} />
          </div>

          <div className="home-workflow-list">
            <h4>Workflow Summary</h4>
            {workflow.map((item) => (
              <button
                key={item.label}
                type="button"
                className={`home-workflow-card home-workflow-card--${item.tone}`}
                onClick={() => goTo(item.section)}
              >
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.status}</small>
                </span>
                <b>{item.count}</b>
              </button>
            ))}
          </div>
        </section>

        <section className="home-panel home-panel--tall">
          <PanelHeader title="Internal Team" actionLabel="Parties" onAction={() => goTo("parties")} />
          <div className="home-team-list">
            {MOCK_TEAM.map((member) => (
              <article key={member.role} className="home-contact-card">
                <div>
                  <strong>{member.name}</strong>
                  <span>{member.role}</span>
                  {member.email ? <a href={`mailto:${member.email}`}>{member.email}</a> : <small>Assignment needed</small>}
                </div>
                <em>{member.status}</em>
              </article>
            ))}
          </div>

          <div className="home-activity">
            <h4>Recent Activity</h4>
            {activity.map((item, index) => (
              <article key={`${item.label}-${index}`} className="home-activity-item">
                <span className="home-activity-dot" aria-hidden />
                <div>
                  <strong>{item.label}</strong>
                  <small>{item.detail}</small>
                </div>
                <time>{timeAgo(item.time)}</time>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function HeroMetric({
  label,
  value,
  tone = "",
  pill = false,
}: {
  label: string;
  value: string;
  tone?: "" | "warn" | "danger";
  pill?: boolean;
}) {
  return (
    <div className={`home-hero-metric${tone ? ` home-hero-metric--${tone}` : ""}`}>
      <span>{label}</span>
      <strong className={pill ? "home-hero-pill" : ""}>{value}</strong>
    </div>
  );
}

function PanelHeader({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="home-panel-header">
      <h3>{title}</h3>
      <button type="button" onClick={onAction}>
        {actionLabel}
      </button>
    </div>
  );
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
