export function LoadingSpinner({ label = "Loading" }: { label?: string }) {
  return (
    <span className="loading-spinner" role="status" aria-label={label}>
      <span />
    </span>
  );
}
