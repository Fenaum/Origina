import { CompletenessBar } from "@/components/submission/CompletenessBar";
import type { SubmissionDraft } from "@/types/submission";

export function ProgressTracker({ draft }: { draft: SubmissionDraft }) {
  return <CompletenessBar draft={draft} />;
}
