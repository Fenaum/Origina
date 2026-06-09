import { submissionSteps } from "@/data/submissionConfig";
import type { SubmissionStep } from "@/types/submission";

export function StepHeader({ step }: { step: SubmissionStep }) {
  const config = submissionSteps.find((item) => item.id === step)!;

  return (
    <header className="step-header fade-slide-in">
      <div>
        <p className="eyebrow">Step {submissionSteps.indexOf(config) + 1}</p>
        <h2>{config.label}</h2>
        <p>{config.subtitle}</p>
      </div>
      <span>{config.estimatedTime}</span>
    </header>
  );
}
