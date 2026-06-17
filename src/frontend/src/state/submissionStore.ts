import { create } from "zustand";
import { createJSONStorage, devtools, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import {
  createEmptySubmissionDraft,
  emptyBorrower,
  incomeForProduct,
  submissionSteps,
} from "@/data/submissionConfig";
import {
  createBorrowerForLoan,
  createLoanDraft,
  createPropertyForLoan,
  fetchLoanDraft,
  patchBorrowerInDb,
  patchLoanHeader,
  saveLoanDraft,
  submitLoanApplication,
  updatePropertyInDb,
  upsertLoanFinancials,
} from "@/services/submissionService";
import {
  validateStep,
  validateSubmission,
} from "@/services/submissionValidation";
import type {
  AssetsDraft,
  BorrowerDraft,
  IncomeDraft,
  LoanSetupDraft,
  PropertyDraft,
  SaveStatus,
  StepStatus,
  SubmissionDraft,
  SubmissionStep,
  SubmitResult,
} from "@/types/submission";

type SubmissionStore = {
  draft: SubmissionDraft;
  saveStatus: SaveStatus;
  lastSavedAt: string | null;
  submitResult: SubmitResult | null;
  // Track server-assigned UUIDs so repeated saves PATCH instead of POST
  borrowerDbIds: Record<string, string>; // client UUID → server UUID
  propertyDbId: string | null;
  startNewDraft: (source: "manual" | "mismo") => Promise<string>;
  setStep: (step: SubmissionStep) => void;
  updateSetup: (partial: Partial<LoanSetupDraft>) => void;
  updateProperty: (partial: Partial<PropertyDraft>) => void;
  upsertBorrower: (id: string, partial: Partial<BorrowerDraft>) => void;
  addCoBorrower: () => void;
  removeBorrower: (id: string) => void;
  updateIncome: (partial: Partial<IncomeDraft>) => void;
  updateAssets: (partial: Partial<AssetsDraft>) => void;
  selectScenario: (id: string) => void;
  saveDraft: () => Promise<void>;
  submitLoan: () => Promise<SubmitResult>;
  resetSubmission: () => void;
  hydrateFromApi: (loanId: string) => Promise<void>;
  hydrateFromMismo: (parsed: Partial<SubmissionDraft>) => void;
};

export const useLoanSubmissionStore = create<SubmissionStore>()(
  devtools(
    persist(
      immer((set, get) => ({
        draft: createEmptySubmissionDraft(),
        saveStatus: "idle",
        lastSavedAt: null,
        submitResult: null,
        borrowerDbIds: {},
        propertyDbId: null,
        startNewDraft: async (source) => {
          const draft = await createLoanDraft();
          set((state) => {
            state.draft = {
              ...draft,
              importSource: source,
            };
            state.saveStatus = "saved";
            state.lastSavedAt = new Date().toISOString();
            state.submitResult = null;
            state.borrowerDbIds = {};
            state.propertyDbId = null;
          });
          return draft.loanId!;
        },
        setStep: (step) =>
          set((state) => {
            state.draft.currentStep = step;
            if (!state.draft.visitedSteps.includes(step)) {
              state.draft.visitedSteps.push(step);
            }
          }),
        updateSetup: (partial) =>
          set((state) => {
            const previousProduct = state.draft.setup.product;
            state.draft.setup = { ...state.draft.setup, ...partial };

            if (partial.product && partial.product !== previousProduct) {
              state.draft.income = incomeForProduct(partial.product);
              if (partial.product === "dscr") {
                state.draft.setup.occupancyType = "investment";
              }
            }

            recomputeDerived(state.draft);
            refreshValidation(state.draft);
          }),
        updateProperty: (partial) =>
          set((state) => {
            state.draft.property = { ...state.draft.property, ...partial };
            recomputeDerived(state.draft);
            refreshValidation(state.draft);
          }),
        upsertBorrower: (id, partial) =>
          set((state) => {
            const index = state.draft.borrowers.findIndex((item) => item.id === id);
            if (index >= 0) {
              state.draft.borrowers[index] = {
                ...state.draft.borrowers[index],
                ...partial,
              };
            }
            refreshValidation(state.draft);
          }),
        addCoBorrower: () =>
          set((state) => {
            if (!state.draft.borrowers.some((item) => item.type === "co_borrower")) {
              state.draft.borrowers.push(emptyBorrower("co_borrower"));
              state.draft.stepCompleteness["co-borrower"] = "partial";
            }
          }),
        removeBorrower: (id) =>
          set((state) => {
            state.draft.borrowers = state.draft.borrowers.filter(
              (borrower) => borrower.id !== id || borrower.type === "primary_borrower",
            );
            if (!state.draft.borrowers.some((item) => item.type === "co_borrower")) {
              state.draft.stepCompleteness["co-borrower"] = "skipped";
            }
          }),
        updateIncome: (partial) =>
          set((state) => {
            state.draft.income = { ...state.draft.income, ...partial } as IncomeDraft;
            recomputeDerived(state.draft);
            refreshValidation(state.draft);
          }),
        updateAssets: (partial) =>
          set((state) => {
            state.draft.assets = { ...state.draft.assets, ...partial };
            recomputeDerived(state.draft);
            refreshValidation(state.draft);
          }),
        selectScenario: (id) =>
          set((state) => {
            state.draft.selectedScenarioId = id;
            refreshValidation(state.draft);
          }),
        saveDraft: async () => {
          set({ saveStatus: "saving" });
          try {
            const { draft, borrowerDbIds, propertyDbId } = get();
            const loanId = draft.loanId;

            // 1. Snapshot to localStorage immediately (crash safety).
            //    Do NOT use the returned value to overwrite state.draft — the user
            //    may continue typing while the async backend calls run below, and
            //    setting state.draft = snapshot would revert their in-flight input,
            //    causing the next auto-save to PATCH null names back to the DB.
            await saveLoanDraft(draft);

            // 2. If we have a real DB loan ID, sync all form data to backend
            if (loanId && !loanId.startsWith("draft-")) {
              // 2a. PATCH loan header (program, purpose, occupancy)
              await patchLoanHeader(loanId, {
                loan_program: draft.setup.product,
                purpose: draft.setup.purpose,
                occupancy_type: draft.setup.occupancyType,
              });

              // 2b. PUT financials
              const primary = draft.borrowers.find((b) => b.type === "primary_borrower");
              await upsertLoanFinancials(loanId, {
                loan_amount: draft.setup.loanAmount,
                appraised_value: draft.property.estimatedValue,
                purchase_price: draft.property.purchasePrice,
                fico_score: primary?.estimatedFico ?? null,
              });

              // 2c. Sync borrowers — PATCH if already in DB, POST otherwise
              const newBorrowerDbIds = { ...borrowerDbIds };
              for (const borrower of draft.borrowers) {
                const dbId = newBorrowerDbIds[borrower.id];
                if (dbId) {
                  await patchBorrowerInDb(dbId, borrower);
                } else {
                  const created = await createBorrowerForLoan(loanId, {
                    type: borrower.type,
                    first_name: borrower.firstName || null,
                    last_name: borrower.lastName || null,
                    email: borrower.email || null,
                    phone: borrower.phone || null,
                    dob: borrower.dob || null,
                  });
                  if (created) newBorrowerDbIds[borrower.id] = created.id;
                }
              }

              // 2d. Sync subject property — PATCH if exists, POST otherwise
              let newPropertyDbId = propertyDbId;
              const prop = draft.property;
              const hasPropertyData = !!(prop.street1 || prop.city || prop.state || prop.postalCode);
              if (hasPropertyData) {
                if (newPropertyDbId) {
                  await updatePropertyInDb(newPropertyDbId, prop);
                } else {
                  const created = await createPropertyForLoan(loanId, prop);
                  if (created) newPropertyDbId = created.id;
                }
              }

              set((state) => {
                state.draft.isDraft = true;
                state.saveStatus = "saved";
                state.lastSavedAt = new Date().toISOString();
                state.borrowerDbIds = newBorrowerDbIds;
                state.propertyDbId = newPropertyDbId;
              });
            } else {
              set((state) => {
                state.draft.isDraft = true;
                state.saveStatus = "saved";
                state.lastSavedAt = new Date().toISOString();
              });
            }
          } catch {
            set({ saveStatus: "error" });
          }
        },
        submitLoan: async () => {
          const errors = validateSubmission(get().draft).filter(
            (error) => error.severity === "blocking",
          );
          if (errors.length > 0) {
            set((state) => {
              refreshValidation(state.draft);
            });
            throw new Error("Resolve blocking items before submitting.");
          }

          const result = await submitLoanApplication(get().draft);
          set((state) => {
            state.submitResult = result;
            state.draft.isDraft = false;
          });
          return result;
        },
        resetSubmission: () =>
          set({
            draft: createEmptySubmissionDraft(),
            saveStatus: "idle",
            lastSavedAt: null,
            submitResult: null,
            borrowerDbIds: {},
            propertyDbId: null,
          }),
        hydrateFromApi: async (loanId) => {
          // If the current Zustand draft is already for this loan, the persist
          // store has the latest in-memory state — don't overwrite it with the
          // potentially-stale localStorage autosave snapshot.
          if (get().draft.loanId === loanId) return;
          const draft = await fetchLoanDraft(loanId);
          set((state) => {
            state.draft = draft;
            refreshValidation(state.draft);
          });
        },
        hydrateFromMismo: (parsed) =>
          set((state) => {
            state.draft = {
              ...state.draft,
              ...parsed,
              importSource: "mismo",
            };
            recomputeDerived(state.draft);
            refreshValidation(state.draft);
          }),
      })),
      {
        name: "origina.submission.draft",
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          draft: {
            ...state.draft,
            // SSN must never be written to localStorage — cleared on hydration, must be re-entered
            borrowers: state.draft.borrowers.map((borrower) => ({
              ...borrower,
              ssn: "",
            })),
          },
          lastSavedAt: state.lastSavedAt,
          // Persist DB IDs so repeated saves after page reload PATCH instead of POST
          borrowerDbIds: state.borrowerDbIds,
          propertyDbId: state.propertyDbId,
        }),
      },
    ),
    { name: "origina-submission" },
  ),
);

function recomputeDerived(draft: SubmissionDraft) {
  const pitia = estimatePitia(draft);

  if (draft.income.type === "dscr") {
    draft.income.pitia = pitia;
    draft.income.dscrRatio =
      draft.income.monthlyRent && pitia ? draft.income.monthlyRent / pitia : null;
  }

  if (draft.income.type === "asset_depletion") {
    const retirementAssets = draft.income.retirementAssets ?? 0;
    const liquidAssets = draft.income.totalLiquidAssets ?? 0;
    draft.income.monthlyQualifyingIncome =
      (liquidAssets + retirementAssets * 0.7) / draft.income.depletionPeriodMonths;
  }

  const totalReserves = draft.assets.accounts.reduce(
    (sum, account) => sum + Number(account.balance || 0),
    0,
  );
  draft.assets.totalReserves = totalReserves || null;
  draft.assets.reserveMonths = pitia && totalReserves ? totalReserves / pitia : null;
}

function refreshValidation(draft: SubmissionDraft) {
  const allErrors = validateSubmission(draft);
  submissionSteps.forEach((step) => {
    const stepErrors = validateStep(draft, step.id);
    draft.stepErrors[step.id] = stepErrors;
    draft.stepCompleteness[step.id] = resolveStepStatus(draft, step.id, stepErrors);
  });

  if (allErrors.length === 0 && draft.stepCompleteness.review !== "empty") {
    draft.stepCompleteness.review = "complete";
  }
}

function resolveStepStatus(
  draft: SubmissionDraft,
  step: SubmissionStep,
  errors: ReturnType<typeof validateStep>,
): StepStatus {
  if (errors.some((error) => error.severity === "blocking")) return "error";
  if (step === "co-borrower" && !draft.borrowers.some((item) => item.type === "co_borrower")) {
    return "skipped";
  }
  if (draft.visitedSteps.includes(step)) return errors.length ? "partial" : "complete";
  return "empty";
}

function estimatePitia(draft: SubmissionDraft): number | null {
  if (!draft.setup.loanAmount) return null;
  return Math.round(draft.setup.loanAmount * 0.0075);
}
