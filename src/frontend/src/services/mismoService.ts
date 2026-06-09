import type { MismoParsed } from "@/types/submission";

const MOCK_DELAY_MS = process.env.NODE_ENV === "production" ? 0 : 420;

export async function parseMismoFile(file: File): Promise<MismoParsed> {
  if (MOCK_DELAY_MS > 0) {
    await new Promise((resolve) => window.setTimeout(resolve, MOCK_DELAY_MS));
  }

  // TODO: Real MISMO Parsing Service. The final implementation should parse
  // client-side first and avoid transmitting raw SSN during mapping review.
  const source = file.name.endsWith(".fnm") ? "fnm_3_2" : "mismo_3_4";

  return {
    source,
    confidence: 0.86,
    borrowers: [
      {
        firstName: "Jordan",
        lastName: "Rivera",
        ssn: "123-45-6789",
        email: "jordan.rivera@example.com",
        phone: "555-0198",
        estimatedFico: 730,
      },
    ],
    property: {
      street1: "123 Oak Lane",
      city: "Seattle",
      state: "WA",
      postalCode: "98101",
      estimatedValue: 1100000,
      propertyType: "single_family",
      units: 1,
    },
    loan: {
      product: "bank_statement",
      purpose: "purchase",
      loanAmount: 875000,
      estimatedPropertyValue: 1100000,
      occupancyType: "owner_occupied",
    },
    income: {
      type: "bank_statement",
      statementPeriod: "12_business",
      qualifyingMonthlyIncome: 24500,
      businessOwnershipPct: 100,
      expenseRatio: 35,
      hasCpaLetter: false,
    },
    unmappedFields: [
      { sourceKey: "IncomeTypeDetail", sourceValue: "SelfEmployedScheduleC" },
      { sourceKey: "InvestorProductCode", sourceValue: "NQM-BS-12" },
    ],
    conflicts: [
      {
        field: "setup.loanAmount",
        mismoValue: 875000,
        existingValue: 850000,
      },
    ],
  };
}
