import { LoadingSpinner } from "@/components/feedback/LoadingSpinner";

type ErrorStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  isRetrying?: boolean;
  onRetry?: () => void;
};

export function ErrorState({
  title,
  description,
  actionLabel = "Try again",
  isRetrying = false,
  onRetry,
}: ErrorStateProps) {
  return (
    <section className="panel state-panel error-state fade-in">
      <h3>{title}</h3>
      <p>{description}</p>
      {onRetry ? (
        <button className="primary-button" type="button" onClick={onRetry} disabled={isRetrying}>
          {isRetrying ? <LoadingSpinner label="Retrying" /> : null}
          {actionLabel}
        </button>
      ) : null}
    </section>
  );
}
