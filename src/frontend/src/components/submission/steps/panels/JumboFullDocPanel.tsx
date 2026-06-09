import { CurrencyInput } from "@/components/submission/common/CurrencyInput";
import { ToggleGroup } from "@/components/submission/common/ToggleGroup";
import { useLoanSubmissionStore } from "@/state/submissionStore";
import type { FullDocIncomeDraft } from "@/types/submission";

export function JumboFullDocPanel({ income }: { income: FullDocIncomeDraft }) {
  const updateIncome = useLoanSubmissionStore((state) => state.updateIncome);

  return (
    <section className="submission-card fade-slide-in">
      <ToggleGroup
        label="Employment type"
        value={income.employmentStatus}
        options={[
          { value: "employed", label: "W2 / Employed" },
          { value: "self_employed", label: "Self-employed" },
        ]}
        onChange={(employmentStatus) => updateIncome({ employmentStatus })}
      />
      <div className="form-grid">
        <label className="field">
          <span>Employer name</span>
          <input
            value={income.employerName}
            onChange={(event) => updateIncome({ employerName: event.target.value })}
          />
        </label>
        <label className="field">
          <span>Years on job</span>
          <input
            inputMode="decimal"
            value={income.yearsOnJob ?? ""}
            onChange={(event) =>
              updateIncome({
                yearsOnJob: event.target.value ? Number(event.target.value) : null,
              })
            }
          />
        </label>
        <CurrencyInput
          label="Monthly gross income"
          value={income.monthlyGrossIncome}
          onChange={(monthlyGrossIncome) => updateIncome({ monthlyGrossIncome })}
        />
      </div>
    </section>
  );
}
