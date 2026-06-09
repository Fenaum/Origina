import { useRouter } from "next/router";
import { useEffect, useMemo, useRef } from "react";
import { submissionSteps } from "@/data/submissionConfig";
import { AssetSection } from "@/components/submission/AssetSection";
import { AssignmentSection } from "@/components/submission/AssignmentSection";
import { BorrowerSection } from "@/components/submission/BorrowerSection";
import { DocumentChecklist } from "@/components/submission/DocumentChecklist";
import { IncomeSection } from "@/components/submission/IncomeSection";
import { PricingComparisonTable } from "@/components/submission/PricingComparisonTable";
import { PricingScenarioBuilder } from "@/components/submission/PricingScenarioBuilder";
import { PropertySection } from "@/components/submission/PropertySection";
import { ReviewSummary } from "@/components/submission/ReviewSummary";
import { StepFooter } from "@/components/submission/StepFooter";
import { StepHeader } from "@/components/submission/StepHeader";
import { SubmissionLayout } from "@/components/submission/SubmissionLayout";
import { LoanSetupStep } from "@/components/submission/steps/LoanSetupStep";
import { useLoanSubmissionStore } from "@/state/submissionStore";
import type { SubmissionStep } from "@/types/submission";

const stepIds = submissionSteps.map((step) => step.id);

export function SubmissionWizard({
  loanId,
  step,
}: {
  loanId: string;
  step: SubmissionStep;
}) {
  const router = useRouter();
  const {
    draft,
    saveStatus,
    lastSavedAt,
    setStep,
    saveDraft,
    submitLoan,
    hydrateFromApi,
  } = useLoanSubmissionStore();
  const didHydrate = useRef(false);
  const didAutoSaveOnce = useRef(false);
  const currentIndex = stepIds.indexOf(step);

  useEffect(() => {
    if (!didHydrate.current) {
      didHydrate.current = true;
      void hydrateFromApi(loanId);
    }
  }, [hydrateFromApi, loanId]);

  useEffect(() => {
    setStep(step);
  }, [setStep, step]);

  const serializedDraft = useMemo(() => JSON.stringify(draft), [draft]);
  useEffect(() => {
    if (!didAutoSaveOnce.current) {
      didAutoSaveOnce.current = true;
      return;
    }
    const timeoutId = window.setTimeout(() => void saveDraft(), 1500);
    return () => window.clearTimeout(timeoutId);
  }, [saveDraft, serializedDraft]);

  function goToStep(nextStep: SubmissionStep) {
    setStep(nextStep);
    void router.push(`/loans/${loanId}/edit/${nextStep}`);
  }

  async function continueStep() {
    await saveDraft();
    if (step === "review") {
      try {
        await submitLoan();
      } catch {
        return;
      }
      return;
    }

    const nextStep = stepIds[Math.min(currentIndex + 1, stepIds.length - 1)];
    goToStep(nextStep);
  }

  return (
    <SubmissionLayout
      draft={draft}
      lastSavedAt={lastSavedAt}
      saveStatus={saveStatus}
      onStep={goToStep}
    >
      <StepHeader step={step} />
      <StepContent step={step} />
      <StepFooter
        isFirst={currentIndex <= 0}
        isLast={step === "review"}
        isSaving={saveStatus === "saving"}
        onBack={() => goToStep(stepIds[Math.max(currentIndex - 1, 0)])}
        onContinue={() => void continueStep()}
        onSave={() => void saveDraft()}
      />
    </SubmissionLayout>
  );
}

function StepContent({ step }: { step: SubmissionStep }) {
  if (step === "setup") return <LoanSetupStep />;
  if (step === "property") return <PropertySection />;
  if (step === "borrower") return <BorrowerSection />;
  if (step === "co-borrower") return <BorrowerSection type="co_borrower" />;
  if (step === "income") return <IncomeSection />;
  if (step === "assets") return <AssetSection />;
  if (step === "pricing") {
    return (
      <>
        <PricingScenarioBuilder />
        <PricingComparisonTable />
      </>
    );
  }
  if (step === "documents") return <DocumentChecklist />;
  return (
    <>
      <ReviewSummary />
      <AssignmentSection />
    </>
  );
}
