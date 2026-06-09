import { validationRules } from "@/data/submissionConfig";
import type {
  LoanProgram,
  SubmissionDraft,
  SubmissionStep,
  ValidationError,
} from "@/types/submission";

const stepRequiredFields: Record<SubmissionStep, string[]> = {
  setup: ["setup.product", "setup.purpose", "setup.loanAmount"],
  property: ["property.street1", "property.city", "property.state", "property.estimatedValue"],
  borrower: ["borrowers.0.firstName", "borrowers.0.lastName", "borrowers.0.ssn", "borrowers.0.email"],
  "co-borrower": [],
  income: [],
  assets: ["assets.downPaymentAmount", "assets.downPaymentSource"],
  pricing: ["selectedScenarioId"],
  documents: [],
  review: [],
};

export function validateSubmission(draft: SubmissionDraft): ValidationError[] {
  const errors: ValidationError[] = [];

  Object.entries(stepRequiredFields).forEach(([step, fields]) => {
    fields.forEach((field) => {
      if (isEmptyValue(readPath(draft, field))) {
        errors.push({
          field,
          step: step as SubmissionStep,
          severity: "blocking",
          code: "REQUIRED_FIELD",
          message: `${labelFromField(field)} is required.`,
          remedy: "Complete this field before submission.",
        });
      }
    });
  });

  if (draft.setup.product) {
    errors.push(...validateProductRules(draft, draft.setup.product));
  }

  draft.borrowers.forEach((borrower, index) => {
    if (borrower.ssn && !/^\d{3}-?\d{2}-?\d{4}$/.test(borrower.ssn)) {
      errors.push({
        field: `borrowers.${index}.ssn`,
        step: index === 0 ? "borrower" : "co-borrower",
        severity: "blocking",
        code: "INVALID_SSN",
        message: "SSN must be 9 digits.",
        remedy: "Enter a valid SSN before submitting.",
      });
    }
  });

  return errors;
}

export function validateStep(
  draft: SubmissionDraft,
  step: SubmissionStep,
): ValidationError[] {
  return validateSubmission(draft).filter((error) => error.step === step);
}

function validateProductRules(
  draft: SubmissionDraft,
  product: LoanProgram,
): ValidationError[] {
  const rules = validationRules[product];
  const errors: ValidationError[] = [];

  rules.required.forEach((field) => {
    if (isEmptyValue(readPath(draft, field))) {
      errors.push({
        field,
        step: "income",
        severity: "blocking",
        code: "PRODUCT_REQUIRED_FIELD",
        message: `${labelFromField(field)} is required for this product.`,
        remedy: "Complete the product-specific qualifying section.",
      });
    }
  });

  const ltv = computeLtv(draft);
  const primaryBorrower = draft.borrowers[0];

  rules.computed.forEach((rule) => {
    if (
      rule.rule === "dscrMinimum" &&
      draft.income.type === "dscr" &&
      draft.income.dscrRatio !== null &&
      draft.income.dscrRatio < rule.threshold
    ) {
      errors.push({
        field: "income.dscrRatio",
        step: "income",
        severity: rule.severity,
        code: "DSCR_BELOW_MINIMUM",
        message: `DSCR is below ${rule.threshold.toFixed(2)}.`,
        remedy: "Increase rent evidence, reduce payment, or review loan structure.",
      });
    }

    if (rule.rule === "ltvMaximum" && ltv !== null && ltv > rule.threshold) {
      errors.push({
        field: "setup.loanAmount",
        step: "setup",
        severity: rule.severity,
        code: "LTV_EXCEEDS_MAX",
        message: `Estimated LTV is ${ltv.toFixed(1)}%, above the ${rule.threshold}% guideline.`,
        remedy: "Reduce loan amount or update property value.",
      });
    }

    if (
      rule.rule === "reserveMinimum" &&
      draft.assets.reserveMonths !== null &&
      draft.assets.reserveMonths < rule.threshold
    ) {
      errors.push({
        field: "assets.reserveMonths",
        step: "assets",
        severity: rule.severity,
        code: "RESERVES_BELOW_GUIDELINE",
        message: `Reserve months are below the ${rule.threshold}-month guideline.`,
        remedy: "Add qualifying liquid reserves or prepare for conditions.",
      });
    }

    if (
      rule.rule === "ficoWarning" &&
      primaryBorrower?.estimatedFico !== null &&
      primaryBorrower?.estimatedFico !== undefined &&
      primaryBorrower.estimatedFico < rule.threshold
    ) {
      errors.push({
        field: "borrowers.0.estimatedFico",
        step: "borrower",
        severity: rule.severity,
        code: "FICO_BELOW_GUIDELINE",
        message: `FICO below ${rule.threshold} may require stronger reserves.`,
        remedy: "Consider additional reserves or a compensating factor.",
      });
    }
  });

  return errors;
}

function computeLtv(draft: SubmissionDraft): number | null {
  const value = draft.property.estimatedValue ?? draft.setup.estimatedPropertyValue;
  if (!draft.setup.loanAmount || !value) return null;
  return (draft.setup.loanAmount / value) * 100;
}

function readPath(source: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((value, key) => {
    if (value === null || value === undefined) return undefined;
    if (/^\d+$/.test(key) && Array.isArray(value)) return value[Number(key)];
    if (typeof value === "object") return (value as Record<string, unknown>)[key];
    return undefined;
  }, source);
}

function isEmptyValue(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}

function labelFromField(field: string): string {
  return field
    .split(".")
    .at(-1)!
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase());
}
