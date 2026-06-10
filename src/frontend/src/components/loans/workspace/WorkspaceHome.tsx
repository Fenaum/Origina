import { useEffect } from "react";
import { useRouter } from "next/router";
import { LoadingSpinner } from "@/components/feedback/LoadingSpinner";
import { useLoanDetail } from "@/hooks/useLoanDetail";
import { useRecentLoansStore } from "@/state/recentLoansStore";
import { loanStatusLabels, type LoanSummary } from "@/types/loan";
import type { BorrowerOut } from "@/types/api";

const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const fmtPct = (v: number | null | undefined) => (v != null ? `${(v * 100).toFixed(1)}%` : "—");

type Props = { loan: LoanSummary };

const PURPOSE_LABELS: Record<string, string> = {
  purchase: "Purchase",
  refinance: "Rate & Term Refinance",
  cash_out: "Cash-Out Refinance",
  other: "Other",
};

const INCOME_LABELS: Record<string, string> = {
  w2: "W-2 Employee", self_employed: "Self-Employed", bank_statement: "Bank Statement",
  "1099": "1099 Contractor", rental: "Rental (DSCR)", assets: "Asset Depletion",
  pension_retirement: "Pension / Retirement",
};

const MOCK_TEAM = [
  { name: "Marcus Webb",  role: "Account Executive", email: "m.webb@origina.dev",   ext: "x201", initials: "MW" },
  { name: "Priya Nair",   role: "Account Manager",   email: "p.nair@origina.dev",   ext: "x202", initials: "PN" },
  { name: "Jordan Ramos", role: "Processor",          email: "j.ramos@origina.dev",  ext: "x203", initials: "JR" },
  { name: "Dana Kim",     role: "Underwriter",        email: "d.kim@origina.dev",    ext: "x205", initials: "DK" },
  { name: "Alex Torres",  role: "Disclosure Clerk",   email: "a.torres@origina.dev", ext: "x207", initials: "AT" },
  { name: "Simone Liu",   role: "Funder",             email: "s.liu@origina.dev",    ext: "x210", initials: "SL" },
];

function kpiFlag(field: string, value: number | null | undefined): "warn" | "danger" | "" {
  if (value == null) return "";
  if (field === "ltv")  return value > 0.90 ? "danger" : value > 0.80 ? "warn" : "";
  if (field === "dti")  return value > 0.50 ? "danger" : value > 0.43 ? "warn" : "";
  if (field === "fico") return value < 620  ? "danger" : value < 680  ? "warn" : "";
  if (field === "dscr") return value < 1.00 ? "danger" : value < 1.25 ? "warn" : "";
  return "";
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 30 ? `${d}d ago` : `${Math.floor(d / 30)}mo ago`;
}

export function WorkspaceHome({ loan }: Props) {
  const router = useRouter();
  const push = useRecentLoansStore((state) => state.push);
  const { detail, loading } = useLoanDetail(loan.id);

  useEffect(() => {
    push({ id: loan.id, borrowerName: loan.borrowerName, loanNumber: loan.loanNumber });
  }, [loan.id, loan.borrowerName, loan.loanNumber, push]);

  function goTo(section: string) {
    void router.push({ query: { loanId: loan.id, section } }, undefined, { shallow: true });
  }

  if (loading) return <div className="urla-loading"><LoadingSpinner /></div>;

  const fin        = detail?.financials;
  const loanData   = detail?.loan;
  const property   = detail?.property;
  const borrowers  = detail?.borrowers ?? [];
  const primary    = borrowers.find((b) => b.type === "primary_borrower") ?? borrowers[0] ?? null;
  const coBorrower = borrowers.find((b) => b.type === "co_borrower") ?? null;

  const propAddress = property
    ? [property.address1, property.city, property.state, property.postal_code].filter(Boolean).join(", ")
    : null;

  const monthlyIncome = fin?.monthly_income;
  const annualIncome  = monthlyIncome != null ? monthlyIncome * 12 : null;

  const feed = [
    { icon: "📋", text: `Loan ${loan.loanNumber} created`, time: loan.updatedAt },
    { icon: "👤", text: `File assigned to ${loan.owner}`, time: loan.updatedAt },
    ...(loan.conditionsOpen > 0
      ? [{ icon: "📌", text: `${loan.conditionsOpen} open condition(s) pending review`, time: loan.updatedAt }]
      : []),
    ...(loan.submittedAt
      ? [{ icon: "📤", text: "Loan submitted for underwriting", time: loan.submittedAt }]
      : []),
    { icon: "🔄", text: `Status: ${loanStatusLabels[loan.status]}`, time: loan.updatedAt },
  ];

  return (
    <div className="home-wrapper">

      {/* Section 1 — Loan Snapshot */}
      <div className="home-section">
        <div className="home-section-header">
          <h3 className="home-section-title">Loan Snapshot</h3>
          <span className="status-pill">{loanStatusLabels[loan.status]}</span>
        </div>
        <div className="home-snapshot-grid">
          <SnapField label="Loan Number"    value={loan.loanNumber} />
          <SnapField label="Product"        value={loan.loanProgram} />
          <SnapField label="Purpose"        value={loanData?.purpose ? (PURPOSE_LABELS[loanData.purpose] ?? loanData.purpose) : null} />
          <SnapField label="Loan Amount"    value={fmt.format(loan.loanAmount)} />
          <SnapField label="Property State" value={loan.propertyState} />
          <SnapField label="Occupancy"      value={loanData?.occupancy_type ?? null} />
          <SnapField label="Channel"        value={loan.channel} />
          <SnapField label="Submitted"      value={loan.submittedAt ?? null} />
          <SnapField label="Last Updated"   value={loan.updatedAt} />
          <SnapField label="File Owner"     value={loan.owner} />
          {propAddress && <SnapField label="Subject Property" value={propAddress} wide />}
        </div>
      </div>

      {/* Section 2 — Key Risk Metrics */}
      {fin && (
        <div className="home-section">
          <h3 className="home-section-title">Key Risk Metrics</h3>
          <div className="home-kpi-row">
            <div className="home-kpi-group">
              <p className="home-kpi-group-label">Property</p>
              <div className="home-kpi-grid">
                <KpiCard label="Appraised Value" value={fin.appraised_value != null ? fmt.format(fin.appraised_value) : "—"} />
                <KpiCard label="Purchase Price"  value={fin.purchase_price  != null ? fmt.format(fin.purchase_price)  : "—"} />
                <KpiCard label="LTV"  value={fmtPct(fin.ltv)}  flag={kpiFlag("ltv",  fin.ltv)} />
                <KpiCard label="CLTV" value={fmtPct(fin.cltv)} flag={kpiFlag("ltv",  fin.cltv)} />
              </div>
            </div>
            <div className="home-kpi-group">
              <p className="home-kpi-group-label">Credit / Risk</p>
              <div className="home-kpi-grid">
                <KpiCard label="FICO Score"    value={fin.fico_score    != null ? String(fin.fico_score)      : "—"} flag={kpiFlag("fico", fin.fico_score)} />
                <KpiCard label="DTI"           value={fmtPct(fin.debt_to_income)}                                    flag={kpiFlag("dti",  fin.debt_to_income)} />
                <KpiCard label="DSCR"          value={fin.dscr          != null ? fin.dscr.toFixed(2)         : "—"} flag={kpiFlag("dscr", fin.dscr)} />
                <KpiCard label="Cash Reserves" value={fin.cash_reserves != null ? fmt.format(fin.cash_reserves) : "—"} />
              </div>
            </div>
            <div className="home-kpi-group">
              <p className="home-kpi-group-label">Income</p>
              <div className="home-kpi-grid">
                <KpiCard label="Monthly Income" value={monthlyIncome != null ? fmt.format(monthlyIncome) : "—"} />
                <KpiCard label="Annual Income"  value={annualIncome  != null ? fmt.format(annualIncome)  : "—"} />
                <KpiCard label="Monthly Rent"   value={fin.monthly_rent != null ? fmt.format(fin.monthly_rent) : "—"} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Section 3 — Internal Team */}
      <div className="home-section">
        <div className="home-section-header">
          <h3 className="home-section-title">Internal Team</h3>
          <button type="button" className="home-section-link" onClick={() => goTo("parties")}>View all parties →</button>
        </div>
        <div className="home-team-grid">
          {MOCK_TEAM.map((p) => (
            <div key={p.role} className="home-party-card">
              <div className="home-party-avatar">{p.initials}</div>
              <div className="home-party-info">
                <span className="home-party-name">{p.name}</span>
                <span className="home-party-role">{p.role}</span>
                <a href={`mailto:${p.email}`} className="home-party-contact">{p.email}</a>
                <span className="home-party-contact">{p.ext}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 4 — Outstanding Work */}
      <div className="home-section">
        <h3 className="home-section-title">Outstanding Work</h3>
        <div className="home-work-grid">
          <WorkItem label="Open Conditions"      count={loan.conditionsOpen}     onClick={() => goTo("conditions")}   color={loan.conditionsOpen > 0 ? "warn" : "ok"} />
          <WorkItem label="Submitted Conditions" count={loan.conditionsSubmitted} onClick={() => goTo("conditions")}   color="neutral" />
          <WorkItem label="Open Exceptions"      count={0}                        onClick={() => goTo("underwriting")} color="ok" />
          <WorkItem label="Pending Documents"    count={0}                        onClick={() => goTo("documents")}    color="ok" />
          <WorkItem label="Open Tasks"           count={loan.actionsNeeded}       onClick={() => goTo("processing")}   color={loan.actionsNeeded > 0 ? "warn" : "ok"} />
          <WorkItem label="Suspended Items"      count={0}                        onClick={() => goTo("underwriting")} color="ok" />
        </div>
      </div>

      {/* Section 5 — Borrower Summary */}
      {borrowers.length > 0 && (
        <div className="home-section">
          <div className="home-section-header">
            <h3 className="home-section-title">Borrower Summary</h3>
            <button type="button" className="home-section-link" onClick={() => goTo("borrower-urla")}>View full URLA →</button>
          </div>
          <div className="home-borrower-grid">
            {primary    && <BorrowerCard borrower={primary}    label="Primary Borrower" />}
            {coBorrower && <BorrowerCard borrower={coBorrower} label="Co-Borrower" />}
          </div>
        </div>
      )}

      {/* Section 6 — Activity Feed */}
      <div className="home-section">
        <h3 className="home-section-title">Recent Activity</h3>
        <div className="home-feed">
          {feed.map((item, i) => (
            <div key={i} className="home-feed-item">
              <span className="home-feed-icon">{item.icon}</span>
              <div className="home-feed-body">
                <span className="home-feed-text">{item.text}</span>
                <span className="home-feed-time">{timeAgo(item.time)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

function SnapField({ label, value, wide }: { label: string; value: string | null | undefined; wide?: boolean }) {
  return (
    <div className={`home-field${wide ? " home-field--wide" : ""}`}>
      <span className="home-field-label">{label}</span>
      <span className="home-field-value">{value ?? "—"}</span>
    </div>
  );
}

function KpiCard({ label, value, flag = "" }: { label: string; value: string; flag?: "warn" | "danger" | "" }) {
  return (
    <div className={`home-kpi-card${flag ? ` home-kpi-card--${flag}` : ""}`}>
      <span className="home-kpi-label">{label}</span>
      <span className="home-kpi-value">{value}</span>
    </div>
  );
}

function WorkItem({ label, count, onClick, color }: {
  label: string; count: number; onClick: () => void; color: "warn" | "ok" | "neutral";
}) {
  return (
    <button type="button" className={`home-work-item home-work-item--${color}`} onClick={onClick}>
      <span className="home-work-label">{label}</span>
      <span className="home-work-count">{count}</span>
    </button>
  );
}

function BorrowerCard({ borrower, label }: { borrower: BorrowerOut; label: string }) {
  const fullName = [borrower.first_name, borrower.last_name].filter(Boolean).join(" ") || "—";
  return (
    <div className="home-borrower-card">
      <div className="home-borrower-header">
        <span className="home-borrower-badge">{label}</span>
        <span className="home-borrower-name">{fullName}</span>
      </div>
      <div className="home-borrower-fields">
        <SnapField label="Email"         value={borrower.email} />
        <SnapField label="Phone"         value={borrower.phone} />
        <SnapField label="Employer"      value={borrower.employer_name} />
        <SnapField label="Income Type"   value={borrower.income_type ? (INCOME_LABELS[borrower.income_type] ?? borrower.income_type) : null} />
        <SnapField label="Monthly Income" value={borrower.income_amount != null ? fmt.format(Number(borrower.income_amount)) : null} />
      </div>
    </div>
  );
}
