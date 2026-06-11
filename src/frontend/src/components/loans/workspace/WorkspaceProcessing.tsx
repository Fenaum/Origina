import { useState } from "react";
import { WorkspaceSaveBar } from "@/components/loans/workspace/WorkspaceSaveBar";
import { WorkspaceFieldContextMenu } from "@/components/loans/workspace/WorkspaceFieldContextMenu";
import type { LoanSummary } from "@/types/loan";

type Props = { loan: LoanSummary };

type MilestoneKey =
  | "application_received"
  | "disclosures_sent"
  | "appraisal_ordered"
  | "appraisal_received"
  | "title_ordered"
  | "title_received"
  | "conditions_cleared"
  | "loan_approved"
  | "docs_ordered"
  | "docs_signed"
  | "funding_ready";

const MILESTONES: { key: MilestoneKey; label: string }[] = [
  { key: "application_received",  label: "Application Received" },
  { key: "disclosures_sent",      label: "Initial Disclosures Sent" },
  { key: "appraisal_ordered",     label: "Appraisal Ordered" },
  { key: "appraisal_received",    label: "Appraisal Received" },
  { key: "title_ordered",         label: "Title Ordered" },
  { key: "title_received",        label: "Title Report Received" },
  { key: "conditions_cleared",    label: "All Conditions Cleared" },
  { key: "loan_approved",         label: "Loan Approved" },
  { key: "docs_ordered",          label: "Loan Docs Ordered" },
  { key: "docs_signed",           label: "Docs Signed" },
  { key: "funding_ready",         label: "Ready to Fund" },
];

type ProcessingForm = {
  milestones: Record<MilestoneKey, boolean>;
  targetCloseDate: string;
  processorNotes: string;
  docReviewStatus: "not_started" | "in_progress" | "complete";
};

const EMPTY: ProcessingForm = {
  milestones: Object.fromEntries(MILESTONES.map((m) => [m.key, false])) as Record<MilestoneKey, boolean>,
  targetCloseDate: "",
  processorNotes: "",
  docReviewStatus: "not_started",
};

export function WorkspaceProcessing({ loan }: Props) {
  const [form, setForm] = useState<ProcessingForm>(EMPTY);
  const [saved, setSaved] = useState<ProcessingForm>(EMPTY);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveCount, setSaveCount] = useState(0);

  const isDirty = JSON.stringify(form) !== JSON.stringify(saved);
  const completedCount = Object.values(form.milestones).filter(Boolean).length;
  const progress = Math.round((completedCount / MILESTONES.length) * 100);

  function setField(patch: Partial<ProcessingForm>) {
    setForm((f) => ({ ...f, ...patch }));
  }

  function toggleMilestone(key: MilestoneKey) {
    setForm((f) => ({
      ...f,
      milestones: { ...f.milestones, [key]: !f.milestones[key] },
    }));
  }

  async function handleSave() {
    setIsSaving(true);
    setSaveError(null);
    try {
      await new Promise<void>((r) => setTimeout(r, 600));
      setSaved(form);
      setSaveCount((c) => c + 1);
    } catch {
      setSaveError("Unable to save changes");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="proc-wrapper">
      <WorkspaceSaveBar
        title="Processing"
        subtitle={loan.loanNumber}
        isDirty={isDirty}
        isSaving={isSaving}
        saveError={saveError}
        saveCount={saveCount}
        onSave={handleSave}
        onCancel={() => setForm(saved)}
      />

      <div className="proc-content">
        {/* Progress */}
        <section className="proc-section">
          <div className="proc-progress-header">
            <h3 className="proc-section-title">Processing Checklist</h3>
            <span className="proc-progress-pct">{completedCount}/{MILESTONES.length} complete</span>
          </div>
          <div className="proc-progress-track">
            <div className="proc-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="proc-milestone-list">
            {MILESTONES.map((m) => (
              <label key={m.key} className={`proc-milestone${form.milestones[m.key] ? " proc-milestone--done" : ""}`}>
                <input
                  type="checkbox"
                  className="proc-milestone-check"
                  checked={form.milestones[m.key]}
                  onChange={() => toggleMilestone(m.key)}
                />
                <span className="proc-milestone-label">{m.label}</span>
                {form.milestones[m.key] && <span className="proc-milestone-check-icon" aria-hidden>✓</span>}
              </label>
            ))}
          </div>
        </section>

        {/* Status + dates */}
        <section className="proc-section">
          <h3 className="proc-section-title">Status &amp; Dates</h3>
          <div className="proc-field-grid">
            <WorkspaceFieldContextMenu
              loanId={loan.id}
              meta={{ label: "Target Close Date", apiKey: "target_close_date", dbColumn: "target_close_date", table: "loans", fieldType: "date", required: false, description: "Processor-set target funding date." }}
            >
              <div className="proc-field">
                <label className="proc-label">Target Close Date</label>
                <input
                  type="date"
                  className="proc-input"
                  value={form.targetCloseDate}
                  onChange={(e) => setField({ targetCloseDate: e.target.value })}
                />
              </div>
            </WorkspaceFieldContextMenu>
            <WorkspaceFieldContextMenu
              loanId={loan.id}
              meta={{ label: "Document Review", apiKey: "doc_review_status", dbColumn: "doc_review_status", table: "loans", fieldType: "enum", required: false }}
            >
              <div className="proc-field">
                <label className="proc-label">Document Review</label>
                <select
                  className="proc-select"
                  value={form.docReviewStatus}
                  onChange={(e) => setField({ docReviewStatus: e.target.value as ProcessingForm["docReviewStatus"] })}
                >
                  <option value="not_started">Not Started</option>
                  <option value="in_progress">In Progress</option>
                  <option value="complete">Complete</option>
                </select>
              </div>
            </WorkspaceFieldContextMenu>
          </div>
        </section>

        {/* Processor notes */}
        <section className="proc-section">
          <h3 className="proc-section-title">Processor Notes</h3>
          <WorkspaceFieldContextMenu
            loanId={loan.id}
            meta={{ label: "Processor Notes", apiKey: "processor_notes", dbColumn: "processor_notes", table: "loans", fieldType: "text", required: false }}
          >
            <div className="proc-field proc-field--full">
              <textarea
                className="proc-textarea"
                rows={5}
                placeholder="Processing notes, follow-up items, outstanding tasks…"
                value={form.processorNotes}
                onChange={(e) => setField({ processorNotes: e.target.value })}
              />
            </div>
          </WorkspaceFieldContextMenu>
        </section>
      </div>
    </div>
  );
}
