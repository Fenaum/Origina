import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { getMockAssetWorksheet } from "@/services/financialAnalysisService";
import type {
  AssetAccount,
  AssetAccountComputed,
  AssetAllocation,
  AssetAllocationType,
  AssetValidationMessage,
  AssetWorksheetSummary,
  IncomeOutputRecord,
} from "@/types/financialAnalysis";

type LoanAssetWorksheetState = {
  accounts: AssetAccount[];
  fundsRequiredToClose: number | null;
  loaded: boolean;
};

type FinancialAnalysisStore = {
  worksheetsByLoan: Record<string, LoanAssetWorksheetState>;
  loadAssetWorksheet: (loanId: string) => Promise<void>;
  setFundsRequiredToClose: (loanId: string, amount: number | null) => void;
  addAccount: (loanId: string) => void;
  updateAccount: (loanId: string, accountId: string, patch: Partial<AssetAccount>) => void;
  addAllocation: (loanId: string, accountId: string, type: AssetAllocationType) => void;
  updateAllocation: (
    loanId: string,
    accountId: string,
    allocationId: string,
    patch: Partial<AssetAllocation>,
  ) => void;
  removeAllocation: (loanId: string, accountId: string, allocationId: string) => void;
};

const EMPTY_WORKSHEET: LoanAssetWorksheetState = {
  accounts: [],
  fundsRequiredToClose: null,
  loaded: false,
};

export const useFinancialAnalysisStore = create<FinancialAnalysisStore>()(
  devtools(
    (set, get) => ({
      worksheetsByLoan: {},

      loadAssetWorksheet: async (loanId) => {
        const current = get().worksheetsByLoan[loanId];
        if (current?.loaded) return;

        const worksheet = await getMockAssetWorksheet(loanId);
        set((state) => ({
          worksheetsByLoan: {
            ...state.worksheetsByLoan,
            [loanId]: {
              accounts: worksheet.accounts,
              fundsRequiredToClose: worksheet.fundsRequiredToClose,
              loaded: true,
            },
          },
        }));
      },

      setFundsRequiredToClose: (loanId, amount) =>
        set((state) => ({
          worksheetsByLoan: {
            ...state.worksheetsByLoan,
            [loanId]: {
              ...(state.worksheetsByLoan[loanId] ?? EMPTY_WORKSHEET),
              fundsRequiredToClose: amount,
            },
          },
        })),

      addAccount: (loanId) =>
        set((state) => {
          const current = state.worksheetsByLoan[loanId] ?? EMPTY_WORKSHEET;
          const account: AssetAccount = {
            id: `asset-${Date.now()}`,
            institutionName: "",
            accountHolder: "",
            borrowerId: null,
            borrowerAge: null,
            accountType: "checking",
            isRetirement: false,
            accountNumberLast4: null,
            endBalance: 0,
            statementExpirationDate: null,
            notes: null,
            allocations: [],
          };

          return {
            worksheetsByLoan: {
              ...state.worksheetsByLoan,
              [loanId]: {
                ...current,
                accounts: [...current.accounts, account],
              },
            },
          };
        }),

      updateAccount: (loanId, accountId, patch) =>
        set((state) => {
          const current = state.worksheetsByLoan[loanId] ?? EMPTY_WORKSHEET;
          return {
            worksheetsByLoan: {
              ...state.worksheetsByLoan,
              [loanId]: {
                ...current,
                accounts: current.accounts.map((account) =>
                  account.id === accountId ? { ...account, ...patch } : account,
                ),
              },
            },
          };
        }),

      addAllocation: (loanId, accountId, type) =>
        set((state) => {
          const current = state.worksheetsByLoan[loanId] ?? EMPTY_WORKSHEET;
          const allocation: AssetAllocation = {
            id: `alloc-${Date.now()}`,
            type,
            amountUsed: 0,
            notes: null,
          };

          return {
            worksheetsByLoan: {
              ...state.worksheetsByLoan,
              [loanId]: {
                ...current,
                accounts: current.accounts.map((account) =>
                  account.id === accountId
                    ? { ...account, allocations: [...account.allocations, allocation] }
                    : account,
                ),
              },
            },
          };
        }),

      updateAllocation: (loanId, accountId, allocationId, patch) =>
        set((state) => {
          const current = state.worksheetsByLoan[loanId] ?? EMPTY_WORKSHEET;
          return {
            worksheetsByLoan: {
              ...state.worksheetsByLoan,
              [loanId]: {
                ...current,
                accounts: current.accounts.map((account) =>
                  account.id === accountId
                    ? {
                        ...account,
                        allocations: account.allocations.map((allocation) =>
                          allocation.id === allocationId
                            ? { ...allocation, ...patch }
                            : allocation,
                        ),
                      }
                    : account,
                ),
              },
            },
          };
        }),

      removeAllocation: (loanId, accountId, allocationId) =>
        set((state) => {
          const current = state.worksheetsByLoan[loanId] ?? EMPTY_WORKSHEET;
          return {
            worksheetsByLoan: {
              ...state.worksheetsByLoan,
              [loanId]: {
                ...current,
                accounts: current.accounts.map((account) =>
                  account.id === accountId
                    ? {
                        ...account,
                        allocations: account.allocations.filter(
                          (allocation) => allocation.id !== allocationId,
                        ),
                      }
                    : account,
                ),
              },
            },
          };
        }),
    }),
    { name: "origina-financial-analysis" },
  ),
);

export function getAssetWorksheetState(
  worksheetsByLoan: Record<string, LoanAssetWorksheetState>,
  loanId: string,
): LoanAssetWorksheetState {
  return worksheetsByLoan[loanId] ?? EMPTY_WORKSHEET;
}

export function computeAssetAccounts(accounts: AssetAccount[]): AssetAccountComputed[] {
  return accounts.map((account) => {
    const eligibleBalance = getEligibleBalance(account);
    const allocatedTotal = account.allocations.reduce(
      (sum, allocation) => sum + allocation.amountUsed,
      0,
    );
    const remainingEligibleBalance = eligibleBalance - allocatedTotal;
    const isExpired = isDateExpired(account.statementExpirationDate);
    const validationMessages = getAccountValidationMessages(
      account,
      eligibleBalance,
      allocatedTotal,
      isExpired,
    );

    return {
      ...account,
      eligibleBalance,
      allocatedTotal,
      remainingEligibleBalance,
      isExpired,
      validationMessages,
    };
  });
}

export function computeAssetWorksheetSummary(
  accounts: AssetAccount[],
  fundsRequiredToClose: number | null,
): AssetWorksheetSummary {
  const computed = computeAssetAccounts(accounts);
  const totalVerifiedAssets = accounts.reduce((sum, account) => sum + account.endBalance, 0);
  const totalEligibleAssets = computed.reduce((sum, account) => sum + account.eligibleBalance, 0);
  const cashToCloseAllocated = sumAllocation(accounts, "cash_to_close");
  const assetDepletionAllocated = sumAllocation(accounts, "asset_depletion");
  const atrAllocated = sumAllocation(accounts, "atr_in_full");
  const explicitReserves = sumAllocation(accounts, "reserves");
  const remainingUnallocatedEligibleAssets = computed.reduce(
    (sum, account) => sum + Math.max(account.remainingEligibleBalance, 0),
    0,
  );
  const availableReserves = explicitReserves + remainingUnallocatedEligibleAssets;
  const monthlyAssetDepletionIncome = assetDepletionAllocated / 60;
  const additionalNeededToClose =
    fundsRequiredToClose == null
      ? null
      : Math.max(fundsRequiredToClose - cashToCloseAllocated, 0);

  const validationMessages: AssetValidationMessage[] = [
    ...computed.flatMap((account) => account.validationMessages),
  ];

  if (additionalNeededToClose != null && additionalNeededToClose > 0) {
    validationMessages.push({
      severity: "warning",
      code: "CASH_TO_CLOSE_SHORT",
      message: "Cash-to-close allocation is still short.",
    });
  }

  if (assetDepletionAllocated > 0 && monthlyAssetDepletionIncome <= 0) {
    validationMessages.push({
      severity: "blocking",
      code: "INVALID_DEPLETION_INCOME",
      message: "Asset depletion allocation must produce valid monthly income.",
    });
  }

  return {
    totalVerifiedAssets,
    totalEligibleAssets,
    cashToCloseAllocated,
    assetDepletionAllocated,
    atrAllocated,
    availableReserves,
    remainingUnallocatedEligibleAssets,
    monthlyAssetDepletionIncome,
    fundsRequiredToClose,
    additionalNeededToClose,
    validationMessages,
  };
}

export function getIncomeOutputRecords(summary: AssetWorksheetSummary): IncomeOutputRecord[] {
  const outputs: IncomeOutputRecord[] = [];

  if (summary.monthlyAssetDepletionIncome > 0) {
    outputs.push({
      id: "asset-depletion-output",
      incomeType: "other_income",
      description: "Asset Depletion",
      monthlyAmount: summary.monthlyAssetDepletionIncome,
    });
  }

  if (summary.atrAllocated > 0) {
    outputs.push({
      id: "atr-output",
      incomeType: "other_income",
      description: "ATR",
      monthlyAmount: summary.atrAllocated / 60,
    });
  }

  return outputs;
}

function getEligibleBalance(account: AssetAccount): number {
  if (!account.isRetirement) return account.endBalance;
  if (account.borrowerAge != null && account.borrowerAge >= 59.5) {
    return account.endBalance * 0.6;
  }
  return account.endBalance * 0.5;
}

function sumAllocation(accounts: AssetAccount[], type: AssetAllocationType): number {
  return accounts.reduce(
    (sum, account) =>
      sum +
      account.allocations
        .filter((allocation) => allocation.type === type)
        .reduce((inner, allocation) => inner + allocation.amountUsed, 0),
    0,
  );
}

function isDateExpired(date: string | null): boolean {
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(`${date}T00:00:00`).getTime() < today.getTime();
}

function getAccountValidationMessages(
  account: AssetAccount,
  eligibleBalance: number,
  allocatedTotal: number,
  isExpired: boolean,
): AssetValidationMessage[] {
  const messages: AssetValidationMessage[] = [];

  if (!account.institutionName || !account.accountHolder || account.endBalance <= 0) {
    messages.push({
      severity: "blocking",
      code: "MISSING_ASSET_FIELDS",
      message: "Required asset fields are missing.",
    });
  }

  if (allocatedTotal > eligibleBalance) {
    messages.push({
      severity: "blocking",
      code: "ALLOCATIONS_EXCEED_ELIGIBLE_BALANCE",
      message: "Total allocations exceed eligible usable balance.",
    });
  }

  if (
    account.isRetirement &&
    account.allocations.some((allocation) => allocation.type === "cash_to_close")
  ) {
    messages.push({
      severity: "blocking",
      code: "RETIREMENT_CASH_TO_CLOSE",
      message: "Retirement accounts cannot be used for cash to close.",
    });
  }

  if (isExpired) {
    messages.push({
      severity: "warning",
      code: "STATEMENT_EXPIRED",
      message: "Asset statement is expired.",
    });
  }

  return messages;
}
