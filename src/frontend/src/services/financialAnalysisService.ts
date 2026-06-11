import type { AssetAccount } from "@/types/financialAnalysis";

type MockAssetWorksheet = {
  fundsRequiredToClose: number | null;
  accounts: AssetAccount[];
};

// TODO: Replace this mock with GET /loans/{loanId}/financial-analysis/assets
// once the asset_accounts and asset_allocations APIs exist.
export async function getMockAssetWorksheet(loanId: string): Promise<MockAssetWorksheet> {
  await Promise.resolve();

  const suffix = loanId.slice(-4).toUpperCase();

  return {
    fundsRequiredToClose: 92500,
    accounts: [
      {
        id: `asset-${suffix}-checking`,
        institutionName: "Chase",
        accountHolder: "Primary Borrower",
        borrowerId: null,
        borrowerAge: 42,
        accountType: "checking",
        isRetirement: false,
        accountNumberLast4: "1842",
        endBalance: 148000,
        statementExpirationDate: addDaysIso(48),
        notes: "Primary operating account. Most recent two statements received.",
        allocations: [
          {
            id: `alloc-${suffix}-ctc`,
            type: "cash_to_close",
            amountUsed: 72500,
            notes: "Verified funds available for purchase closing.",
          },
          {
            id: `alloc-${suffix}-reserves-1`,
            type: "reserves",
            amountUsed: 25000,
            notes: "Reserve cushion after cash to close.",
          },
        ],
      },
      {
        id: `asset-${suffix}-brokerage`,
        institutionName: "Fidelity",
        accountHolder: "Primary Borrower",
        borrowerId: null,
        borrowerAge: 42,
        accountType: "brokerage",
        isRetirement: false,
        accountNumberLast4: "9301",
        endBalance: 286000,
        statementExpirationDate: addDaysIso(21),
        notes: "Brokerage balance excludes margin availability.",
        allocations: [
          {
            id: `alloc-${suffix}-depletion`,
            type: "asset_depletion",
            amountUsed: 150000,
            notes: "Used for 60-month asset depletion calculation.",
          },
          {
            id: `alloc-${suffix}-reserves-2`,
            type: "reserves",
            amountUsed: 50000,
            notes: "Available reserves after depletion allocation.",
          },
        ],
      },
      {
        id: `asset-${suffix}-retirement`,
        institutionName: "Vanguard",
        accountHolder: "Primary Borrower",
        borrowerId: null,
        borrowerAge: 42,
        accountType: "retirement_401k",
        isRetirement: true,
        accountNumberLast4: "4409",
        endBalance: 210000,
        statementExpirationDate: addDaysIso(-7),
        notes: "Statement is expired; new statement required before final approval.",
        allocations: [
          {
            id: `alloc-${suffix}-atr`,
            type: "atr_in_full",
            amountUsed: 60000,
            notes: "ATR support only; not eligible for cash to close.",
          },
        ],
      },
    ],
  };
}

function addDaysIso(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}
