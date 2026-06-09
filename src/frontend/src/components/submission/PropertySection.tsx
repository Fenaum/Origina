import { formatCurrency, formatPercent } from "@/lib/utils";
import { CurrencyInput } from "@/components/submission/common/CurrencyInput";
import { ToggleGroup } from "@/components/submission/common/ToggleGroup";
import { useLoanSubmissionStore } from "@/state/submissionStore";
import type { PropertyType } from "@/types/submission";

const propertyTypes: { value: PropertyType; label: string }[] = [
  { value: "single_family", label: "Single Family" },
  { value: "condo", label: "Condo" },
  { value: "multi_family", label: "Multi-Family" },
  { value: "townhouse", label: "Townhouse" },
  { value: "commercial", label: "Commercial" },
];

export function PropertySection() {
  const { draft, updateProperty, saveDraft } = useLoanSubmissionStore();
  const value = draft.property.estimatedValue ?? draft.setup.estimatedPropertyValue;
  const ltv = draft.setup.loanAmount && value ? (draft.setup.loanAmount / value) * 100 : null;

  return (
    <section className="submission-card fade-slide-in">
      <div className="form-grid">
        <label className="field wide">
          <span>Subject property address</span>
          <input
            placeholder="Street address"
            value={draft.property.street1}
            onBlur={() => void saveDraft()}
            onChange={(event) => updateProperty({ street1: event.target.value })}
          />
        </label>
        <label className="field">
          <span>City</span>
          <input
            value={draft.property.city}
            onChange={(event) => updateProperty({ city: event.target.value })}
          />
        </label>
        <label className="field">
          <span>State</span>
          <input
            maxLength={2}
            value={draft.property.state}
            onChange={(event) => updateProperty({ state: event.target.value.toUpperCase() })}
          />
        </label>
        <label className="field">
          <span>ZIP</span>
          <input
            value={draft.property.postalCode}
            onChange={(event) => updateProperty({ postalCode: event.target.value })}
          />
        </label>
      </div>
      <ToggleGroup
        label="Property type"
        options={propertyTypes}
        value={draft.property.propertyType}
        onChange={(propertyType) => updateProperty({ propertyType })}
      />
      {draft.property.propertyType === "multi_family" ? (
        <label className="field narrow fade-slide-in">
          <span>Number of units</span>
          <input
            inputMode="numeric"
            value={draft.property.units ?? ""}
            onChange={(event) => updateProperty({ units: Number(event.target.value) })}
          />
        </label>
      ) : null}
      <div className="form-grid">
        <CurrencyInput
          label="Estimated value"
          value={draft.property.estimatedValue}
          onBlur={() => void saveDraft()}
          onChange={(estimatedValue) => updateProperty({ estimatedValue })}
        />
        {draft.setup.purpose === "purchase" ? (
          <CurrencyInput
            label="Purchase price"
            value={draft.property.purchasePrice}
            onBlur={() => void saveDraft()}
            onChange={(purchasePrice) => updateProperty({ purchasePrice })}
          />
        ) : null}
      </div>
      <div className="calculation-bar">
        <span>Loan Amount: {formatCurrency(draft.setup.loanAmount ?? 0)}</span>
        <span>Estimated Value: {formatCurrency(value ?? 0)}</span>
        <span>LTV: {ltv ? formatPercent(ltv, 1) : "Pending"}</span>
        <strong>{ltv && ltv <= 85 ? "Within guidelines" : "Review needed"}</strong>
      </div>
    </section>
  );
}
