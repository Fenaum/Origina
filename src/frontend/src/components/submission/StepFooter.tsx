import { LoadingSpinner } from "@/components/feedback/LoadingSpinner";

export function StepFooter({
  isFirst,
  isLast,
  isSaving,
  onBack,
  onSave,
  onContinue,
}: {
  isFirst: boolean;
  isLast: boolean;
  isSaving: boolean;
  onBack: () => void;
  onSave: () => void;
  onContinue: () => void;
}) {
  return (
    <footer className="step-footer">
      <button className="ghost-button" type="button" disabled={isFirst} onClick={onBack}>
        Back
      </button>
      <div>
        <button className="ghost-button" type="button" onClick={onSave}>
          {isSaving ? <LoadingSpinner label="Saving draft" /> : null}
          Save Draft
        </button>
        <button className="primary-button" type="button" onClick={onContinue}>
          {isLast ? "Submit" : isLast ? "Submit" : "Save & Continue"}
        </button>
      </div>
    </footer>
  );
}
