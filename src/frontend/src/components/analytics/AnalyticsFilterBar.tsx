// AnalyticsFilterBar — global filter strip across the top of the dashboard.
//
// Always-on filters: date range, status multi-select, loan program multi-select,
// purpose multi-select. Optional secondary controls: assigned_to (single).
// Active filter chips appear below the row; users click a chip's X to remove.
//
// Changes write through useAnalyticsFilters — they update the URL and trigger
// a refetch via React Query. There is no Apply button; the dashboard updates
// immediately on each change. Phase 2 of the architecture.

import { useMemo } from "react";
import { ActiveFilterChips } from "@/components/analytics/ActiveFilterChips";
import {
  ChevronDownIcon,
  FilterIcon,
} from "@/components/analytics/ChartIcons";
import type {
  AnalyticsFilter,
  DatePreset,
  DateRangeField,
  DateRangeFilter,
} from "@/types/analytics";
import { loanStatusLabels, type LoanStatus } from "@/types/loan";

const DATE_PRESETS: ReadonlyArray<{ value: DatePreset; label: string }> = [
  { value: "today",        label: "Today" },
  { value: "last_7_days",  label: "Last 7 days" },
  { value: "last_30_days", label: "Last 30 days" },
  { value: "this_month",   label: "This month" },
  { value: "last_month",   label: "Last month" },
  { value: "this_quarter", label: "This quarter" },
  { value: "year_to_date", label: "YTD" },
];

const DATE_FIELDS: ReadonlyArray<{ value: DateRangeField; label: string }> = [
  { value: "submitted_at", label: "Submitted" },
  { value: "funding_date", label: "Funded" },
  { value: "closing_date", label: "Closing" },
  { value: "created_at",   label: "Created" },
];

const PROGRAM_OPTIONS = [
  { value: "dscr",            label: "DSCR" },
  { value: "bank_statement",  label: "Bank Statement" },
  { value: "asset_depletion", label: "Asset Depletion" },
  { value: "interest_only",   label: "Interest Only" },
  { value: "jumbo_non_qm",    label: "Jumbo Non-QM" },
];

const PURPOSE_OPTIONS = [
  { value: "purchase",  label: "Purchase" },
  { value: "refinance", label: "Refinance" },
  { value: "cash_out",  label: "Cash Out" },
  { value: "other",     label: "Other" },
];

const STATUS_OPTIONS: ReadonlyArray<{ value: LoanStatus; label: string }> = (
  Object.keys(loanStatusLabels) as LoanStatus[]
).map((value) => ({ value, label: loanStatusLabels[value] }));

type AnalyticsFilterBarProps = {
  filter: AnalyticsFilter;
  onChange: (next: AnalyticsFilter) => void;
};

export function AnalyticsFilterBar({ filter, onChange }: AnalyticsFilterBarProps) {
  const dateRange = filter.dateRange ?? {
    field: "submitted_at" as DateRangeField,
    preset: "last_30_days" as DatePreset,
  };

  const statusFilter = useMemo(
    () => filter.filters.find((f) => f.field === "status"),
    [filter.filters],
  );
  const programFilter = useMemo(
    () => filter.filters.find((f) => f.field === "loan_program"),
    [filter.filters],
  );
  const purposeFilter = useMemo(
    () => filter.filters.find((f) => f.field === "purpose"),
    [filter.filters],
  );

  function setDateRange(next: Partial<DateRangeFilter>) {
    const merged: DateRangeFilter = {
      ...dateRange,
      ...next,
    };
    onChange({ ...filter, dateRange: merged, page: 1 });
  }

  function toggleMulti(
    field: "status" | "loan_program" | "purpose",
    value: string,
  ) {
    const existing = filter.filters.find((f) => f.field === field);
    const current = (existing && Array.isArray(existing.value))
      ? (existing.value as string[])
      : [];

    let nextValues: string[];
    if (current.includes(value)) {
      nextValues = current.filter((v) => v !== value);
    } else {
      nextValues = [...current, value];
    }

    const others = filter.filters.filter((f) => f.field !== field);
    const next = [...others];
    if (nextValues.length > 0) {
      next.push({ field, operator: "in", value: nextValues });
    }
    onChange({ ...filter, filters: next, page: 1 });
  }

  return (
    <section className="analytics-filter-bar panel" aria-label="Dashboard filters">
      <div className="analytics-filter-accent" aria-hidden />
      <div className="analytics-filter-row">
        <div className="analytics-filter-title">
          <FilterIcon width={14} height={14} />
          <span>Filters</span>
        </div>
        <label className="filter-group">
          <span className="filter-label">Date field</span>
          <select
            className="filter-select"
            value={dateRange.field}
            onChange={(e) => setDateRange({ field: e.target.value as DateRangeField })}
          >
            {DATE_FIELDS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>

        <label className="filter-group">
          <span className="filter-label">Date range</span>
          <select
            className="filter-select"
            value={dateRange.preset}
            onChange={(e) => setDateRange({ preset: e.target.value as DatePreset })}
          >
            {DATE_PRESETS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>

        <MultiSelectGroup
          label="Status"
          options={STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          selected={getSelectedArray(statusFilter)}
          onToggle={(v) => toggleMulti("status", v)}
        />

        <MultiSelectGroup
          label="Program"
          options={PROGRAM_OPTIONS}
          selected={getSelectedArray(programFilter)}
          onToggle={(v) => toggleMulti("loan_program", v)}
        />

        <MultiSelectGroup
          label="Purpose"
          options={PURPOSE_OPTIONS}
          selected={getSelectedArray(purposeFilter)}
          onToggle={(v) => toggleMulti("purpose", v)}
        />
      </div>

      <ActiveFilterChips filter={filter} onChange={onChange} />
    </section>
  );
}

function getSelectedArray(filter: AnalyticsFilter["filters"][number] | undefined): string[] {
  if (!filter) return [];
  if (Array.isArray(filter.value)) return filter.value as string[];
  if (filter.value != null) return [String(filter.value)];
  return [];
}

type MultiSelectGroupProps = {
  label: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  selected: string[];
  onToggle: (value: string) => void;
};

function MultiSelectGroup({ label, options, selected, onToggle }: MultiSelectGroupProps) {
  const summary = selected.length === 0
    ? "All"
    : selected.length <= 2
      ? selected.join(", ")
      : `${selected.length} selected`;

  return (
    <details className="filter-group filter-multi">
      <summary className="filter-summary">
        <span className="filter-label">{label}</span>
        <span className="filter-summary-text">{summary}</span>
        <span className="filter-summary-chevron" aria-hidden>
          <ChevronDownIcon width={11} height={11} />
        </span>
      </summary>
      <div className="filter-options">
        {options.map((opt) => {
          const isSelected = selected.includes(opt.value);
          return (
            <label key={opt.value} className="filter-option">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggle(opt.value)}
              />
              <span>{opt.label}</span>
            </label>
          );
        })}
      </div>
    </details>
  );
}