import type { IntakeAnswers, ProgramRecommendation } from "@/types/intake";

const definitions: Record<string, Omit<ProgramRecommendation, "program_key" | "rank" | "match_strength" | "disqualified">> = {
  dscr: {
    title: "DSCR Loan",
    tagline: "Qualify using your property's rental income instead of personal income.",
    rate_range_label: "Typically in the 7% to 9% range",
    doc_requirements: [
      "Lease agreement or rent schedule",
      "DSCR ratio at or above program minimum",
      "PITI reserve documentation",
    ],
    suitability_note: "Ideal for real estate investors with rental property cash flow.",
  },
  bank_statement: {
    title: "Bank Statement Loan",
    tagline: "Use deposit history instead of tax returns to support qualifying income.",
    rate_range_label: "Typically in the 7.5% to 10% range",
    doc_requirements: [
      "12 or 24 months of bank statements",
      "CPA letter for business accounts",
      "Business ownership documentation",
    ],
    suitability_note: "Built for business owners whose tax returns may understate income.",
  },
  asset_depletion: {
    title: "Asset Depletion",
    tagline: "Convert savings and investments into qualifying monthly income.",
    rate_range_label: "Typically in the 7.5% to 9.5% range",
    doc_requirements: [
      "Asset statements",
      "Liquid or retirement account balances",
      "Reserve verification",
    ],
    suitability_note: "Designed for retirees and high-net-worth borrowers with substantial assets.",
  },
  full_doc: {
    title: "Full Documentation",
    tagline: "Use traditional employment and income documentation for a Non-QM path.",
    rate_range_label: "Typically in the 6.75% to 8.75% range",
    doc_requirements: [
      "Paystubs and W-2s",
      "Employment history",
      "Asset and reserve statements",
    ],
    suitability_note: "Best for borrowers with consistent W-2 income and straightforward documentation.",
  },
  foreign_national: {
    title: "Foreign National",
    tagline: "Explore financing options for borrowers without traditional U.S. credit.",
    rate_range_label: "Typically in the 8% to 11% range",
    doc_requirements: [
      "Passport or visa documentation",
      "Foreign credit or reference letters",
      "Asset and reserve documentation",
    ],
    suitability_note: "Useful when the borrower has international income or limited U.S. credit depth.",
  },
  interest_only: {
    title: "Interest Only",
    tagline: "Lower the initial monthly payment with an interest-only structure.",
    rate_range_label: "Typically in the 7.25% to 9.75% range",
    doc_requirements: [
      "Qualifying income documentation",
      "Higher reserve verification",
      "Strong credit profile",
    ],
    suitability_note: "A fit for larger loans where payment flexibility matters and reserves are strong.",
  },
};

const programs = Object.keys(definitions);

function creditMin(answers: IntakeAnswers): number {
  return {
    "580_619": 580,
    "620_659": 620,
    "660_699": 660,
    "700_739": 700,
    "740_plus": 740,
  }[answers.credit_range ?? "580_619"];
}

function loanAmount(answers: IntakeAnswers): number {
  return Number(answers.loan_amount ?? 0);
}

function isDisqualified(program: string, answers: IntakeAnswers): boolean {
  if (program === "dscr") {
    return answers.property_type === "primary" || creditMin(answers) < 620;
  }
  if (program === "bank_statement") return answers.income_type !== "self_employed";
  if (program === "asset_depletion") return !["assets", "retired"].includes(answers.income_type ?? "");
  if (program === "full_doc") return answers.income_type !== "w2";
  if (program === "foreign_national") return answers.income_type !== "foreign_national";
  if (program === "interest_only") return creditMin(answers) < 660 || loanAmount(answers) < 500000;
  return false;
}

function scoreProgram(program: string, answers: IntakeAnswers): number {
  const fico = creditMin(answers);
  const amount = loanAmount(answers);

  if (program === "dscr") {
    return (
      (answers.property_type === "investment" ? 30 : 0) +
      (answers.income_type === "rental" ? 25 : 0) +
      (fico >= 700 ? 20 : 0) +
      (amount >= 300000 ? 10 : 0)
    );
  }
  if (program === "bank_statement") {
    return (
      (answers.income_type === "self_employed" ? 35 : 0) +
      (answers["income_context.bank_statement_months"] === "24" ? 15 : 0) +
      (fico >= 660 ? 15 : 0)
    );
  }
  if (program === "asset_depletion") {
    return ((["assets", "retired"].includes(answers.income_type ?? "") ? 40 : 0) + (fico >= 680 ? 15 : 0));
  }
  if (program === "full_doc") {
    return (
      (answers.income_type === "w2" ? 35 : 0) +
      (answers.income_context === "consistent_employment_yes" ? 20 : 0) +
      (fico >= 660 ? 15 : 0)
    );
  }
  if (program === "foreign_national") {
    return (
      (answers.income_type === "foreign_national" ? 45 : 0) +
      (answers["income_context.has_us_itin"] === "yes" ? 10 : 0) +
      (answers.property_type === "investment" ? 10 : 0)
    );
  }
  if (program === "interest_only") {
    return (amount >= 750000 ? 20 : 0) + (fico >= 700 ? 20 : 0);
  }
  return 0;
}

export function rankMockPrograms(answers: IntakeAnswers): ProgramRecommendation[] {
  const scored = programs
    .map((program) => {
      const disqualified = isDisqualified(program, answers);
      return {
        program,
        score: disqualified ? 0 : scoreProgram(program, answers),
        disqualified,
      };
    })
    .sort((a, b) => b.score - a.score || a.program.localeCompare(b.program));

  const qualified = scored.filter((item) => !item.disqualified).slice(0, 3);
  const nearMiss = scored.filter((item) => item.disqualified).slice(0, 1);

  return [...qualified, ...nearMiss].map((item, index) => ({
    program_key: item.program,
    rank: index + 1,
    match_strength: item.disqualified ? "unlikely" : item.score >= 50 ? "strong" : "possible",
    disqualified: item.disqualified,
    ...definitions[item.program],
  }));
}
