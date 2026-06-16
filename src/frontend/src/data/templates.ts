// Predefined Non-QM task and condition templates.
// Applied client-side — no new DB tables required.

export type TaskTemplate = {
  title: string;
  description?: string;
  priority: "low" | "normal" | "high" | "urgent";
};

export type ConditionTemplate = {
  name: string;
  description?: string;
  stage: "prior_to_docs" | "prior_to_approval" | "prior_to_funding";
};

export type Template<T> = {
  id: string;
  name: string;
  description: string;
  items: T[];
};

// ── Task Templates ────────────────────────────────────────────────────────────

export const TASK_TEMPLATES: Template<TaskTemplate>[] = [
  {
    id: "dscr-purchase",
    name: "DSCR Purchase",
    description: "Standard processing checklist for DSCR investment property purchases",
    items: [
      { title: "Order appraisal", description: "Order full URAR appraisal from approved AMC", priority: "high" },
      { title: "Verify rental income", description: "Review lease agreements or market rent schedule (1007)", priority: "high" },
      { title: "Calculate DSCR", description: "Confirm gross rent / PITIA ≥ 1.0 (guideline minimum)", priority: "high" },
      { title: "Pull credit report", description: "Tri-merge credit report — verify no derogatory events within seasoning period", priority: "high" },
      { title: "Verify cash reserves", description: "Confirm minimum 6 months PITIA reserves in eligible accounts", priority: "normal" },
      { title: "Order title", description: "Open title order with approved title company", priority: "normal" },
      { title: "Prepare disclosure package", description: "Issue LE within 3 business days of application date", priority: "urgent" },
      { title: "Upload executed purchase contract", description: "Confirm all pages signed, addenda included", priority: "normal" },
      { title: "Verify entity documents (if applicable)", description: "Articles of incorporation / operating agreement / EIN", priority: "normal" },
      { title: "Submit to underwriting", description: "Full package complete — submit for UW review", priority: "high" },
    ],
  },
  {
    id: "bank-stmt-refinance",
    name: "Bank Statement Refinance",
    description: "Processing checklist for 12/24-month bank statement self-employed refinance",
    items: [
      { title: "Collect 12 or 24 months bank statements", description: "Personal or business — must be consecutive months", priority: "urgent" },
      { title: "Calculate qualifying income", description: "Apply expense factor per guidelines (typically 50% for business)", priority: "high" },
      { title: "Verify CPA letter or business license", description: "Self-employment must be seasoned ≥ 2 years", priority: "high" },
      { title: "Pull credit report", description: "Tri-merge — verify FICO meets program minimum", priority: "high" },
      { title: "Order appraisal", description: "URAR — confirm value supports LTV target", priority: "high" },
      { title: "Order title / payoff demand", description: "Payoff statement good for 30 days from close", priority: "normal" },
      { title: "Prepare refinance disclosure package", description: "Issue initial LE — collect TRID intent to proceed", priority: "urgent" },
      { title: "Verify seasoning on existing loan", description: "Confirm no 30-day lates in past 12 months", priority: "normal" },
      { title: "Submit to underwriting", description: "Full package ready for UW", priority: "high" },
    ],
  },
  {
    id: "asset-depletion",
    name: "Asset Depletion",
    description: "Checklist for asset-depletion income qualification",
    items: [
      { title: "Collect 2 months asset statements", description: "All eligible accounts — must be fully vested and seasoned 60 days", priority: "urgent" },
      { title: "Calculate monthly asset depletion income", description: "Eligible assets ÷ depletion term (per program guidelines)", priority: "high" },
      { title: "Verify retirement accounts haircut", description: "Apply 30% reduction for retirement accounts per guidelines", priority: "high" },
      { title: "Confirm assets after closing costs", description: "Ensure required reserves remain after all costs", priority: "high" },
      { title: "Pull credit report", description: "Tri-merge", priority: "high" },
      { title: "Order appraisal", description: "Full URAR required", priority: "normal" },
      { title: "Order title", priority: "normal" },
      { title: "Prepare LE / disclosures", priority: "urgent" },
    ],
  },
  {
    id: "full-processing",
    name: "Full Processing Checklist",
    description: "Comprehensive milestone checklist for any Non-QM loan",
    items: [
      { title: "Issue initial disclosures", description: "LE due within 3 business days of complete application", priority: "urgent" },
      { title: "Order appraisal", priority: "high" },
      { title: "Order title commitment", priority: "high" },
      { title: "Pull tri-merge credit report", priority: "high" },
      { title: "Collect income documentation", description: "W-2, tax returns, bank statements, or asset statements per program", priority: "high" },
      { title: "Verify employment / self-employment", priority: "normal" },
      { title: "Collect hazard insurance binder", priority: "normal" },
      { title: "Flood certification", priority: "normal" },
      { title: "Initial stacking / document review", description: "Ensure all required docs present before submitting to UW", priority: "normal" },
      { title: "Submit to underwriting", priority: "high" },
      { title: "Issue appraisal to borrower (ECOA)", description: "Must be issued at least 3 business days before consummation", priority: "high" },
      { title: "Collect signed conditions", priority: "normal" },
      { title: "Request loan docs", description: "After all conditions cleared and CTF issued", priority: "high" },
      { title: "Coordinate signing appointment", priority: "normal" },
      { title: "Fund loan", priority: "urgent" },
    ],
  },
];

// ── Condition Templates ───────────────────────────────────────────────────────

export const CONDITION_TEMPLATES: Template<ConditionTemplate>[] = [
  {
    id: "dscr-full",
    name: "DSCR Full Package",
    description: "Standard prior-to-approval conditions for DSCR investment loans",
    items: [
      { name: "Executed purchase contract (all pages)", stage: "prior_to_approval" },
      { name: "URAR appraisal — full report", stage: "prior_to_approval" },
      { name: "Signed lease agreement or 1007 market rent schedule", stage: "prior_to_approval", description: "Required to support gross rental income used in DSCR calculation" },
      { name: "Tri-merge credit report", stage: "prior_to_approval" },
      { name: "2 months asset statements (all accounts)", stage: "prior_to_approval", description: "Must confirm minimum 6 months PITIA reserves" },
      { name: "Entity documents (if entity vesting)", stage: "prior_to_docs", description: "Articles of incorporation, operating agreement, EIN letter" },
      { name: "Hazard insurance binder", stage: "prior_to_docs" },
      { name: "Title commitment — Schedule A & B-1", stage: "prior_to_docs" },
      { name: "Flood certification", stage: "prior_to_funding" },
      { name: "Final appraisal — as-is value confirmed", stage: "prior_to_funding" },
    ],
  },
  {
    id: "bank-stmt-full",
    name: "Bank Statement Full Package",
    description: "Prior-to-approval conditions for bank statement self-employed borrowers",
    items: [
      { name: "12 months personal bank statements (consecutive)", stage: "prior_to_approval" },
      { name: "24 months business bank statements", stage: "prior_to_approval", description: "If qualifying on business statements" },
      { name: "CPA letter confirming 2-year self-employment history", stage: "prior_to_approval" },
      { name: "Business license or DBA registration", stage: "prior_to_approval" },
      { name: "Tri-merge credit report — no derogatory events within seasoning", stage: "prior_to_approval" },
      { name: "URAR appraisal", stage: "prior_to_approval" },
      { name: "2 months asset statements — verify reserves", stage: "prior_to_approval" },
      { name: "Existing mortgage statement (refinance)", stage: "prior_to_approval", description: "12-month payment history required" },
      { name: "Hazard insurance binder", stage: "prior_to_docs" },
      { name: "Title commitment", stage: "prior_to_docs" },
    ],
  },
  {
    id: "standard-purchase",
    name: "Standard Non-QM Purchase",
    description: "General prior-to-approval condition set for Non-QM purchase transactions",
    items: [
      { name: "Executed purchase contract — all addenda", stage: "prior_to_approval" },
      { name: "Proof of earnest money deposit", stage: "prior_to_approval" },
      { name: "Income documentation per qualifying program", stage: "prior_to_approval", description: "W-2, tax returns, bank statements, or 1099s" },
      { name: "Tri-merge credit report", stage: "prior_to_approval" },
      { name: "URAR appraisal", stage: "prior_to_approval" },
      { name: "2 months asset statements — down payment + reserves", stage: "prior_to_approval" },
      { name: "Gift letter (if gift funds used)", stage: "prior_to_approval" },
      { name: "Hazard insurance commitment letter", stage: "prior_to_docs" },
      { name: "Title insurance commitment", stage: "prior_to_docs" },
      { name: "Flood certification", stage: "prior_to_funding" },
      { name: "Payoff demand (if subordinate lien)", stage: "prior_to_funding" },
    ],
  },
  {
    id: "refi-package",
    name: "Refinance Package",
    description: "Standard conditions for Non-QM rate/term or cash-out refinance",
    items: [
      { name: "Income documentation per program", stage: "prior_to_approval" },
      { name: "Tri-merge credit report", stage: "prior_to_approval" },
      { name: "URAR appraisal", stage: "prior_to_approval" },
      { name: "12-month mortgage payment history — no 30-day lates", stage: "prior_to_approval" },
      { name: "Current mortgage statement with payoff balance", stage: "prior_to_approval" },
      { name: "2 months asset statements — verify reserves", stage: "prior_to_approval" },
      { name: "Hazard insurance renewal binder", stage: "prior_to_docs" },
      { name: "Title commitment — confirm existing liens", stage: "prior_to_docs" },
      { name: "Payoff statement — good through closing date", stage: "prior_to_funding" },
    ],
  },
];
