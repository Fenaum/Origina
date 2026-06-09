import type { ValidationError } from "@/types/submission";

export function ValidationMessage({ error }: { error: ValidationError }) {
  return (
    <div className={`validation-message ${error.severity}`}>
      <strong>{error.message}</strong>
      {error.remedy ? <span>{error.remedy}</span> : null}
    </div>
  );
}
