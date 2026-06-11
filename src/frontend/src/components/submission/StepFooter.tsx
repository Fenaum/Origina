import { LoadingSpinner } from "@/components/feedback/LoadingSpinner";

export function StepFooter({
  isFirst,
  isLast,
  isSaving,
  isSubmitting,
  isDisabled,
  onBack,
  onSave,
  onContinue,
}: {
  isFirst: boolean;
  isLast: boolean;
  isSaving: boolean;
  isSubmitting?: boolean;
  isDisabled?: boolean;
  onBack: () => void;
  onSave: () => void;
  onContinue: () => void;
}) {
  return (
    <footer className="step-footer">
      <button className="ghost-button" type="button" disabled={isFirst || isDisabled} onClick={onBack}>
        Back
      </button>
      <div>
        <button className="ghost-button" type="button" disabled={isDisabled} onClick={onSave}>
          {isSaving ? <LoadingSpinner label="Saving draft" /> : null}
          Save Draft
        </button>
        <button className="primary-button" type="button" disabled={isDisabled} onClick={onContinue}>
          {isSubmitting ? <LoadingSpinner label="Submitting loan" /> : null}
          {isSubmitting ? "Submitting..." : isLast ? "Submit Loan" : "Save & Continue"}
        </button>
      </div>
    </footer>
  );
}
