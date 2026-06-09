import type { StepStatus, SubmissionStep } from "@/types/submission";

const statusLabel: Record<StepStatus, string> = {
  empty: "Open",
  partial: "Partial",
  complete: "Complete",
  skipped: "Skipped",
  error: "Action",
};

export function StepItem({
  label,
  status,
  active,
  onClick,
}: {
  id: SubmissionStep;
  label: string;
  status: StepStatus;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={active ? "step-item active" : "step-item"}
      type="button"
      onClick={onClick}
    >
      <span>{label}</span>
      <small className={`step-badge ${status}`}>{statusLabel[status]}</small>
    </button>
  );
}
