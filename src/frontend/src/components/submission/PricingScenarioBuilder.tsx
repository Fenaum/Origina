import { useEffect, useMemo } from "react";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { LoadingSpinner } from "@/components/feedback/LoadingSpinner";
import { PricingScenarioCard } from "@/components/submission/pricing/PricingScenarioCard";
import { useLoanSubmissionStore } from "@/state/submissionStore";
import { usePricingStore } from "@/state/pricingStore";
import type { PricingInputParams } from "@/types/submission";

export function PricingScenarioBuilder() {
  const draft = useLoanSubmissionStore((state) => state.draft);
  const selectDraftScenario = useLoanSubmissionStore((state) => state.selectScenario);
  const { scenarios, activeScenarioId, isLoading, runPricing, selectScenario } =
    usePricingStore();
  const borrower = draft.borrowers[0];
  const estimatedValue = draft.property.estimatedValue ?? draft.setup.estimatedPropertyValue;

  const params: PricingInputParams | null = useMemo(
    () =>
      draft.setup.loanAmount &&
      estimatedValue &&
      borrower?.estimatedFico &&
      draft.setup.product &&
      draft.setup.purpose
        ? {
            loanAmount: draft.setup.loanAmount,
            ltv: (draft.setup.loanAmount / estimatedValue) * 100,
            fico: borrower.estimatedFico,
            product: draft.setup.product,
            purpose: draft.setup.purpose,
            termMonths: 360,
            lockDays: 45,
          }
        : null,
    [borrower, draft.setup, estimatedValue],
  );

  useEffect(() => {
    if (params && scenarios.length === 0) {
      void runPricing(params);
    }
  }, [params, runPricing, scenarios.length]);

  return (
    <section className="submission-card fade-slide-in">
      <div className="pricing-input-panel">
        <div>
          <p className="eyebrow">Pricing Inputs</p>
          <h3>Run Pricing</h3>
        </div>
        {params ? (
          <div className="pricing-input-grid">
            <span>Loan {formatCurrency(params.loanAmount)}</span>
            <span>LTV {formatPercent(params.ltv, 1)}</span>
            <span>FICO {params.fico}</span>
            <span>Lock {params.lockDays} days</span>
          </div>
        ) : (
          <p className="muted">Complete setup, property value, and borrower FICO to run pricing.</p>
        )}
        <button
          className="primary-button"
          disabled={!params || isLoading}
          type="button"
          onClick={() => params && void runPricing(params)}
        >
          {isLoading ? <LoadingSpinner label="Running pricing" /> : null}
          Run Pricing
        </button>
      </div>
      <div className="scenario-grid">
        {scenarios.map((scenario) => (
          <PricingScenarioCard
            key={scenario.id}
            scenario={scenario}
            selected={activeScenarioId === scenario.id}
            onSelect={() => {
              selectScenario(scenario.id);
              selectDraftScenario(scenario.id);
            }}
          />
        ))}
      </div>
    </section>
  );
}
