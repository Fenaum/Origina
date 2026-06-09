import type { PricingInputParams, PricingScenario } from "@/types/submission";

const MOCK_DELAY_MS = process.env.NODE_ENV === "production" ? 0 : 220;

async function waitForMockDelay() {
  if (MOCK_DELAY_MS === 0) return;
  await new Promise((resolve) => window.setTimeout(resolve, MOCK_DELAY_MS));
}

export async function runMockPricing(
  params: PricingInputParams,
): Promise<PricingScenario[]> {
  await waitForMockDelay();

  // TODO: Pricing Engine integration. Keep this contract stable for Optimal Blue,
  // Lender Price, or an internal pricing API.
  const baseRate = params.product === "dscr" ? 7.375 : 7.25;
  const payment = monthlyPayment(params.loanAmount, baseRate, params.termMonths);

  return [
    scenario("par", "Par Rate", baseRate, 0, payment, params, false),
    scenario("buydown", "Buy Down", baseRate - 0.375, 1, payment - 233, params, true),
    scenario("credit", "Lender Credit", baseRate + 0.25, -0.5, payment + 145, params, false),
  ];
}

function scenario(
  id: string,
  label: string,
  rate: number,
  points: number,
  monthlyPaymentValue: number,
  params: PricingInputParams,
  isSelected: boolean,
): PricingScenario {
  return {
    id,
    label,
    rate,
    points,
    apr: rate + Math.max(points, 0) * 0.08,
    monthlyPayment: Math.round(monthlyPaymentValue),
    monthlyPaymentIo:
      params.product === "interest_only"
        ? Math.round((params.loanAmount * (rate / 100)) / 12)
        : null,
    breakEvenMonths: points > 0 ? 38 : null,
    loanAmount: params.loanAmount,
    termMonths: params.termMonths,
    amortizationType: params.product === "interest_only" ? "Interest Only" : "Fixed",
    isSelected,
    createdAt: new Date().toISOString(),
  };
}

function monthlyPayment(loanAmount: number, rate: number, termMonths: number) {
  const monthlyRate = rate / 100 / 12;
  return (
    (loanAmount * monthlyRate * (1 + monthlyRate) ** termMonths) /
    ((1 + monthlyRate) ** termMonths - 1)
  );
}
