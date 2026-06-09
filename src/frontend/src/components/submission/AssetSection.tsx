import { formatCurrency } from "@/lib/utils";
import { CurrencyInput } from "@/components/submission/common/CurrencyInput";
import { ToggleGroup } from "@/components/submission/common/ToggleGroup";
import { useLoanSubmissionStore } from "@/state/submissionStore";
import type { DownPaymentSource } from "@/types/submission";

const sourceOptions: { value: DownPaymentSource; label: string }[] = [
  { value: "personal_savings", label: "Personal Savings" },
  { value: "gift", label: "Gift" },
  { value: "business_funds", label: "Business Funds" },
  { value: "exchange_1031", label: "1031 Exchange" },
  { value: "other", label: "Other" },
];

export function AssetSection() {
  const { draft, updateAssets } = useLoanSubmissionStore();

  return (
    <section className="submission-card fade-slide-in">
      <div className="form-grid">
        <CurrencyInput
          label="Down payment amount"
          value={draft.assets.downPaymentAmount}
          onChange={(downPaymentAmount) => updateAssets({ downPaymentAmount })}
        />
        <ToggleGroup
          label="Down payment source"
          options={sourceOptions}
          value={draft.assets.downPaymentSource}
          onChange={(downPaymentSource) => updateAssets({ downPaymentSource })}
        />
      </div>
      {draft.assets.downPaymentSource === "gift" ? (
        <CurrencyInput
          label="Gift amount"
          value={draft.assets.giftAmount}
          onChange={(giftAmount) => updateAssets({ giftAmount })}
        />
      ) : null}
      <button
        className="ghost-button"
        type="button"
        onClick={() =>
          updateAssets({
            accounts: [
              ...draft.assets.accounts,
              {
                id: crypto.randomUUID(),
                type: "checking",
                institutionName: "New account",
                balance: 0,
              },
            ],
          })
        }
      >
        + Add account
      </button>
      <div className="status-list compact-list">
        {draft.assets.accounts.map((account) => (
          <div className="status-row" key={account.id}>
            <div>
              <strong>{account.institutionName}</strong>
              <span>{account.type}</span>
            </div>
            <input
              className="inline-money-input"
              inputMode="decimal"
              value={account.balance}
              onChange={(event) =>
                updateAssets({
                  accounts: draft.assets.accounts.map((item) =>
                    item.id === account.id
                      ? { ...item, balance: Number(event.target.value) }
                      : item,
                  ),
                })
              }
            />
          </div>
        ))}
      </div>
      <div className="calculation-bar">
        <span>Reserves: {formatCurrency(draft.assets.totalReserves ?? 0)}</span>
        <span>Months: {draft.assets.reserveMonths?.toFixed(1) ?? "Pending"}</span>
        <strong>{(draft.assets.reserveMonths ?? 0) >= 6 ? "Adequate" : "Needs review"}</strong>
      </div>
    </section>
  );
}
