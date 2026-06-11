// Financial Analysis types mirror the future underwriting worksheet API.
// The frontend uses these now with mock data so the workspace can evolve
// without changing component contracts when backend persistence is added.

export type FinancialAnalysisSubsection =
  | "overview"
  | "employment"
  | "self_employment"
  | "rental"
  | "assets"
  | "other_income"
  | "summary"
  | "audit";

export type AssetAccountType =
  | "checking"
  | "savings"
  | "money_market"
  | "brokerage"
  | "retirement_401k"
  | "retirement_ira"
  | "other";

export type AssetAllocationType =
  | "cash_to_close"
  | "asset_depletion"
  | "atr_in_full"
  | "reserves";

export type AssetAccount = {
  id: string;
  institutionName: string;
  accountHolder: string;
  borrowerId: string | null;
  borrowerAge: number | null;
  accountType: AssetAccountType;
  isRetirement: boolean;
  accountNumberLast4: string | null;
  endBalance: number;
  statementExpirationDate: string | null;
  notes: string | null;
  allocations: AssetAllocation[];
};

export type AssetAllocation = {
  id: string;
  type: AssetAllocationType;
  amountUsed: number;
  notes: string | null;
};

export type AssetAccountComputed = AssetAccount & {
  eligibleBalance: number;
  allocatedTotal: number;
  remainingEligibleBalance: number;
  isExpired: boolean;
  validationMessages: AssetValidationMessage[];
};

export type AssetValidationSeverity = "blocking" | "warning";

export type AssetValidationMessage = {
  severity: AssetValidationSeverity;
  code: string;
  message: string;
};

export type AssetWorksheetSummary = {
  totalVerifiedAssets: number;
  totalEligibleAssets: number;
  cashToCloseAllocated: number;
  assetDepletionAllocated: number;
  atrAllocated: number;
  availableReserves: number;
  remainingUnallocatedEligibleAssets: number;
  monthlyAssetDepletionIncome: number;
  fundsRequiredToClose: number | null;
  additionalNeededToClose: number | null;
  validationMessages: AssetValidationMessage[];
};

export type IncomeOutputRecord = {
  id: string;
  incomeType: "other_income";
  description: "Asset Depletion" | "ATR";
  monthlyAmount: number;
};
