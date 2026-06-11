import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { LoanSummary } from "@/types/loan";

type Props = { loan: LoanSummary };

type HmdaForm = {
  ethnicity: string;
  race: string;
  sex: string;
  age: string;
  censusTract: string;
  county: string;
  state: string;
  msaMd: string;
  loanPurpose: string;
  occupancy: string;
  loanType: string;
  lienStatus: string;
  hoepaStatus: string;
  reverseMortgage: string;
  businessPurpose: string;
  actionTaken: string;
};

const INITIAL_HMDA: HmdaForm = {
  ethnicity: "",
  race: "",
  sex: "",
  age: "",
  censusTract: "",
  county: "",
  state: "",
  msaMd: "",
  loanPurpose: "Purchase",
  occupancy: "",
  loanType: "Conventional",
  lienStatus: "First lien",
  hoepaStatus: "Not HOEPA",
  reverseMortgage: "No",
  businessPurpose: "Unknown",
  actionTaken: "Application received",
};

export function WorkspaceHMDA({ loan }: Props) {
  const [form, setForm] = useState<HmdaForm>({
    ...INITIAL_HMDA,
    state: loan.propertyState === "-" ? "" : loan.propertyState,
  });

  const required = useMemo(
    () => [
      ["ethnicity", "Borrower ethnicity"],
      ["race", "Borrower race"],
      ["sex", "Borrower sex"],
      ["age", "Borrower age"],
      ["censusTract", "Census tract"],
      ["county", "County"],
      ["state", "State"],
      ["occupancy", "Occupancy"],
      ["actionTaken", "Action taken"],
    ] as const,
    [],
  );

  const missing = required
    .filter(([key]) => !form[key])
    .map(([, label]) => label);
  const completion = Math.round(((required.length - missing.length) / required.length) * 100);
  const warnings = [
    !form.msaMd ? "MSA/MD is not populated yet." : null,
    form.businessPurpose === "Unknown" ? "Business purpose flag needs confirmation." : null,
  ].filter(Boolean) as string[];

  function patch(key: keyof HmdaForm, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="workspace-module workspace-module--wide">
      <SectionHeader
        eyebrow="Compliance"
        title="HMDA Workspace"
        description="Capture HMDA-reportable borrower, property, and loan fields with live completion checks."
      />

      <div className="workspace-two-column">
        <div className="workspace-panel-stack">
          <HmdaPanel title="Borrower Information">
            <WorkspaceField label="Ethnicity" value={form.ethnicity} onChange={(v) => patch("ethnicity", v)} />
            <WorkspaceField label="Race" value={form.race} onChange={(v) => patch("race", v)} />
            <WorkspaceField label="Sex" value={form.sex} onChange={(v) => patch("sex", v)} />
            <WorkspaceField label="Age" type="number" value={form.age} onChange={(v) => patch("age", v)} />
          </HmdaPanel>

          <HmdaPanel title="Property Information">
            <WorkspaceField label="Census Tract" value={form.censusTract} onChange={(v) => patch("censusTract", v)} />
            <WorkspaceField label="County" value={form.county} onChange={(v) => patch("county", v)} />
            <WorkspaceField label="State" value={form.state} onChange={(v) => patch("state", v)} />
            <WorkspaceField label="MSA/MD" value={form.msaMd} onChange={(v) => patch("msaMd", v)} />
          </HmdaPanel>

          <HmdaPanel title="Loan Information">
            <WorkspaceField label="Loan Purpose" value={form.loanPurpose} onChange={(v) => patch("loanPurpose", v)} />
            <WorkspaceField label="Occupancy" value={form.occupancy} onChange={(v) => patch("occupancy", v)} />
            <WorkspaceField label="Loan Type" value={form.loanType} onChange={(v) => patch("loanType", v)} />
            <WorkspaceField label="Lien Status" value={form.lienStatus} onChange={(v) => patch("lienStatus", v)} />
            <WorkspaceField label="HOEPA Status" value={form.hoepaStatus} onChange={(v) => patch("hoepaStatus", v)} />
            <WorkspaceField label="Reverse Mortgage" value={form.reverseMortgage} onChange={(v) => patch("reverseMortgage", v)} />
            <WorkspaceField label="Business Purpose" value={form.businessPurpose} onChange={(v) => patch("businessPurpose", v)} />
            <WorkspaceField label="Action Taken" value={form.actionTaken} onChange={(v) => patch("actionTaken", v)} />
          </HmdaPanel>
        </div>

        <aside className="workspace-sticky-panel">
          <div className="workspace-panel-header">
            <span>Validation</span>
            <strong>{completion}%</strong>
          </div>
          <div className="workspace-progress-track">
            <div style={{ width: `${completion}%` }} />
          </div>
          <StatusLine label="HMDA reportable" value={missing.length === 0 ? "Likely yes" : "Unknown"} tone={missing.length === 0 ? "success" : "warning"} />

          <div className="workspace-validation-group">
            <h4>Missing Required Fields</h4>
            {missing.length === 0 ? (
              <p className="workspace-clear-text">No required HMDA fields are missing.</p>
            ) : (
              missing.map((item) => <p key={item} className="workspace-error-text">{item}</p>)
            )}
          </div>

          <div className="workspace-validation-group">
            <h4>Warnings</h4>
            {warnings.length === 0 ? (
              <p className="workspace-clear-text">No HMDA warnings.</p>
            ) : (
              warnings.map((item) => <p key={item} className="workspace-warning-text">{item}</p>)
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function HmdaPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="workspace-panel">
      <h3>{title}</h3>
      <div className="workspace-form-grid">{children}</div>
    </section>
  );
}

function WorkspaceField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "number";
}) {
  return (
    <label className="workspace-field">
      <span>{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="workspace-section-header">
      <span>{eyebrow}</span>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}

function StatusLine({ label, value, tone }: { label: string; value: string; tone: "success" | "warning" }) {
  return (
    <div className={`workspace-status-line workspace-status-line--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
