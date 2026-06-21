import { productLabels } from "@/data/submissionConfig";
import { CurrencyInput } from "@/components/submission/common/CurrencyInput";
import { ProductGuidanceCard } from "@/components/submission/common/ProductGuidanceCard";
import { ToggleGroup } from "@/components/submission/common/ToggleGroup";
import { useLoanSubmissionStore } from "@/state/submissionStore";
import type { LoanProgram, LoanPurpose, OccupancyType } from "@/types/submission";

const productOptions = Object.entries(productLabels).map(([value, label]) => ({
  value: value as LoanProgram,
  label,
}));

const purposeOptions: { value: LoanPurpose; label: string }[] = [
  { value: "purchase", label: "Purchase" },
  { value: "refinance", label: "Rate-Term Refi" },
  { value: "cash_out", label: "Cash-Out Refi" },
];

const occupancyOptions: { value: OccupancyType; label: string }[] = [
  { value: "owner_occupied", label: "Owner" },
  { value: "second_home", label: "Second Home" },
  { value: "investment", label: "Investment" },
];

export function LoanSetupStep() {
  const { draft, updateSetup, saveDraft } = useLoanSubmissionStore();

  return (
    <div className="submission-two-column">
      <section className="submission-card fade-slide-in">
        <ToggleGroup
          label="What type of Non-QM product?"
          options={productOptions}
          value={draft.setup.product}
          onChange={(product) => updateSetup({ product })}
        />
        <ToggleGroup
          label="What is the loan purpose?"
          options={purposeOptions}
          value={draft.setup.purpose}
          onChange={(purpose) => updateSetup({ purpose })}
        />
        <CurrencyInput
          label="Estimated loan amount"
          value={draft.setup.loanAmount}
          onBlur={() => void saveDraft()}
          onChange={(loanAmount) => updateSetup({ loanAmount })}
        />
        {draft.setup.product ? (
          <div className="progressive-fields fade-slide-in">
            {draft.setup.product !== "dscr" ? (
              <ToggleGroup
                label="Occupancy type"
                options={occupancyOptions}
                value={draft.setup.occupancyType}
                onChange={(occupancyType) => updateSetup({ occupancyType })}
              />
            ) : null}
            <CurrencyInput
              label="Estimated property value"
              value={draft.setup.estimatedPropertyValue}
              onBlur={() => void saveDraft()}
              onChange={(estimatedPropertyValue) =>
                updateSetup({ estimatedPropertyValue })
              }
            />
          </div>
        ) : null}
      </section>
      <ProductGuidanceCard product={draft.setup.product} />
    </div>
  );
}
