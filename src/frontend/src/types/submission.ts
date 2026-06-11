export type SubmissionStep =
  | "setup"
  | "property"
  | "borrower"
  | "co-borrower"
  | "income"
  | "assets"
  | "pricing"
  | "documents"
  | "review";

export type StepStatus = "empty" | "partial" | "complete" | "skipped" | "error";
export type SaveStatus = "idle" | "saving" | "saved" | "error";
export type ImportSource = "manual" | "mismo" | null;

export type LoanProgram =
  | "dscr"
  | "bank_statement"
  | "asset_depletion"
  | "interest_only"
  | "jumbo_non_qm";

export type LoanPurpose = "purchase" | "rate_term_refi" | "cash_out_refi";
export type OccupancyType = "owner_occupied" | "second_home" | "investment";
export type PropertyType =
  | "single_family"
  | "condo"
  | "multi_family"
  | "townhouse"
  | "commercial";
export type BorrowerRelationship =
  | "spouse"
  | "parent"
  | "business_partner"
  | "other";
export type DownPaymentSource =
  | "personal_savings"
  | "gift"
  | "business_funds"
  | "exchange_1031"
  | "other";

export interface LoanSetupDraft {
  product: LoanProgram | null;
  purpose: LoanPurpose | null;
  loanAmount: number | null;
  estimatedPropertyValue: number | null;
  occupancyType: OccupancyType | null;
  loanProduct: string | null;
}

export interface PropertyDraft {
  street1: string;
  street2: string;
  city: string;
  state: string;
  postalCode: string;
  propertyType: PropertyType | null;
  units: number | null;
  estimatedValue: number | null;
  purchasePrice: number | null;
  isNewConstruction: boolean;
}

export interface AddressDraft {
  street1: string;
  street2: string;
  city: string;
  state: string;
  postalCode: string;
}

export interface BorrowerDraft {
  id: string;
  type: "primary_borrower" | "co_borrower";
  firstName: string;
  lastName: string;
  ssn: string;
  dob: string | null;
  email: string;
  phone: string;
  address: AddressDraft;
  sameAsSubjectProperty: boolean;
  estimatedFico: number | null;
  maritalStatus: string | null;
  citizenshipStatus:
    | "us_citizen"
    | "permanent_resident"
    | "non_permanent_resident"
    | "foreign_national"
    | null;
  relationship: BorrowerRelationship | null;
}

export type IncomeDraft =
  | DscrIncomeDraft
  | BankStatementIncomeDraft
  | AssetDepletionIncomeDraft
  | InterestOnlyIncomeDraft
  | FullDocIncomeDraft;

export interface DscrIncomeDraft {
  type: "dscr";
  monthlyRent: number | null;
  rentSource: "signed_lease" | "market_rent_appraisal" | "projected";
  pitia: number | null;
  dscrRatio: number | null;
}

export interface BankStatementIncomeDraft {
  type: "bank_statement";
  statementPeriod:
    | "12_personal"
    | "24_personal"
    | "12_business"
    | "24_business";
  qualifyingMonthlyIncome: number | null;
  businessOwnershipPct: number | null;
  expenseRatio: number | null;
  hasCpaLetter: boolean;
}

export interface AssetDepletionIncomeDraft {
  type: "asset_depletion";
  totalLiquidAssets: number | null;
  retirementAssets: number | null;
  depletionPeriodMonths: 360;
  monthlyQualifyingIncome: number | null;
}

export interface InterestOnlyIncomeDraft {
  type: "interest_only";
  qualifyingMethod: "full_doc" | "bank_statement" | "asset_depletion";
  ioPeriodYears: 5 | 7 | 10;
  qualifyingPayment: number | null;
}

export interface FullDocIncomeDraft {
  type: "full_doc";
  employmentStatus: "employed" | "self_employed";
  employerName: string;
  yearsOnJob: number | null;
  monthlyGrossIncome: number | null;
}

export interface AssetsDraft {
  downPaymentAmount: number | null;
  downPaymentSource: DownPaymentSource | null;
  giftAmount: number | null;
  accounts: AssetAccount[];
  totalReserves: number | null;
  reserveMonths: number | null;
}

export interface AssetAccount {
  id: string;
  type: "checking" | "savings" | "brokerage" | "retirement" | "crypto" | "other";
  institutionName: string;
  balance: number;
}

export interface PricingScenario {
  id: string;
  label: string;
  rate: number;
  points: number;
  apr: number;
  monthlyPayment: number;
  monthlyPaymentIo: number | null;
  breakEvenMonths: number | null;
  loanAmount: number;
  termMonths: number;
  amortizationType: string;
  isSelected: boolean;
  createdAt: string;
}

export interface PricingInputParams {
  loanAmount: number;
  ltv: number;
  fico: number;
  product: LoanProgram;
  purpose: LoanPurpose;
  termMonths: number;
  lockDays: 30 | 45 | 60;
}

export type DocumentRequirement =
  | "required"
  | "conditionally_required"
  | "optional";
export type DocumentUploadStatus =
  | "not_started"
  | "uploading"
  | "uploaded"
  | "verified"
  | "rejected";

export interface DocumentChecklistItem {
  docType: string;
  label: string;
  description: string;
  requirement: DocumentRequirement;
  conditionReason: string | null;
  uploadStatus: DocumentUploadStatus;
  fileId: string | null;
  fileName: string | null;
  rejectionReason: string | null;
}

export type ValidationSeverity = "blocking" | "warning" | "suggestion";

export interface ValidationError {
  field: string;
  step: SubmissionStep;
  severity: ValidationSeverity;
  code: string;
  message: string;
  remedy: string | null;
}

export interface MismoParsed {
  source: "mismo_3_4" | "fnm_3_2" | "unknown";
  confidence: number;
  borrowers: Partial<BorrowerDraft>[];
  property: Partial<PropertyDraft>;
  loan: Partial<LoanSetupDraft>;
  income: Partial<IncomeDraft>;
  unmappedFields: { sourceKey: string; sourceValue: string }[];
  conflicts: { field: string; mismoValue: unknown; existingValue: unknown }[];
}

export interface SubmissionDraft {
  loanId: string | null;
  isDraft: boolean;
  importSource: ImportSource;
  currentStep: SubmissionStep;
  visitedSteps: SubmissionStep[];
  stepErrors: Record<SubmissionStep, ValidationError[]>;
  stepCompleteness: Record<SubmissionStep, StepStatus>;
  setup: LoanSetupDraft;
  property: PropertyDraft;
  borrowers: BorrowerDraft[];
  income: IncomeDraft;
  assets: AssetsDraft;
  selectedScenarioId: string | null;
}

export interface SubmitResult {
  loanId: string;
  loanNumber: string | null;
  borrowerName: string | null;
  loanAmount: number | null;
  productType: LoanProgram | string | null;
  submittedAt: string | null;
  assignedAeName: string;
}

export type ValidationRuleSet = {
  required: string[];
  computed: {
    rule: "dscrMinimum" | "ltvMaximum" | "reserveMinimum" | "ficoWarning";
    threshold: number;
    severity: ValidationSeverity;
  }[];
  documents: string[];
};
