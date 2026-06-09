import { formatCurrency } from "@/lib/utils";
import { CurrencyInput } from "@/components/submission/common/CurrencyInput";
import { ToggleGroup } from "@/components/submission/common/ToggleGroup";
import { useLoanSubmissionStore } from "@/state/submissionStore";
import type { DscrIncomeDraft } from "@/types/submission";

export function DscrIncomePanel({ income }: { income: DscrIncomeDraft }) {
  const updateIncome = useLoanSubmissionStore((state) => state.updateIncome);

  return (
    <section className="submission-card fade-slide-in">
      <CurrencyInput
        label="Monthly market rent"
        value={income.monthlyRent}
        onChange={(monthlyRent) => updateIncome({ monthlyRent })}
      />
      <ToggleGroup
        label="Rental income source"
        value={income.rentSource}
        options={[
          { value: "signed_lease", label: "Signed Lease" },
          { value: "market_rent_appraisal", label: "Market Rent" },
          { value: "projected", label: "Projected" },
        ]}
        onChange={(rentSource) => updateIncome({ rentSource })}
      />
      <div className="calculation-bar">
        <span>PITIA: {formatCurrency(income.pitia ?? 0)}</span>
        <span>Monthly Rent: {formatCurrency(income.monthlyRent ?? 0)}</span>
        <strong className={ratioTone(income.dscrRatio)}>
          DSCR: {income.dscrRatio ? income.dscrRatio.toFixed(2) : "Pending"}
        </strong>
      </div>
    </section>
  );
}

function ratioTone(value: number | null) {
  if (value === null) return "";
  if (value >= 1) return "success-text";
  if (value >= 0.9) return "warning-text";
  return "danger-text";
}
