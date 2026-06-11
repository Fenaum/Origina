import { useEffect, useMemo, useState } from "react";
import {
  computeAssetAccounts,
  computeAssetWorksheetSummary,
  getAssetWorksheetState,
  getIncomeOutputRecords,
  useFinancialAnalysisStore,
} from "@/state/financialAnalysisStore";
import type {
  AssetAccount,
  AssetAccountComputed,
  AssetAccountType,
  AssetAllocation,
  AssetAllocationType,
  AssetValidationMessage,
} from "@/types/financialAnalysis";

type Props = {
  loanId: string;
};

const fmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const ACCOUNT_TYPE_OPTIONS: { value: AssetAccountType; label: string }[] = [
  { value: "checking", label: "Checking" },
  { value: "savings", label: "Savings" },
  { value: "money_market", label: "Money Market" },
  { value: "brokerage", label: "Brokerage" },
  { value: "retirement_401k", label: "401(k)" },
  { value: "retirement_ira", label: "IRA" },
  { value: "other", label: "Other" },
];

const ALLOCATION_TYPE_OPTIONS: { value: AssetAllocationType; label: string }[] = [
  { value: "cash_to_close", label: "Cash to Close" },
  { value: "asset_depletion", label: "Asset Depletion" },
  { value: "atr_in_full", label: "ATR in Full" },
  { value: "reserves", label: "Reserves" },
];

const ALLOCATION_LABELS = Object.fromEntries(
  ALLOCATION_TYPE_OPTIONS.map((option) => [option.value, option.label]),
) as Record<AssetAllocationType, string>;

export function AssetReserveAnalysis({ loanId }: Props) {
  const {
    worksheetsByLoan,
    loadAssetWorksheet,
    setFundsRequiredToClose,
    addAccount,
    updateAccount,
    addAllocation,
    updateAllocation,
    removeAllocation,
  } = useFinancialAnalysisStore();

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const worksheet = getAssetWorksheetState(worksheetsByLoan, loanId);

  useEffect(() => {
    void loadAssetWorksheet(loanId);
  }, [loadAssetWorksheet, loanId]);

  const accounts = useMemo(
    () => computeAssetAccounts(worksheet.accounts),
    [worksheet.accounts],
  );
  const summary = useMemo(
    () => computeAssetWorksheetSummary(worksheet.accounts, worksheet.fundsRequiredToClose),
    [worksheet.accounts, worksheet.fundsRequiredToClose],
  );
  const incomeOutputs = useMemo(() => getIncomeOutputRecords(summary), [summary]);

  if (!worksheet.loaded) {
    return (
      <div className="asset-analysis-loading">
        <div className="asset-skeleton asset-skeleton--wide" />
        <div className="asset-skeleton-grid">
          <div className="asset-skeleton" />
          <div className="asset-skeleton" />
          <div className="asset-skeleton" />
        </div>
      </div>
    );
  }

  return (
    <div className="asset-analysis">
      <div className="asset-analysis-main">
        <div className="asset-analysis-toolbar">
          <div>
            <h4>Asset & Reserve Analysis</h4>
            <p>
              Enter each asset once, then allocate it across cash to close,
              asset depletion, ATR, and reserves.
            </p>
          </div>
          <button type="button" className="asset-action-button" onClick={() => addAccount(loanId)}>
            Add Account
          </button>
        </div>

        <div className="asset-account-list">
          {accounts.map((account) => (
            <AssetAccountRow
              key={account.id}
              account={account}
              isExpanded={expanded[account.id] ?? true}
              onToggle={() =>
                setExpanded((prev) => ({ ...prev, [account.id]: !(prev[account.id] ?? true) }))
              }
              onPatch={(patch) => updateAccount(loanId, account.id, patch)}
              onAddAllocation={(type) => addAllocation(loanId, account.id, type)}
              onPatchAllocation={(allocationId, patch) =>
                updateAllocation(loanId, account.id, allocationId, patch)
              }
              onRemoveAllocation={(allocationId) =>
                removeAllocation(loanId, account.id, allocationId)
              }
            />
          ))}
        </div>
      </div>

      <aside className="asset-summary-panel">
        <div className="asset-summary-header">
          <span>Live Summary</span>
          <strong>{summary.validationMessages.filter((m) => m.severity === "blocking").length} blockers</strong>
        </div>

        <label className="asset-summary-input">
          <span>Funds Required to Close</span>
          <input
            type="number"
            min="0"
            value={worksheet.fundsRequiredToClose ?? ""}
            onChange={(event) =>
              setFundsRequiredToClose(
                loanId,
                event.target.value ? Number(event.target.value) : null,
              )
            }
            placeholder="0"
          />
        </label>

        <div className="asset-summary-lines">
          <SummaryLine label="Total verified assets" value={summary.totalVerifiedAssets} />
          <SummaryLine label="Total eligible assets" value={summary.totalEligibleAssets} />
          <SummaryLine label="Cash to close" value={summary.cashToCloseAllocated} />
          <SummaryLine label="Asset depletion" value={summary.assetDepletionAllocated} />
          <SummaryLine label="ATR allocation" value={summary.atrAllocated} />
          <SummaryLine label="Available reserves" value={summary.availableReserves} />
          <SummaryLine label="Unallocated eligible" value={summary.remainingUnallocatedEligibleAssets} />
          <SummaryLine label="Monthly depletion income" value={summary.monthlyAssetDepletionIncome} />
          <SummaryLine
            label="Additional needed"
            value={summary.additionalNeededToClose}
            tone={summary.additionalNeededToClose && summary.additionalNeededToClose > 0 ? "warning" : "normal"}
          />
        </div>

        <ValidationList messages={summary.validationMessages} />

        <div className="asset-income-output">
          <span className="asset-panel-label">Prepared Income Output</span>
          {incomeOutputs.length === 0 ? (
            <p>No asset-based income output yet.</p>
          ) : (
            incomeOutputs.map((output) => (
              <div key={output.id} className="asset-income-output-row">
                <span>{output.description}</span>
                <strong>{fmt.format(output.monthlyAmount)} / mo</strong>
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}

function AssetAccountRow({
  account,
  isExpanded,
  onToggle,
  onPatch,
  onAddAllocation,
  onPatchAllocation,
  onRemoveAllocation,
}: {
  account: AssetAccountComputed;
  isExpanded: boolean;
  onToggle: () => void;
  onPatch: (patch: Partial<AssetAccount>) => void;
  onAddAllocation: (type: AssetAllocationType) => void;
  onPatchAllocation: (allocationId: string, patch: Partial<AssetAllocation>) => void;
  onRemoveAllocation: (allocationId: string) => void;
}) {
  return (
    <article className="asset-account-card">
      <button type="button" className="asset-account-header" onClick={onToggle}>
        <span className="asset-account-chevron">{isExpanded ? "-" : "+"}</span>
        <span>
          <strong>{account.institutionName || "New asset account"}</strong>
          <small>
            {account.accountHolder || "No holder"} / {account.accountNumberLast4 ? `**** ${account.accountNumberLast4}` : "No last four"}
          </small>
        </span>
        <span className="asset-account-metrics">
          <b>{fmt.format(account.endBalance)}</b>
          <small>Eligible {fmt.format(account.eligibleBalance)}</small>
        </span>
      </button>

      {isExpanded && (
        <div className="asset-account-body">
          <div className="asset-account-grid">
            <AssetInput
              label="Institution"
              value={account.institutionName}
              onChange={(value) => onPatch({ institutionName: value })}
            />
            <AssetInput
              label="Account Holder"
              value={account.accountHolder}
              onChange={(value) => onPatch({ accountHolder: value })}
            />
            <label className="asset-field">
              <span>Account Type</span>
              <select
                value={account.accountType}
                onChange={(event) => {
                  const accountType = event.target.value as AssetAccountType;
                  onPatch({
                    accountType,
                    isRetirement: accountType.startsWith("retirement"),
                  });
                }}
              >
                {ACCOUNT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <AssetInput
              label="Borrower Age"
              type="number"
              value={account.borrowerAge?.toString() ?? ""}
              onChange={(value) => onPatch({ borrowerAge: value ? Number(value) : null })}
            />
            <AssetInput
              label="Last Four"
              value={account.accountNumberLast4 ?? ""}
              onChange={(value) => onPatch({ accountNumberLast4: value || null })}
            />
            <AssetInput
              label="End Balance"
              type="number"
              value={String(account.endBalance || "")}
              onChange={(value) => onPatch({ endBalance: value ? Number(value) : 0 })}
            />
            <AssetInput
              label="Statement Expiration"
              type="date"
              value={account.statementExpirationDate ?? ""}
              onChange={(value) => onPatch({ statementExpirationDate: value || null })}
            />
            <label className="asset-field asset-field--checkbox">
              <input
                type="checkbox"
                checked={account.isRetirement}
                onChange={(event) => onPatch({ isRetirement: event.target.checked })}
              />
              <span>Retirement account</span>
            </label>
          </div>

          <div className="asset-account-status">
            <span>Allocated {fmt.format(account.allocatedTotal)}</span>
            <span>Remaining {fmt.format(account.remainingEligibleBalance)}</span>
            {account.isExpired && <span className="asset-pill asset-pill--warning">Statement expired</span>}
          </div>

          {account.validationMessages.length > 0 && (
            <ValidationList messages={account.validationMessages} compact />
          )}

          <div className="asset-allocation-header">
            <strong>Allocations</strong>
            <div>
              {ALLOCATION_TYPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onAddAllocation(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="asset-allocation-list">
            {account.allocations.length === 0 ? (
              <p className="asset-empty-row">No allocations yet.</p>
            ) : (
              account.allocations.map((allocation) => (
                <div key={allocation.id} className="asset-allocation-row">
                  <select
                    value={allocation.type}
                    onChange={(event) =>
                      onPatchAllocation(allocation.id, {
                        type: event.target.value as AssetAllocationType,
                      })
                    }
                  >
                    {ALLOCATION_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0"
                    value={allocation.amountUsed || ""}
                    onChange={(event) =>
                      onPatchAllocation(allocation.id, {
                        amountUsed: event.target.value ? Number(event.target.value) : 0,
                      })
                    }
                    placeholder="Amount"
                  />
                  <input
                    value={allocation.notes ?? ""}
                    onChange={(event) =>
                      onPatchAllocation(allocation.id, { notes: event.target.value || null })
                    }
                    placeholder={`${ALLOCATION_LABELS[allocation.type]} notes`}
                  />
                  <button type="button" onClick={() => onRemoveAllocation(allocation.id)}>
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </article>
  );
}

function AssetInput({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "number" | "date";
}) {
  return (
    <label className="asset-field">
      <span>{label}</span>
      <input
        type={type}
        min={type === "number" ? "0" : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function SummaryLine({
  label,
  value,
  tone = "normal",
}: {
  label: string;
  value: number | null;
  tone?: "normal" | "warning";
}) {
  return (
    <div className={`asset-summary-line asset-summary-line--${tone}`}>
      <span>{label}</span>
      <strong>{value == null ? "-" : fmt.format(value)}</strong>
    </div>
  );
}

function ValidationList({
  messages,
  compact = false,
}: {
  messages: AssetValidationMessage[];
  compact?: boolean;
}) {
  if (messages.length === 0) {
    return (
      <div className={`asset-validation asset-validation--clear${compact ? " asset-validation--compact" : ""}`}>
        No asset validation issues.
      </div>
    );
  }

  return (
    <div className={`asset-validation${compact ? " asset-validation--compact" : ""}`}>
      {messages.map((message, index) => (
        <div
          key={`${message.code}-${index}`}
          className={`asset-validation-row asset-validation-row--${message.severity}`}
        >
          <span>{message.severity === "blocking" ? "Blocking" : "Warning"}</span>
          <p>{message.message}</p>
        </div>
      ))}
    </div>
  );
}
