import { formatCurrency } from "@/lib/utils";
import { CurrencyInput } from "@/components/submission/common/CurrencyInput";
import { useLoanSubmissionStore } from "@/state/submissionStore";
import type { AssetDepletionIncomeDraft } from "@/types/submission";

export function AssetDepletionPanel({
  income,
}: {
  income: AssetDepletionIncomeDraft;
}) {
  const updateIncome = useLoanSubmissionStore((state) => state.updateIncome);

  return (
    <section className="submission-card fade-slide-in">
      <div className="form-grid">
        <CurrencyInput
          label="Total qualifying liquid assets"
          value={income.totalLiquidAssets}
          onChange={(totalLiquidAssets) => updateIncome({ totalLiquidAssets })}
        />
        <CurrencyInput
          label="Retirement assets"
          value={income.retirementAssets}
          onChange={(retirementAssets) => updateIncome({ retirementAssets })}
        />
      </div>
      <div className="calculation-bar">
        <span>Total Assets ÷ 360 months</span>
        <strong>
          Monthly income: {formatCurrency(income.monthlyQualifyingIncome ?? 0)}
        </strong>
      </div>
    </section>
  );
}
