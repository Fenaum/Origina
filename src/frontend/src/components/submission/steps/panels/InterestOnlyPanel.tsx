import { ToggleGroup } from "@/components/submission/common/ToggleGroup";
import { useLoanSubmissionStore } from "@/state/submissionStore";
import type { InterestOnlyIncomeDraft } from "@/types/submission";

export function InterestOnlyPanel({ income }: { income: InterestOnlyIncomeDraft }) {
  const updateIncome = useLoanSubmissionStore((state) => state.updateIncome);

  return (
    <section className="submission-card fade-slide-in">
      <ToggleGroup
        label="Qualifying method"
        value={income.qualifyingMethod}
        options={[
          { value: "full_doc", label: "Full Doc" },
          { value: "bank_statement", label: "Bank Statement" },
          { value: "asset_depletion", label: "Asset Depletion" },
        ]}
        onChange={(qualifyingMethod) => updateIncome({ qualifyingMethod })}
      />
      <ToggleGroup
        label="IO period"
        value={String(income.ioPeriodYears)}
        options={[
          { value: "5", label: "5 Years" },
          { value: "7", label: "7 Years" },
          { value: "10", label: "10 Years" },
        ]}
        onChange={(ioPeriodYears) =>
          updateIncome({ ioPeriodYears: Number(ioPeriodYears) as 5 | 7 | 10 })
        }
      />
      <div className="calculation-bar">
        <strong>Qualifying at fully amortized payment</strong>
        <span>TODO: Pricing Engine will provide exact qualifying payment.</span>
      </div>
    </section>
  );
}
