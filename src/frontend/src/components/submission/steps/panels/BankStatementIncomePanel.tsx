import { CurrencyInput } from "@/components/submission/common/CurrencyInput";
import { ToggleGroup } from "@/components/submission/common/ToggleGroup";
import { useLoanSubmissionStore } from "@/state/submissionStore";
import type { BankStatementIncomeDraft } from "@/types/submission";

export function BankStatementIncomePanel({
  income,
}: {
  income: BankStatementIncomeDraft;
}) {
  const updateIncome = useLoanSubmissionStore((state) => state.updateIncome);

  return (
    <section className="submission-card fade-slide-in">
      <ToggleGroup
        label="Qualifying income method"
        value={income.statementPeriod}
        options={[
          { value: "12_personal", label: "12-mo Personal" },
          { value: "24_personal", label: "24-mo Personal" },
          { value: "12_business", label: "12-mo Business" },
          { value: "24_business", label: "24-mo Business" },
        ]}
        onChange={(statementPeriod) => updateIncome({ statementPeriod })}
      />
      <div className="form-grid">
        <CurrencyInput
          label="Income calculated from statements"
          value={income.qualifyingMonthlyIncome}
          onChange={(qualifyingMonthlyIncome) =>
            updateIncome({ qualifyingMonthlyIncome })
          }
        />
        <label className="field">
          <span>Business ownership %</span>
          <input
            inputMode="decimal"
            value={income.businessOwnershipPct ?? ""}
            onChange={(event) =>
              updateIncome({
                businessOwnershipPct: event.target.value
                  ? Number(event.target.value)
                  : null,
              })
            }
          />
        </label>
      </div>
      <label className="check-field">
        <input
          checked={income.hasCpaLetter}
          type="checkbox"
          onChange={(event) => updateIncome({ hasCpaLetter: event.target.checked })}
        />
        CPA letter on file
      </label>
    </section>
  );
}
