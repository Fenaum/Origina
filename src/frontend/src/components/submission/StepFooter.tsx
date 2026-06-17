import { LoadingSpinner } from "@/components/feedback/LoadingSpinner";
import type { ValidationError } from "@/types/submission";

export function StepFooter({
  isFirst,
  isLast,
  isSaving,
  isSubmitting,
  isDisabled,
  errors,
  onBack,
  onSave,
  onContinue,
}: {
  isFirst: boolean;
  isLast: boolean;
  isSaving: boolean;
  isSubmitting?: boolean;
  isDisabled?: boolean;
  errors?: ValidationError[];
  onBack: () => void;
  onSave: () => void;
  onContinue: () => void;
}) {
  return (
    <footer className="step-footer">
      {errors && errors.length > 0 && (
        <ul className="step-footer-errors">
          {errors.map((error) => (
            <li className="step-footer-error" key={`${error.code}.${error.field}`}>
              {error.message}
            </li>
          ))}
        </ul>
      )}
      <div className="step-footer-buttons">
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
      </div>
    </footer>
  );
}
