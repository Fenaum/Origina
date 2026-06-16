import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { SubmissionErrorModal } from "@/components/submission/SubmissionErrorModal";
import { StepFooter } from "@/components/submission/StepFooter";
import { StepHeader } from "@/components/submission/StepHeader";
import { SubmissionLayout } from "@/components/submission/SubmissionLayout";
import { SubmissionProcessingOverlay } from "@/components/submission/SubmissionProcessingOverlay";
import { SubmissionSuccessModal } from "@/components/submission/SubmissionSuccessModal";
import { LoanSetupStep } from "@/components/submission/steps/LoanSetupStep";
import { useDocumentStore } from "@/state/documentStore";
import { useLoanSubmissionStore } from "@/state/submissionStore";
import type { DocumentChecklistItem, SubmissionDraft, SubmissionStep, SubmitResult, ValidationError } from "@/types/submission";

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
  const checklist = useDocumentStore((s) => s.checklist);
  const didHydrate = useRef(false);
  const didAutoSaveOnce = useRef(false);
  const currentIndex = stepIds.indexOf(step);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [successResult, setSuccessResult] = useState<SubmitResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [stepValidationErrors, setStepValidationErrors] = useState<ValidationError[]>([]);

  useEffect(() => {
    if (!didHydrate.current) {
      didHydrate.current = true;
      void hydrateFromApi(loanId);
    }
  }, [hydrateFromApi, loanId]);

  useEffect(() => {
    setStep(step);
    setStepValidationErrors([]);
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
    if (isSubmitting) return;
    setStep(nextStep);
    void router.push(`/loans/${loanId}/edit/${nextStep}`);
  }

  async function continueStep() {
    const blockingErrors = collectBlockingErrors(step, draft, checklist);
    if (blockingErrors.length > 0) {
      setStepValidationErrors(blockingErrors);
      return;
    }
    setStepValidationErrors([]);

    if (step === "review") {
      if (isSubmitting) return;
      await runSubmit();
      return;
    }

    await saveDraft();
    const nextStep = stepIds[Math.min(currentIndex + 1, stepIds.length - 1)];
    goToStep(nextStep);
  }

  async function runSubmit() {
    setIsSubmitting(true);
    setSubmitError(null);
    setProcessingStep(0);
    try {
      await saveDraft();
      setProcessingStep(1);
      setProcessingStep(2);
      const result = await submitLoan();
      setProcessingStep(3);
      setSuccessResult(result);
    } catch (error) {
      setSubmitError((error as Error).message || "Please review the errors and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function openSubmittedLoan() {
    if (successResult?.loanId) {
      void router.push(`/loans/${successResult.loanId}`);
    }
  }

  function returnToPipeline() {
    void router.push("/loans");
  }

  async function retrySubmit() {
    setSubmitError(null);
    await runSubmit();
  }

  return (
    <>
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
          isSubmitting={isSubmitting}
          isDisabled={isSubmitting}
          errors={stepValidationErrors}
          onBack={() => goToStep(stepIds[Math.max(currentIndex - 1, 0)])}
          onContinue={() => void continueStep()}
          onSave={() => void saveDraft()}
        />
      </SubmissionLayout>

      {isSubmitting && <SubmissionProcessingOverlay activeStep={processingStep} />}

      {successResult && (
        <SubmissionSuccessModal
          result={successResult}
          onOpenLoan={openSubmittedLoan}
          onReturnToPipeline={returnToPipeline}
        />
      )}

      {submitError && !successResult && (
        <SubmissionErrorModal
          message={submitError}
          onRetry={() => void retrySubmit()}
          onClose={() => setSubmitError(null)}
        />
      )}
    </>
  );
}

function collectBlockingErrors(
  step: SubmissionStep,
  draft: SubmissionDraft,
  checklist: DocumentChecklistItem[],
): ValidationError[] {
  const missingRequiredDocs = (): ValidationError[] =>
    checklist
      .filter(
        (item) =>
          item.requirement === "required" &&
          item.uploadStatus !== "uploaded" &&
          item.uploadStatus !== "verified",
      )
      .map((item) => ({
        field: `documents.${item.docType}`,
        step: "documents" as SubmissionStep,
        severity: "blocking" as const,
        code: "REQUIRED_DOCUMENT",
        message: `${item.label} must be uploaded.`,
        remedy: "Upload this document before continuing.",
      }));

  if (step === "review") {
    const allErrors: ValidationError[] = [];
    for (const s of stepIds) {
      const sErrors = (draft.stepErrors[s as SubmissionStep] ?? []).filter(
        (e) => e.severity === "blocking",
      );
      allErrors.push(...sErrors);
    }
    allErrors.push(...missingRequiredDocs());
    return allErrors;
  }

  const errors = (draft.stepErrors[step] ?? []).filter(
    (e) => e.severity === "blocking",
  );

  if (step === "documents") {
    errors.push(...missingRequiredDocs());
  }

  return errors;
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
