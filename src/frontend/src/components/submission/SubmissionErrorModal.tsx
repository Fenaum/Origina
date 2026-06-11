import { useEffect, useRef } from "react";

type Props = {
  message: string;
  onRetry: () => void;
  onClose: () => void;
};

export function SubmissionErrorModal({ message, onRetry, onClose }: Props) {
  const retryRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    retryRef.current?.focus();
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="submission-result-backdrop" role="presentation">
      <section
        className="submission-result-modal submission-result-modal--error"
        role="dialog"
        aria-modal="true"
        aria-labelledby="submission-error-title"
      >
        <button
          type="button"
          className="submission-result-close"
          onClick={onClose}
          aria-label="Close error dialog"
        >
          X
        </button>

        <div className="submission-error-mark" aria-hidden>
          !
        </div>

        <div className="submission-result-heading">
          <p className="eyebrow">Submission blocked</p>
          <h2 id="submission-error-title">Unable to submit loan.</h2>
          <p>Please review the errors and try again.</p>
        </div>

        <div className="submission-error-detail">
          {message || "The submission could not be completed."}
        </div>

        <div className="submission-result-actions">
          <button
            ref={retryRef}
            type="button"
            className="primary-button"
            onClick={onRetry}
          >
            Retry Submission
          </button>
          <button type="button" className="ghost-button" onClick={onClose}>
            Continue Editing
          </button>
        </div>
      </section>
    </div>
  );
}
