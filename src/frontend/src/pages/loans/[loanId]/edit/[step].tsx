import { useRouter } from "next/router";
import { AppLayout } from "@/components/app/AppLayout";
import { SubmissionWizard } from "@/components/submission/SubmissionWizard";
import { submissionSteps } from "@/data/submissionConfig";
import type { SubmissionStep } from "@/types/submission";

const validSteps = new Set(submissionSteps.map((step) => step.id));

export default function SubmissionStepPage() {
  const router = useRouter();
  const loanId = String(router.query.loanId ?? "");
  const step = String(router.query.step ?? "setup") as SubmissionStep;

  if (!loanId || !validSteps.has(step)) {
    return (
      <AppLayout allowedRoles={["account_executive", "broker"]}>
        <div className="centered-screen">Opening submission...</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout allowedRoles={["account_executive", "broker"]}>
      <SubmissionWizard loanId={loanId} step={step} />
    </AppLayout>
  );
}
