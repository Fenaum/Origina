import { createEmptySubmissionDraft } from "@/data/submissionConfig";
import type { SubmissionDraft, SubmitResult } from "@/types/submission";

const REMOTE_DRAFT_KEY = "origina.remoteDrafts";
const MOCK_DELAY_MS = process.env.NODE_ENV === "production" ? 0 : 140;

async function waitForMockDelay() {
  if (MOCK_DELAY_MS === 0) return;
  await new Promise((resolve) => window.setTimeout(resolve, MOCK_DELAY_MS));
}

function getDrafts(): Record<string, SubmissionDraft> {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(REMOTE_DRAFT_KEY);
  return raw ? (JSON.parse(raw) as Record<string, SubmissionDraft>) : {};
}

function setDrafts(drafts: Record<string, SubmissionDraft>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(REMOTE_DRAFT_KEY, JSON.stringify(drafts));
}

export async function createLoanDraft(): Promise<SubmissionDraft> {
  await waitForMockDelay();
  const draft = createEmptySubmissionDraft(`draft-${crypto.randomUUID()}`);
  const drafts = getDrafts();
  drafts[draft.loanId!] = draft;
  setDrafts(drafts);
  return draft;
}

export async function fetchLoanDraft(loanId: string): Promise<SubmissionDraft> {
  await waitForMockDelay();
  const draft = getDrafts()[loanId];
  return draft ?? createEmptySubmissionDraft(loanId);
}

export async function saveLoanDraft(
  draft: SubmissionDraft,
): Promise<SubmissionDraft> {
  await waitForMockDelay();
  const loanId = draft.loanId ?? `draft-${crypto.randomUUID()}`;
  const nextDraft = { ...draft, loanId, isDraft: true };
  const drafts = getDrafts();
  drafts[loanId] = nextDraft;
  setDrafts(drafts);
  return nextDraft;
}

export async function submitLoanApplication(
  draft: SubmissionDraft,
): Promise<SubmitResult> {
  await waitForMockDelay();

  // TODO: Replace with FastAPI submission endpoint once application workflow exists.
  const loanId = draft.loanId ?? `loan-${crypto.randomUUID()}`;
  return {
    loanId,
    loanNumber: `OR-${Math.floor(1100 + Math.random() * 800)}`,
    assignedAeName: "Alex Morgan",
  };
}
