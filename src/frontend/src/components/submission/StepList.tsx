import { submissionSteps } from "@/data/submissionConfig";
import { StepItem } from "@/components/submission/StepItem";
import type { SubmissionDraft, SubmissionStep } from "@/types/submission";

export function StepList({
  draft,
  onStep,
}: {
  draft: SubmissionDraft;
  onStep: (step: SubmissionStep) => void;
}) {
  return (
    <nav className="step-list" aria-label="Submission steps">
      {submissionSteps.map((step) => (
        <StepItem
          active={draft.currentStep === step.id}
          id={step.id}
          key={step.id}
          label={step.label}
          status={draft.stepCompleteness[step.id]}
          onClick={() => onStep(step.id)}
        />
      ))}
    </nav>
  );
}
