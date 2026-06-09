import { submissionSteps } from "@/data/submissionConfig";
import type { SubmissionDraft } from "@/types/submission";

export function getCompletenessScore(draft: SubmissionDraft) {
  const completed = submissionSteps.filter((step) =>
    ["complete", "skipped"].includes(draft.stepCompleteness[step.id]),
  ).length;
  return Math.round((completed / submissionSteps.length) * 100);
}

export function CompletenessBar({ draft }: { draft: SubmissionDraft }) {
  const score = getCompletenessScore(draft);

  return (
    <div className="completeness-card">
      <div>
        <strong>{score}% complete</strong>
        <span>Submission readiness</span>
      </div>
      <div className="progress-track compact">
        <div className="progress-fill" style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}
