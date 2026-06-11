import { useEffect, useState } from "react";
import { LoadingSpinner } from "@/components/feedback/LoadingSpinner";
import { WorkspaceSaveBar } from "@/components/loans/workspace/WorkspaceSaveBar";
import { WorkspaceFieldContextMenu } from "@/components/loans/workspace/WorkspaceFieldContextMenu";
import { useLoanDetail } from "@/hooks/useLoanDetail";
import { apiRequest } from "@/services/apiClient";
import { useAuth } from "@/state/auth";
import type { BorrowerOut } from "@/types/api";
import type { LoanSummary } from "@/types/loan";

type Props = { loan: LoanSummary };

// ── Section registry ───────────────────────────────────────────────────────────

type URLASectionId =
  | "personal" | "current-address" | "former-address"
  | "employment" | "income" | "assets" | "liabilities"
  | "real-estate" | "declarations" | "government";

const URLA_SECTIONS: { id: URLASectionId; number: string; label: string }[] = [
  { id: "personal",        number: "1a", label: "Personal Information"  },
  { id: "current-address", number: "1b", label: "Current Address"       },
  { id: "former-address",  number: "1c", label: "Former Address"        },
  { id: "employment",      number: "1d", label: "Employment"            },
  { id: "income",          number: "1e", label: "Income"                },
  { id: "assets",          number: "2a", label: "Assets"                },
  { id: "liabilities",     number: "2b", label: "Liabilities"           },
  { id: "real-estate",     number: "3",  label: "Real Estate Owned"     },
  { id: "declarations",    number: "4",  label: "Declarations"          },
  { id: "government",      number: "5",  label: "Govt. Monitoring"      },
];

// ── Types ──────────────────────────────────────────────────────────────────────

type BorrowerEdit = Partial<Pick<BorrowerOut,
  | "first_name" | "last_name" | "email" | "phone" | "dob"
  | "marital_status" | "dependents" | "relationship"
  | "employment_status" | "employer_name" | "job_title"
  | "years_on_job" | "years_in_profession" | "work_phone"
  | "income_type" | "income_amount"
>>;

type AssetItem     = { id: string; institution: string; accountType: string; last4: string; balance: string };
type LiabilityItem = { id: string; creditor: string; accountType: string; monthlyPayment: string; balance: string; excludeFromDTI: boolean };
type REOItem       = { id: string; address: string; propertyType: string; marketValue: string; mortgage: string; grossRental: string; netRental: string; propertyStatus: string };

type Declarations  = Record<string, boolean | null>;

type LocalBorrowerData = {
  curStreet: string; curUnit: string; curCity: string; curState: string; curZip: string;
  curYears: string; curHousing: string; curMonthly: string;
  fmrStreet: string; fmrCity: string; fmrState: string; fmrZip: string; fmrYears: string;
  assets: AssetItem[];
  liabilities: LiabilityItem[];
  reo: REOItem[];
  declarations: Declarations;
};

function defaultLocalData(): LocalBorrowerData {
  return {
    curStreet: "", curUnit: "", curCity: "", curState: "", curZip: "",
    curYears: "", curHousing: "", curMonthly: "",
    fmrStreet: "", fmrCity: "", fmrState: "", fmrZip: "", fmrYears: "",
    assets: [],
    liabilities: [],
    reo: [],
    declarations: {
      occupyPrimary: null, ownedPropertyLast3: null, borrowedDownPayment: null,
      coSignerOnDebt: null, outstandingJudgments: null, delinquentFedDebt: null,
      partyToLawsuit: null, priorForeclosure: null, bankruptcy7yr: null,
      usCitizen: null, permanentResident: null,
    },
  };
}

const DECLARATION_QUESTIONS: { key: string; label: string }[] = [
  { key: "occupyPrimary",       label: "Will you occupy the property as your primary residence?" },
  { key: "ownedPropertyLast3",  label: "Have you had an ownership interest in a property in the last 3 years?" },
  { key: "borrowedDownPayment", label: "Is any part of the down payment borrowed?" },
  { key: "coSignerOnDebt",      label: "Are you a co-signer on any other note, bond, or loan?" },
  { key: "outstandingJudgments",label: "Are there any outstanding judgments against you?" },
  { key: "delinquentFedDebt",   label: "Are you currently delinquent or in default on any federal debt?" },
  { key: "partyToLawsuit",      label: "Are you a party to a lawsuit?" },
  { key: "priorForeclosure",    label: "Have you had a property foreclosed or given a deed in lieu in the last 7 years?" },
  { key: "bankruptcy7yr",       label: "Have you declared bankruptcy within the past 7 years?" },
  { key: "usCitizen",           label: "Are you a U.S. citizen?" },
  { key: "permanentResident",   label: "Are you a permanent resident alien?" },
];

const INCOME_TYPE_LABELS: Record<string, string> = {
  w2: "W-2 Employee", self_employed: "Self-Employed", bank_statement: "Bank Statement",
  "1099": "1099 Contractor", rental: "Rental Income (DSCR)", assets: "Asset Depletion",
  pension_retirement: "Pension / Retirement", foreign: "Foreign Income", other: "Other",
};

const BORROWER_TYPE_LABELS: Record<string, string> = {
  primary_borrower: "Primary Borrower", co_borrower: "Co-Borrower",
  guarantor: "Guarantor", other: "Other",
};

// ── Completion helpers ─────────────────────────────────────────────────────────

type Dot = "complete" | "partial" | "empty";

function personDot(b: BorrowerOut, e: BorrowerEdit): Dot {
  const m = { ...b, ...e };
  if (m.first_name && m.last_name && m.dob) return "complete";
  if (m.first_name || m.last_name) return "partial";
  return "empty";
}
function addressDot(l: LocalBorrowerData): Dot {
  if (l.curStreet && l.curCity && l.curState && l.curZip) return "complete";
  if (l.curStreet || l.curCity) return "partial";
  return "empty";
}
function formerDot(l: LocalBorrowerData): Dot {
  const yrs = parseFloat(l.curYears);
  if (!isNaN(yrs) && yrs >= 2) return "complete";
  if (l.fmrStreet && l.fmrCity) return "complete";
  return "empty";
}
function employmentDot(b: BorrowerOut, e: BorrowerEdit): Dot {
  const m = { ...b, ...e };
  const exempt = ["retired", "investor"].includes(m.employment_status ?? "");
  if (exempt && m.employment_status) return "complete";
  if (m.employer_name && m.job_title) return "complete";
  if (m.employer_name || m.employment_status) return "partial";
  return "empty";
}
function incomeDot(b: BorrowerOut, e: BorrowerEdit): Dot {
  const m = { ...b, ...e };
  if (m.income_type && m.income_amount) return "complete";
  if (m.income_type || m.income_amount) return "partial";
  return "empty";
}
function listDot(arr: unknown[]): Dot {
  return arr.length > 0 ? "partial" : "empty";
}
function declarationsDot(d: Declarations): Dot {
  const vals = Object.values(d);
  if (vals.every((v) => v !== null)) return "complete";
  if (vals.some((v) => v !== null)) return "partial";
  return "empty";
}
function governmentDot(b: BorrowerOut): Dot {
  if (b.ethnicity && b.race && b.gender) return "complete";
  if (b.ethnicity || b.race || b.gender) return "partial";
  return "empty";
}

function sectionDot(
  section: URLASectionId,
  borrower: BorrowerOut,
  edit: BorrowerEdit,
  local: LocalBorrowerData,
): Dot {
  switch (section) {
    case "personal":        return personDot(borrower, edit);
    case "current-address": return addressDot(local);
    case "former-address":  return formerDot(local);
    case "employment":      return employmentDot(borrower, edit);
    case "income":          return incomeDot(borrower, edit);
    case "assets":          return listDot(local.assets);
    case "liabilities":     return listDot(local.liabilities);
    case "real-estate":     return listDot(local.reo);
    case "declarations":    return declarationsDot(local.declarations);
    case "government":      return governmentDot(borrower);
  }
}

// ── Small shared components ────────────────────────────────────────────────────

function ReadField({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="urla-field">
      <span className="urla-field-label">{label}</span>
      <span className="urla-field-value">{value ?? "—"}</span>
    </div>
  );
}

function InputField({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="urla-field">
      <label htmlFor={id} className="urla-field-label">{label}</label>
      {children}
    </div>
  );
}

function SectionHeader({ number, title, localOnly }: { number: string; title: string; localOnly?: boolean }) {
  return (
    <div className="urla-section-header">
      <span className="urla-section-number">Section {number}</span>
      <h3 className="urla-section-title">{title}</h3>
      {localOnly && <span className="urla-local-badge">Saved locally · Backend coming</span>}
    </div>
  );
}

// ── Section: Personal ─────────────────────────────────────────────────────────

function SectionPersonal({ borrower, edit, patch, loanId }: {
  borrower: BorrowerOut; edit: BorrowerEdit;
  patch: (p: BorrowerEdit) => void; loanId: string;
}) {
  const m = { ...borrower, ...edit };
  const f = (k: keyof BorrowerEdit) => ({
    id: `${borrower.id}-${k}`,
    value: (m[k] as string | number | undefined) ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      patch({ [k]: e.target.value || null }),
  });
  return (
    <div className="urla-section-content-body">
      <SectionHeader number="1a" title="Personal Information" />
      <div className="urla-field-grid">
        <WorkspaceFieldContextMenu loanId={loanId} meta={{ label: "First Name", apiKey: "first_name", dbColumn: "first_name", table: "borrowers", fieldType: "text", required: true }}>
          <InputField label="First Name" id={`${borrower.id}-first_name`}>
            <input className="urla-field-input" {...f("first_name")} />
          </InputField>
        </WorkspaceFieldContextMenu>
        <WorkspaceFieldContextMenu loanId={loanId} meta={{ label: "Last Name", apiKey: "last_name", dbColumn: "last_name", table: "borrowers", fieldType: "text", required: true }}>
          <InputField label="Last Name" id={`${borrower.id}-last_name`}>
            <input className="urla-field-input" {...f("last_name")} />
          </InputField>
        </WorkspaceFieldContextMenu>
        <WorkspaceFieldContextMenu loanId={loanId} meta={{ label: "Date of Birth", apiKey: "dob", dbColumn: "dob", table: "borrowers", fieldType: "date", required: false }}>
          <InputField label="Date of Birth" id={`${borrower.id}-dob`}>
            <input type="date" className="urla-field-input" {...f("dob")} />
          </InputField>
        </WorkspaceFieldContextMenu>
        <div className="urla-field">
          <span className="urla-field-label">SSN</span>
          <span className="urla-field-value urla-ssn">{borrower.ssn_last4 ? `···-··-${borrower.ssn_last4}` : "—"}</span>
        </div>
        <InputField label="Marital Status" id={`${borrower.id}-marital`}>
          <select className="urla-field-input" {...f("marital_status")}>
            <option value="">—</option>
            <option value="single">Single</option>
            <option value="married">Married</option>
            <option value="separated">Separated</option>
          </select>
        </InputField>
        <InputField label="Dependents" id={`${borrower.id}-dependents`}>
          <input type="number" min="0" className="urla-field-input"
            id={`${borrower.id}-dependents`}
            value={m.dependents ?? ""}
            onChange={(e) => patch({ dependents: e.target.value ? Number(e.target.value) : null })}
          />
        </InputField>
        <WorkspaceFieldContextMenu loanId={loanId} meta={{ label: "Email", apiKey: "email", dbColumn: "email", table: "borrowers", fieldType: "email", required: false }}>
          <InputField label="Email" id={`${borrower.id}-email`}>
            <input type="email" className="urla-field-input" {...f("email")} />
          </InputField>
        </WorkspaceFieldContextMenu>
        <WorkspaceFieldContextMenu loanId={loanId} meta={{ label: "Phone", apiKey: "phone", dbColumn: "phone", table: "borrowers", fieldType: "tel", required: false }}>
          <InputField label="Phone" id={`${borrower.id}-phone`}>
            <input type="tel" className="urla-field-input" {...f("phone")} />
          </InputField>
        </WorkspaceFieldContextMenu>
        <InputField label="Relationship to Borrower" id={`${borrower.id}-relationship`}>
          <input className="urla-field-input" {...f("relationship")} />
        </InputField>
      </div>
    </div>
  );
}

// ── Section: Current Address ───────────────────────────────────────────────────

function SectionCurrentAddress({ data, onChange }: {
  data: LocalBorrowerData;
  onChange: (patch: Partial<LocalBorrowerData>) => void;
}) {
  const f = (k: keyof LocalBorrowerData) => ({
    value: data[k] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      onChange({ [k]: e.target.value }),
  });
  return (
    <div className="urla-section-content-body">
      <SectionHeader number="1b" title="Current Address" localOnly />
      <div className="urla-field-grid">
        <div className="urla-field urla-field--wide">
          <label className="urla-field-label">Street Address</label>
          <input className="urla-field-input" {...f("curStreet")} placeholder="123 Main St" />
        </div>
        <div className="urla-field">
          <label className="urla-field-label">Unit / Apt</label>
          <input className="urla-field-input" {...f("curUnit")} placeholder="Unit 4B" />
        </div>
        <div className="urla-field">
          <label className="urla-field-label">City</label>
          <input className="urla-field-input" {...f("curCity")} />
        </div>
        <div className="urla-field">
          <label className="urla-field-label">State</label>
          <input className="urla-field-input urla-field-input--short" {...f("curState")} maxLength={2} placeholder="CA" />
        </div>
        <div className="urla-field">
          <label className="urla-field-label">ZIP Code</label>
          <input className="urla-field-input urla-field-input--short" {...f("curZip")} maxLength={10} placeholder="90210" />
        </div>
        <div className="urla-field">
          <label className="urla-field-label">Years at Address</label>
          <input type="number" min="0" className="urla-field-input urla-field-input--short" {...f("curYears")} />
        </div>
        <div className="urla-field">
          <label className="urla-field-label">Housing Type</label>
          <select className="urla-field-input" {...f("curHousing")}>
            <option value="">—</option>
            <option value="own">Own</option>
            <option value="rent">Rent</option>
            <option value="living_with_family">Living w/ Family</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="urla-field">
          <label className="urla-field-label">Monthly Housing Payment ($)</label>
          <input type="number" min="0" className="urla-field-input" {...f("curMonthly")} />
        </div>
      </div>
    </div>
  );
}

// ── Section: Former Address ────────────────────────────────────────────────────

function SectionFormerAddress({ data, onChange }: {
  data: LocalBorrowerData;
  onChange: (patch: Partial<LocalBorrowerData>) => void;
}) {
  const yrs = parseFloat(data.curYears);
  const notNeeded = !isNaN(yrs) && yrs >= 2;
  const f = (k: keyof LocalBorrowerData) => ({
    value: data[k] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange({ [k]: e.target.value }),
  });
  return (
    <div className="urla-section-content-body">
      <SectionHeader number="1c" title="Former Address" localOnly />
      {notNeeded ? (
        <p className="urla-info-note">
          Not required — borrower has been at current address for 2+ years.
        </p>
      ) : (
        <div className="urla-field-grid">
          <div className="urla-field urla-field--wide">
            <label className="urla-field-label">Street Address</label>
            <input className="urla-field-input" {...f("fmrStreet")} />
          </div>
          <div className="urla-field">
            <label className="urla-field-label">City</label>
            <input className="urla-field-input" {...f("fmrCity")} />
          </div>
          <div className="urla-field">
            <label className="urla-field-label">State</label>
            <input className="urla-field-input urla-field-input--short" {...f("fmrState")} maxLength={2} />
          </div>
          <div className="urla-field">
            <label className="urla-field-label">ZIP</label>
            <input className="urla-field-input urla-field-input--short" {...f("fmrZip")} maxLength={10} />
          </div>
          <div className="urla-field">
            <label className="urla-field-label">Years at Address</label>
            <input type="number" min="0" className="urla-field-input urla-field-input--short" {...f("fmrYears")} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Section: Employment ────────────────────────────────────────────────────────

function SectionEmployment({ borrower, edit, patch, loanId }: {
  borrower: BorrowerOut; edit: BorrowerEdit;
  patch: (p: BorrowerEdit) => void; loanId: string;
}) {
  const m = { ...borrower, ...edit };
  const f = (k: keyof BorrowerEdit) => ({
    id: `${borrower.id}-${k}`,
    value: (m[k] as string | number | undefined) ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      patch({ [k]: e.target.value || null }),
  });
  return (
    <div className="urla-section-content-body">
      <SectionHeader number="1d" title="Employment" />
      <div className="urla-field-grid">
        <InputField label="Employment Status" id={`${borrower.id}-employment_status`}>
          <select className="urla-field-input" {...f("employment_status")}>
            <option value="">—</option>
            <option value="employed">Employed</option>
            <option value="self_employed">Self-Employed</option>
            <option value="retired">Retired</option>
            <option value="investor">Investor</option>
            <option value="not_employed">Not Employed</option>
            <option value="other">Other</option>
          </select>
        </InputField>
        <WorkspaceFieldContextMenu loanId={loanId} meta={{ label: "Employer Name", apiKey: "employer_name", dbColumn: "employer_name", table: "borrowers", fieldType: "text", required: false }}>
          <InputField label="Employer / Business Name" id={`${borrower.id}-employer_name`}>
            <input className="urla-field-input" {...f("employer_name")} />
          </InputField>
        </WorkspaceFieldContextMenu>
        <WorkspaceFieldContextMenu loanId={loanId} meta={{ label: "Job Title", apiKey: "job_title", dbColumn: "job_title", table: "borrowers", fieldType: "text", required: false }}>
          <InputField label="Job Title / Position" id={`${borrower.id}-job_title`}>
            <input className="urla-field-input" {...f("job_title")} />
          </InputField>
        </WorkspaceFieldContextMenu>
        <InputField label="Work Phone" id={`${borrower.id}-work_phone`}>
          <input type="tel" className="urla-field-input" {...f("work_phone")} />
        </InputField>
        <InputField label="Years on Job" id={`${borrower.id}-years_on_job`}>
          <input type="number" min="0" step="0.5" className="urla-field-input urla-field-input--short"
            id={`${borrower.id}-years_on_job`}
            value={m.years_on_job ?? ""}
            onChange={(e) => patch({ years_on_job: e.target.value ? Number(e.target.value) : null })}
          />
        </InputField>
        <InputField label="Years in Profession" id={`${borrower.id}-years_in_profession`}>
          <input type="number" min="0" step="0.5" className="urla-field-input urla-field-input--short"
            id={`${borrower.id}-years_in_profession`}
            value={m.years_in_profession ?? ""}
            onChange={(e) => patch({ years_in_profession: e.target.value ? Number(e.target.value) : null })}
          />
        </InputField>
      </div>
    </div>
  );
}

// ── Section: Income ────────────────────────────────────────────────────────────

function SectionIncome({ borrower, edit, patch, loanId }: {
  borrower: BorrowerOut; edit: BorrowerEdit;
  patch: (p: BorrowerEdit) => void; loanId: string;
}) {
  const m = { ...borrower, ...edit };
  return (
    <div className="urla-section-content-body">
      <SectionHeader number="1e" title="Income" />
      <div className="urla-field-grid">
        <WorkspaceFieldContextMenu loanId={loanId} meta={{ label: "Income Type", apiKey: "income_type", dbColumn: "income_type", table: "borrowers", fieldType: "enum (borrower_income_type)", required: false }}>
          <div className="urla-field">
            <label className="urla-field-label" htmlFor={`${borrower.id}-income_type`}>Income Type</label>
            <select className="urla-field-input" id={`${borrower.id}-income_type`}
              value={m.income_type ?? ""}
              onChange={(e) => patch({ income_type: e.target.value || null })}
            >
              <option value="">—</option>
              {Object.entries(INCOME_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </WorkspaceFieldContextMenu>
        <WorkspaceFieldContextMenu loanId={loanId} meta={{ label: "Monthly Income", apiKey: "income_amount", dbColumn: "income_amount", table: "borrowers", fieldType: "numeric(14,2)", required: false, description: "Qualifying monthly income in dollars" }}>
          <div className="urla-field">
            <label className="urla-field-label" htmlFor={`${borrower.id}-income_amount`}>Monthly Income ($)</label>
            <input type="number" min="0" className="urla-field-input" id={`${borrower.id}-income_amount`}
              value={m.income_amount ?? ""}
              onChange={(e) => patch({ income_amount: e.target.value ? Number(e.target.value) : null })}
            />
          </div>
        </WorkspaceFieldContextMenu>
      </div>
      <p className="urla-info-note">Detailed income analysis is in Financial Analysis → Employment Income.</p>
    </div>
  );
}

// ── Section: Assets ────────────────────────────────────────────────────────────

function SectionAssets({ data, onChange }: {
  data: LocalBorrowerData; onChange: (patch: Partial<LocalBorrowerData>) => void;
}) {
  function addAsset() {
    const item: AssetItem = { id: crypto.randomUUID(), institution: "", accountType: "", last4: "", balance: "" };
    onChange({ assets: [...data.assets, item] });
  }
  function updateAsset(id: string, field: keyof AssetItem, value: string) {
    onChange({ assets: data.assets.map((a) => a.id === id ? { ...a, [field]: value } : a) });
  }
  function removeAsset(id: string) {
    onChange({ assets: data.assets.filter((a) => a.id !== id) });
  }
  return (
    <div className="urla-section-content-body">
      <SectionHeader number="2a" title="Assets" localOnly />
      <div className="urla-list-header">
        <span>Asset Accounts</span>
        <button type="button" className="urla-add-btn" onClick={addAsset}>+ Add Account</button>
      </div>
      {data.assets.length === 0 && (
        <p className="urla-empty-list">No asset accounts recorded. Click "+ Add Account" to begin.</p>
      )}
      {data.assets.map((a) => (
        <div key={a.id} className="urla-list-item">
          <div className="urla-list-item-grid">
            <div className="urla-field">
              <label className="urla-field-label">Institution</label>
              <input className="urla-field-input" value={a.institution}
                onChange={(e) => updateAsset(a.id, "institution", e.target.value)} />
            </div>
            <div className="urla-field">
              <label className="urla-field-label">Account Type</label>
              <select className="urla-field-input" value={a.accountType}
                onChange={(e) => updateAsset(a.id, "accountType", e.target.value)}>
                <option value="">—</option>
                <option value="checking">Checking</option>
                <option value="savings">Savings</option>
                <option value="money_market">Money Market</option>
                <option value="retirement_401k">401(k)</option>
                <option value="retirement_ira">IRA</option>
                <option value="brokerage">Brokerage</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="urla-field">
              <label className="urla-field-label">Account # (Last 4)</label>
              <input className="urla-field-input urla-field-input--short" value={a.last4}
                maxLength={4} placeholder="1234"
                onChange={(e) => updateAsset(a.id, "last4", e.target.value)} />
            </div>
            <div className="urla-field">
              <label className="urla-field-label">Current Balance ($)</label>
              <input type="number" min="0" className="urla-field-input" value={a.balance}
                onChange={(e) => updateAsset(a.id, "balance", e.target.value)} />
            </div>
          </div>
          <button type="button" className="urla-remove-btn" onClick={() => removeAsset(a.id)} aria-label="Remove asset">Remove</button>
        </div>
      ))}
    </div>
  );
}

// ── Section: Liabilities ───────────────────────────────────────────────────────

function SectionLiabilities({ data, onChange }: {
  data: LocalBorrowerData; onChange: (patch: Partial<LocalBorrowerData>) => void;
}) {
  function addLiability() {
    const item: LiabilityItem = { id: crypto.randomUUID(), creditor: "", accountType: "", monthlyPayment: "", balance: "", excludeFromDTI: false };
    onChange({ liabilities: [...data.liabilities, item] });
  }
  function update(id: string, field: keyof LiabilityItem, value: string | boolean) {
    onChange({ liabilities: data.liabilities.map((l) => l.id === id ? { ...l, [field]: value } : l) });
  }
  function remove(id: string) {
    onChange({ liabilities: data.liabilities.filter((l) => l.id !== id) });
  }
  return (
    <div className="urla-section-content-body">
      <SectionHeader number="2b" title="Liabilities" localOnly />
      <div className="urla-list-header">
        <span>Monthly Obligations</span>
        <button type="button" className="urla-add-btn" onClick={addLiability}>+ Add Liability</button>
      </div>
      {data.liabilities.length === 0 && (
        <p className="urla-empty-list">No liabilities recorded.</p>
      )}
      {data.liabilities.map((l) => (
        <div key={l.id} className="urla-list-item">
          <div className="urla-list-item-grid">
            <div className="urla-field">
              <label className="urla-field-label">Creditor</label>
              <input className="urla-field-input" value={l.creditor}
                onChange={(e) => update(l.id, "creditor", e.target.value)} />
            </div>
            <div className="urla-field">
              <label className="urla-field-label">Account Type</label>
              <select className="urla-field-input" value={l.accountType}
                onChange={(e) => update(l.id, "accountType", e.target.value)}>
                <option value="">—</option>
                <option value="revolving">Revolving (Credit Card)</option>
                <option value="installment">Installment (Auto/Student)</option>
                <option value="mortgage">Mortgage</option>
                <option value="heloc">HELOC</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="urla-field">
              <label className="urla-field-label">Monthly Payment ($)</label>
              <input type="number" min="0" className="urla-field-input" value={l.monthlyPayment}
                onChange={(e) => update(l.id, "monthlyPayment", e.target.value)} />
            </div>
            <div className="urla-field">
              <label className="urla-field-label">Outstanding Balance ($)</label>
              <input type="number" min="0" className="urla-field-input" value={l.balance}
                onChange={(e) => update(l.id, "balance", e.target.value)} />
            </div>
            <div className="urla-field urla-field--checkbox">
              <label className="urla-checkbox-label">
                <input type="checkbox" checked={l.excludeFromDTI}
                  onChange={(e) => update(l.id, "excludeFromDTI", e.target.checked)} />
                Exclude from DTI
              </label>
            </div>
          </div>
          <button type="button" className="urla-remove-btn" onClick={() => remove(l.id)}>Remove</button>
        </div>
      ))}
    </div>
  );
}

// ── Section: Real Estate Owned ─────────────────────────────────────────────────

function SectionREO({ data, onChange }: {
  data: LocalBorrowerData; onChange: (patch: Partial<LocalBorrowerData>) => void;
}) {
  function addREO() {
    const item: REOItem = { id: crypto.randomUUID(), address: "", propertyType: "", marketValue: "", mortgage: "", grossRental: "", netRental: "", propertyStatus: "" };
    onChange({ reo: [...data.reo, item] });
  }
  function update(id: string, field: keyof REOItem, value: string) {
    onChange({ reo: data.reo.map((r) => r.id === id ? { ...r, [field]: value } : r) });
  }
  function remove(id: string) {
    onChange({ reo: data.reo.filter((r) => r.id !== id) });
  }
  return (
    <div className="urla-section-content-body">
      <SectionHeader number="3" title="Real Estate Owned" localOnly />
      <div className="urla-list-header">
        <span>Properties</span>
        <button type="button" className="urla-add-btn" onClick={addREO}>+ Add Property</button>
      </div>
      {data.reo.length === 0 && (
        <p className="urla-empty-list">No owned properties recorded.</p>
      )}
      {data.reo.map((r) => (
        <div key={r.id} className="urla-list-item">
          <div className="urla-list-item-grid">
            <div className="urla-field urla-field--wide">
              <label className="urla-field-label">Property Address</label>
              <input className="urla-field-input" value={r.address}
                onChange={(e) => update(r.id, "address", e.target.value)} />
            </div>
            <div className="urla-field">
              <label className="urla-field-label">Property Type</label>
              <select className="urla-field-input" value={r.propertyType}
                onChange={(e) => update(r.id, "propertyType", e.target.value)}>
                <option value="">—</option>
                <option value="sfr">Single Family</option>
                <option value="condo">Condo</option>
                <option value="2-4">2–4 Unit</option>
                <option value="multi">Multifamily (5+)</option>
                <option value="commercial">Commercial</option>
                <option value="land">Land</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="urla-field">
              <label className="urla-field-label">Status</label>
              <select className="urla-field-input" value={r.propertyStatus}
                onChange={(e) => update(r.id, "propertyStatus", e.target.value)}>
                <option value="">—</option>
                <option value="primary">Primary Residence</option>
                <option value="investment">Investment</option>
                <option value="second_home">Second Home</option>
                <option value="pending_sale">Pending Sale</option>
                <option value="rental">Rental</option>
              </select>
            </div>
            <div className="urla-field">
              <label className="urla-field-label">Market Value ($)</label>
              <input type="number" min="0" className="urla-field-input" value={r.marketValue}
                onChange={(e) => update(r.id, "marketValue", e.target.value)} />
            </div>
            <div className="urla-field">
              <label className="urla-field-label">Mortgage Balance ($)</label>
              <input type="number" min="0" className="urla-field-input" value={r.mortgage}
                onChange={(e) => update(r.id, "mortgage", e.target.value)} />
            </div>
            <div className="urla-field">
              <label className="urla-field-label">Gross Rental Income ($)</label>
              <input type="number" min="0" className="urla-field-input" value={r.grossRental}
                onChange={(e) => update(r.id, "grossRental", e.target.value)} />
            </div>
            <div className="urla-field">
              <label className="urla-field-label">Net Rental Income ($)</label>
              <input type="number" min="0" className="urla-field-input" value={r.netRental}
                onChange={(e) => update(r.id, "netRental", e.target.value)} />
            </div>
          </div>
          <button type="button" className="urla-remove-btn" onClick={() => remove(r.id)}>Remove</button>
        </div>
      ))}
    </div>
  );
}

// ── Section: Declarations ──────────────────────────────────────────────────────

function SectionDeclarations({ data, onChange }: {
  data: LocalBorrowerData; onChange: (patch: Partial<LocalBorrowerData>) => void;
}) {
  function setDeclaration(key: string, value: boolean) {
    onChange({ declarations: { ...data.declarations, [key]: value } });
  }
  return (
    <div className="urla-section-content-body">
      <SectionHeader number="4" title="Declarations" localOnly />
      <p className="urla-info-note">Answer all questions below. These are required for the Uniform Residential Loan Application.</p>
      <div className="urla-declarations">
        {DECLARATION_QUESTIONS.map(({ key, label }) => {
          const val = data.declarations[key] ?? null;
          return (
            <div key={key} className="urla-decl-row">
              <span className="urla-decl-question">{label}</span>
              <div className="urla-decl-opts">
                <label className={`urla-decl-opt ${val === true ? "urla-decl-opt--selected" : ""}`}>
                  <input type="radio" name={key} value="yes" checked={val === true}
                    onChange={() => setDeclaration(key, true)} />
                  Yes
                </label>
                <label className={`urla-decl-opt ${val === false ? "urla-decl-opt--selected" : ""}`}>
                  <input type="radio" name={key} value="no" checked={val === false}
                    onChange={() => setDeclaration(key, false)} />
                  No
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Section: Government Monitoring ────────────────────────────────────────────

function SectionGovernment({ borrower }: { borrower: BorrowerOut }) {
  return (
    <div className="urla-section-content-body">
      <SectionHeader number="5" title="Government Monitoring Information" />
      <p className="urla-hmda-notice">
        This information is collected for federal monitoring purposes under HMDA. It does not affect the credit decision.
        Complete HMDA data entry is in the <strong>HMDA</strong> tab.
      </p>
      <div className="urla-field-grid">
        <ReadField label="Ethnicity"  value={borrower.ethnicity} />
        <ReadField label="Race"       value={borrower.race} />
        <ReadField label="Sex / Gender" value={borrower.gender} />
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function WorkspaceBorrowerURLA({ loan }: Props) {
  const { token } = useAuth();
  const { detail, loading, error } = useLoanDetail(loan.id);
  const [extraBorrowers, setExtraBorrowers] = useState<BorrowerOut[]>([]);

  const [activeBorrowerId, setActiveBorrowerId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<URLASectionId>("personal");
  const [edits, setEdits]   = useState<Record<string, BorrowerEdit>>({});
  const [saved, setSaved]   = useState<Record<string, BorrowerEdit>>({});
  const [localData, setLocalData] = useState<Record<string, LocalBorrowerData>>({});
  const [savedLocal, setSavedLocal] = useState<Record<string, LocalBorrowerData>>({});
  const [isSaving, setIsSaving]   = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveCount, setSaveCount] = useState(0);
  const [isAddingBorrower, setIsAddingBorrower] = useState(false);

  useEffect(() => {
    if (!detail?.borrowers) return;
    const initial = Object.fromEntries(detail.borrowers.map((b) => [b.id, {} as BorrowerEdit]));
    const initialLocal = Object.fromEntries(detail.borrowers.map((b) => [b.id, defaultLocalData()]));
    setEdits(initial);
    setSaved(initial);
    setLocalData(initialLocal);
    setSavedLocal(initialLocal);
    if (!activeBorrowerId) {
      const primary = detail.borrowers.find((b) => b.type === "primary_borrower") ?? detail.borrowers[0];
      if (primary) setActiveBorrowerId(primary.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.borrowers]);

  const isDirty =
    JSON.stringify(edits) !== JSON.stringify(saved) ||
    JSON.stringify(localData) !== JSON.stringify(savedLocal);

  async function handleSave() {
    if (!token || !detail?.borrowers) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await Promise.all(
        detail.borrowers.map((b) => {
          const patch = edits[b.id];
          if (!patch || Object.keys(patch).length === 0) return Promise.resolve();
          return apiRequest(`/borrowers/${b.id}`, {
            method: "PATCH", token, body: JSON.stringify(patch),
          });
        }),
      );
      setSaved(edits);
      setSavedLocal(localData); // local data saved in state only — TODO: backend endpoints
      setSaveCount((c) => c + 1);
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setIsSaving(false);
    }
  }

  function patchBorrower(borrowerId: string, patch: BorrowerEdit) {
    setEdits((prev) => ({ ...prev, [borrowerId]: { ...prev[borrowerId], ...patch } }));
  }
  function patchLocal(borrowerId: string, patch: Partial<LocalBorrowerData>) {
    setLocalData((prev) => ({ ...prev, [borrowerId]: { ...prev[borrowerId], ...patch } }));
  }

  async function handleAddBorrower() {
    if (!token) return;
    setIsAddingBorrower(true);
    try {
      const created = await apiRequest<BorrowerOut>("/borrowers/", {
        method: "POST",
        token,
        body: JSON.stringify({ loan_id: loan.id, type: "primary_borrower" }),
      });
      setExtraBorrowers((prev) => [...prev, created]);
      setActiveBorrowerId(created.id);
      setEdits((prev) => ({ ...prev, [created.id]: {} }));
      setLocalData((prev) => ({ ...prev, [created.id]: defaultLocalData() }));
      setSaved((prev) => ({ ...prev, [created.id]: {} }));
      setSavedLocal((prev) => ({ ...prev, [created.id]: defaultLocalData() }));
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setIsAddingBorrower(false);
    }
  }

  if (loading) return <div className="urla-loading"><LoadingSpinner /></div>;
  if (error)   return (
    <div className="urla-empty">
      <p className="urla-empty-title">Could not load borrower data</p>
      <p className="urla-empty-body">{error}</p>
    </div>
  );

  const borrowers = [...(detail?.borrowers ?? []), ...extraBorrowers];
  if (borrowers.length === 0) return (
    <div className="urla-empty">
      <p className="urla-empty-title">No borrowers on file</p>
      <p className="urla-empty-body">Borrower records have not been created for this loan yet.</p>
      <button
        type="button"
        className="primary-button"
        disabled={isAddingBorrower}
        onClick={() => void handleAddBorrower()}
      >
        {isAddingBorrower ? "Creating…" : "Add Primary Borrower"}
      </button>
    </div>
  );

  const activeBorrower = borrowers.find((b) => b.id === activeBorrowerId) ?? borrowers[0]!;
  const activeEdit  = edits[activeBorrower.id]  ?? {};
  const activeLocal = localData[activeBorrower.id] ?? defaultLocalData();

  function renderSection() {
    switch (activeSection) {
      case "personal":
        return <SectionPersonal borrower={activeBorrower} edit={activeEdit} patch={(p) => patchBorrower(activeBorrower.id, p)} loanId={loan.id} />;
      case "current-address":
        return <SectionCurrentAddress data={activeLocal} onChange={(p) => patchLocal(activeBorrower.id, p)} />;
      case "former-address":
        return <SectionFormerAddress data={activeLocal} onChange={(p) => patchLocal(activeBorrower.id, p)} />;
      case "employment":
        return <SectionEmployment borrower={activeBorrower} edit={activeEdit} patch={(p) => patchBorrower(activeBorrower.id, p)} loanId={loan.id} />;
      case "income":
        return <SectionIncome borrower={activeBorrower} edit={activeEdit} patch={(p) => patchBorrower(activeBorrower.id, p)} loanId={loan.id} />;
      case "assets":
        return <SectionAssets data={activeLocal} onChange={(p) => patchLocal(activeBorrower.id, p)} />;
      case "liabilities":
        return <SectionLiabilities data={activeLocal} onChange={(p) => patchLocal(activeBorrower.id, p)} />;
      case "real-estate":
        return <SectionREO data={activeLocal} onChange={(p) => patchLocal(activeBorrower.id, p)} />;
      case "declarations":
        return <SectionDeclarations data={activeLocal} onChange={(p) => patchLocal(activeBorrower.id, p)} />;
      case "government":
        return <SectionGovernment borrower={activeBorrower} />;
    }
  }

  return (
    <div className="urla-wrapper">
      <WorkspaceSaveBar
        title="Borrower URLA"
        subtitle={`Fannie Mae Form 1003 · ${loan.loanNumber}`}
        isDirty={isDirty}
        isSaving={isSaving}
        saveError={saveError}
        saveCount={saveCount}
        onSave={handleSave}
        onCancel={() => { setEdits(saved); setLocalData(savedLocal); }}
      />

      {/* Borrower pill tabs */}
      <div className="urla-borrower-tabs">
        {borrowers.map((b) => {
          const name = [b.first_name, b.last_name].filter(Boolean).join(" ") || (BORROWER_TYPE_LABELS[b.type] ?? "Borrower");
          const isActive = b.id === activeBorrower.id;
          return (
            <button
              key={b.id}
              type="button"
              className={`urla-borrower-tab ${isActive ? "urla-borrower-tab--active" : ""}`}
              onClick={() => setActiveBorrowerId(b.id)}
            >
              <span className="urla-tab-type">{BORROWER_TYPE_LABELS[b.type] ?? "Borrower"}</span>
              <span className="urla-tab-name">{name}</span>
            </button>
          );
        })}
      </div>

      {/* Two-column body: section nav + content */}
      <div className="urla-body">
        <nav className="urla-section-nav" aria-label="URLA sections">
          {URLA_SECTIONS.map((sec) => {
            const dot = sectionDot(sec.id, activeBorrower, activeEdit, activeLocal);
            const isActive = sec.id === activeSection;
            return (
              <button
                key={sec.id}
                type="button"
                className={`urla-section-nav-item ${isActive ? "urla-section-nav-item--active" : ""}`}
                onClick={() => setActiveSection(sec.id)}
              >
                <span className={`urla-nav-dot urla-nav-dot--${dot}`} aria-label={dot} />
                <span className="urla-nav-section-num">{sec.number}</span>
                <span className="urla-nav-section-label">{sec.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="urla-section-panel">
          {renderSection()}
        </div>
      </div>
    </div>
  );
}
