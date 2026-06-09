import type {
  AssetDepletionIncomeDraft,
  BankStatementIncomeDraft,
  BorrowerDraft,
  DocumentChecklistItem,
  DscrIncomeDraft,
  FullDocIncomeDraft,
  IncomeDraft,
  InterestOnlyIncomeDraft,
  LoanProgram,
  LoanSetupDraft,
  SubmissionDraft,
  SubmissionStep,
  ValidationRuleSet,
} from "@/types/submission";

export const submissionSteps: {
  id: SubmissionStep;
  label: string;
  subtitle: string;
  estimatedTime: string;
}[] = [
  { id: "setup", label: "Loan Setup", subtitle: "Product, purpose, and amount", estimatedTime: "2 min" },
  { id: "property", label: "Property", subtitle: "Subject property and value", estimatedTime: "2 min" },
  { id: "borrower", label: "Borrower", subtitle: "Identity and contact", estimatedTime: "3 min" },
  { id: "co-borrower", label: "Co-Borrower", subtitle: "Optional supporting borrower", estimatedTime: "2 min" },
  { id: "income", label: "Income", subtitle: "Product-adaptive qualifying", estimatedTime: "4 min" },
  { id: "assets", label: "Assets", subtitle: "Down payment and reserves", estimatedTime: "3 min" },
  { id: "pricing", label: "Pricing", subtitle: "Rate scenario selection", estimatedTime: "2 min" },
  { id: "documents", label: "Documents", subtitle: "Smart checklist", estimatedTime: "5 min" },
  { id: "review", label: "Review", subtitle: "Readiness and submit", estimatedTime: "2 min" },
];

export const productLabels: Record<LoanProgram, string> = {
  dscr: "DSCR",
  bank_statement: "Bank Statement",
  asset_depletion: "Asset Depletion",
  interest_only: "Interest Only",
  jumbo_non_qm: "Jumbo Non-QM",
};

export const productGuidance: Record<LoanProgram, string> = {
  dscr:
    "We'll need a lease agreement or market rent support and a DSCR ratio at or above 1.00. Personal income documentation is not required.",
  bank_statement:
    "We'll need bank statements, business context, and a CPA letter when self-employment verification applies.",
  asset_depletion:
    "We'll qualify income from verified liquid assets. Retirement assets receive a conservative haircut.",
  interest_only:
    "Interest-only structure still qualifies on a fully amortized payment and typically needs stronger reserves.",
  jumbo_non_qm:
    "Jumbo Non-QM needs stronger borrower, income, reserves, and credit documentation.",
};

export const validationRules: Record<LoanProgram, ValidationRuleSet> = {
  dscr: {
    required: ["income.monthlyRent", "income.rentSource", "property.units"],
    computed: [
      { rule: "dscrMinimum", threshold: 1, severity: "blocking" },
      { rule: "ltvMaximum", threshold: 85, severity: "blocking" },
    ],
    documents: ["lease_agreement", "rent_roll", "reserves_statement"],
  },
  bank_statement: {
    required: ["income.statementPeriod", "income.qualifyingMonthlyIncome"],
    computed: [{ rule: "ltvMaximum", threshold: 90, severity: "blocking" }],
    documents: ["bank_statements_12mo", "cpa_letter", "business_license"],
  },
  asset_depletion: {
    required: ["income.totalLiquidAssets"],
    computed: [{ rule: "reserveMinimum", threshold: 6, severity: "warning" }],
    documents: ["asset_statements", "reserves_statement"],
  },
  interest_only: {
    required: ["income.qualifyingMethod", "income.ioPeriodYears"],
    computed: [{ rule: "reserveMinimum", threshold: 12, severity: "warning" }],
    documents: ["reserves_statement", "income_package"],
  },
  jumbo_non_qm: {
    required: ["income.employerName", "income.monthlyGrossIncome"],
    computed: [{ rule: "ficoWarning", threshold: 700, severity: "warning" }],
    documents: ["income_package", "reserves_statement", "insurance_binder"],
  },
};

export function emptyBorrower(type: BorrowerDraft["type"]): BorrowerDraft {
  return {
    id: crypto.randomUUID(),
    type,
    firstName: "",
    lastName: "",
    ssn: "",
    dob: null,
    email: "",
    phone: "",
    address: { street1: "", street2: "", city: "", state: "", postalCode: "" },
    sameAsSubjectProperty: false,
    estimatedFico: null,
    maritalStatus: null,
    citizenshipStatus: null,
    relationship: null,
  };
}

export function incomeForProduct(product: LoanProgram | null): IncomeDraft {
  if (product === "bank_statement") {
    return {
      type: "bank_statement",
      statementPeriod: "12_personal",
      qualifyingMonthlyIncome: null,
      businessOwnershipPct: null,
      expenseRatio: null,
      hasCpaLetter: false,
    } satisfies BankStatementIncomeDraft;
  }

  if (product === "asset_depletion") {
    return {
      type: "asset_depletion",
      totalLiquidAssets: null,
      retirementAssets: null,
      depletionPeriodMonths: 360,
      monthlyQualifyingIncome: null,
    } satisfies AssetDepletionIncomeDraft;
  }

  if (product === "interest_only") {
    return {
      type: "interest_only",
      qualifyingMethod: "bank_statement",
      ioPeriodYears: 10,
      qualifyingPayment: null,
    } satisfies InterestOnlyIncomeDraft;
  }

  if (product === "jumbo_non_qm") {
    return {
      type: "full_doc",
      employmentStatus: "employed",
      employerName: "",
      yearsOnJob: null,
      monthlyGrossIncome: null,
    } satisfies FullDocIncomeDraft;
  }

  return {
    type: "dscr",
    monthlyRent: null,
    rentSource: "signed_lease",
    pitia: null,
    dscrRatio: null,
  } satisfies DscrIncomeDraft;
}

export const defaultSetup: LoanSetupDraft = {
  product: null,
  purpose: null,
  loanAmount: null,
  estimatedPropertyValue: null,
  occupancyType: null,
  loanProduct: "30yr_fixed",
};

export function createEmptySubmissionDraft(
  loanId: string | null = null,
): SubmissionDraft {
  const stepCompleteness = {} as SubmissionDraft["stepCompleteness"];
  const stepErrors = {} as SubmissionDraft["stepErrors"];

  submissionSteps.forEach((step) => {
    stepCompleteness[step.id] = "empty";
    stepErrors[step.id] = [];
  });

  return {
    loanId,
    isDraft: true,
    importSource: null,
    currentStep: "setup",
    visitedSteps: ["setup"],
    stepErrors,
    stepCompleteness,
    setup: defaultSetup,
    property: {
      street1: "",
      street2: "",
      city: "",
      state: "",
      postalCode: "",
      propertyType: null,
      units: null,
      estimatedValue: null,
      purchasePrice: null,
      isNewConstruction: false,
    },
    borrowers: [emptyBorrower("primary_borrower")],
    income: incomeForProduct(null),
    assets: {
      downPaymentAmount: null,
      downPaymentSource: null,
      giftAmount: null,
      accounts: [],
      totalReserves: null,
      reserveMonths: null,
    },
    selectedScenarioId: null,
  };
}

export function generateDocumentChecklist(
  product: LoanProgram | null,
): DocumentChecklistItem[] {
  if (product === "dscr") {
    return [
      checklistItem("lease_agreement", "Lease Agreement or Market Rent Support", "Required for DSCR rent evidence.", "required"),
      checklistItem("reserves_statement", "3 Months PITIA Reserves", "Upload bank or asset statements showing reserves.", "required"),
      checklistItem("purchase_contract", "Executed Purchase Contract", "Required for purchase transactions.", "conditionally_required", "Required when loan purpose is purchase."),
      checklistItem("hoa_financials", "HOA Financials", "Helpful for condo review.", "optional"),
    ];
  }

  if (product === "bank_statement") {
    return [
      checklistItem("bank_statements_12mo", "12-Month Bank Statements", "All pages for the selected statement period.", "required"),
      checklistItem("cpa_letter", "CPA Letter", "Supports self-employed income calculation.", "required"),
      checklistItem("business_license", "Business License", "Confirms business activity.", "required"),
      checklistItem("pl_statement", "P&L Statement", "Required for some business statement files.", "conditionally_required", "Required when business bank statements are selected."),
    ];
  }

  return [
    checklistItem("income_package", "Income Package", "Product-specific income documentation.", "required"),
    checklistItem("reserves_statement", "Reserve Statements", "Evidence of post-closing reserves.", "required"),
    checklistItem("insurance_binder", "Insurance Binder", "Homeowner's insurance evidence.", "required"),
    checklistItem("explanation_letter", "Explanation Letter", "Optional context for underwriting.", "optional"),
  ];
}

function checklistItem(
  docType: string,
  label: string,
  description: string,
  requirement: DocumentChecklistItem["requirement"],
  conditionReason: string | null = null,
): DocumentChecklistItem {
  return {
    docType,
    label,
    description,
    requirement,
    conditionReason,
    uploadStatus: "not_started",
    fileId: null,
    fileName: null,
    rejectionReason: null,
  };
}
