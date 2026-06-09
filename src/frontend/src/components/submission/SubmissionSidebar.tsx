import { productLabels } from "@/data/submissionConfig";
import { CompletenessBar } from "@/components/submission/CompletenessBar";
import { SaveStatusIndicator } from "@/components/submission/SaveStatusIndicator";
import { StepList } from "@/components/submission/StepList";
import type { SaveStatus, SubmissionDraft, SubmissionStep } from "@/types/submission";

export function SubmissionSidebar({
  draft,
  saveStatus,
  lastSavedAt,
  onStep,
}: {
  draft: SubmissionDraft;
  saveStatus: SaveStatus;
  lastSavedAt: string | null;
  onStep: (step: SubmissionStep) => void;
}) {
  return (
    <aside className="submission-sidebar">
      <div className="loan-identity-card">
        <p className="eyebrow">Draft Loan</p>
        <h3>{draft.loanId ?? "New application"}</h3>
        <span>{draft.setup.product ? productLabels[draft.setup.product] : "Product pending"}</span>
      </div>
      <StepList draft={draft} onStep={onStep} />
      <CompletenessBar draft={draft} />
      <SaveStatusIndicator status={saveStatus} lastSavedAt={lastSavedAt} />
    </aside>
  );
}
