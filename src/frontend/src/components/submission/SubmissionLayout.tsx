import { SubmissionSidebar } from "@/components/submission/SubmissionSidebar";
import type { SaveStatus, SubmissionDraft, SubmissionStep } from "@/types/submission";

export function SubmissionLayout({
  draft,
  saveStatus,
  lastSavedAt,
  onStep,
  children,
}: {
  draft: SubmissionDraft;
  saveStatus: SaveStatus;
  lastSavedAt: string | null;
  onStep: (step: SubmissionStep) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="submission-layout">
      <SubmissionSidebar
        draft={draft}
        lastSavedAt={lastSavedAt}
        saveStatus={saveStatus}
        onStep={onStep}
      />
      <section className="submission-main">{children}</section>
    </div>
  );
}
