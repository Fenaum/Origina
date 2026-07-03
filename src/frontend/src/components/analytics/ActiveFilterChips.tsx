// ActiveFilterChips — visual list of currently-applied filters, each clickable
// to remove. Keeps the user oriented when many filters are stacked.
//
// Visuals: pill-shaped chips with brand-tinted backgrounds, a small × close
// button, and a "Clear all" pill that flips to inverse on hover. The empty
// state shows a brand-tinted hint instead of plain text.

import { CloseIcon, FilterIcon } from "@/components/analytics/ChartIcons";
import type {
  AnalyticsFilter,
  DatePreset,
  DateRangeFilter,
  FieldFilter,
} from "@/types/analytics";

const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  today:        "Today",
  last_7_days:  "Last 7 days",
  last_30_days: "Last 30 days",
  this_month:   "This month",
  last_month:   "Last month",
  this_quarter: "This quarter",
  year_to_date: "Year to date",
  custom:       "Custom range",
};

const DATE_FIELD_LABELS: Record<string, string> = {
  submitted_at: "submitted",
  funding_date: "funded",
  closing_date: "closing",
  created_at:   "created",
};

const FIELD_LABELS: Record<string, string> = {
  status:        "Status",
  loan_program:  "Program",
  purpose:       "Purpose",
  assigned_to:   "Assigned",
  loan_amount:   "Loan amount",
  ltv:           "LTV",
  fico_score:    "FICO",
  dscr:          "DSCR",
  dti:           "DTI",
  occupancy_type:"Occupancy",
};

type Chip = {
  key: string;
  label: string;
  onRemove: () => void;
};

type ActiveFilterChipsProps = {
  filter: AnalyticsFilter;
  onChange: (next: AnalyticsFilter) => void;
};

export function ActiveFilterChips({ filter, onChange }: ActiveFilterChipsProps) {
  const chips: Chip[] = [];

  if (filter.dateRange) {
    chips.push({
      key: `date-${filter.dateRange.field}`,
      label: dateRangeLabel(filter.dateRange),
      onRemove: () => onChange({ ...filter, dateRange: undefined, page: 1 }),
    });
  }

  filter.filters.forEach((f, idx) => {
    chips.push({
      key: `field-${f.field}-${idx}`,
      label: fieldFilterLabel(f),
      onRemove: () => {
        const next = filter.filters.filter((_, i) => i !== idx);
        onChange({ ...filter, filters: next, page: 1 });
      },
    });
  });

  if (chips.length === 0) {
    return (
      <div className="active-chips" aria-label="Active filters">
        <span className="active-chips-empty">
          <FilterIcon width={12} height={12} />
          No filters applied — showing all loans
        </span>
      </div>
    );
  }

  return (
    <div className="active-chips" aria-label="Active filters">
      <span className="active-chips-label">
        <FilterIcon width={11} height={11} />
        Active
      </span>
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          className="chip"
          onClick={chip.onRemove}
          aria-label={`Remove filter: ${chip.label}`}
          title="Click to remove"
        >
          <span className="chip-label">{chip.label}</span>
          <span className="chip-x" aria-hidden>
            <CloseIcon width={9} height={9} />
          </span>
        </button>
      ))}
      <button
        type="button"
        className="chip chip-clear"
        onClick={() =>
          onChange({ ...filter, filters: [], dateRange: undefined, page: 1 })
        }
        aria-label="Clear all filters"
      >
        Clear all
      </button>
    </div>
  );
}

function dateRangeLabel(dr: DateRangeFilter): string {
  if (dr.preset === "custom") {
    const from = dr.fromDate ?? "…";
    const to = dr.toDate ?? "…";
    return `${DATE_FIELD_LABELS[dr.field] ?? dr.field}: ${from} → ${to}`;
  }
  return `${DATE_FIELD_LABELS[dr.field] ?? dr.field}: ${DATE_PRESET_LABELS[dr.preset]}`;
}

function fieldFilterLabel(f: FieldFilter): string {
  const fieldLabel = FIELD_LABELS[f.field] ?? f.field;
  let valueLabel = "—";
  if (Array.isArray(f.value)) {
    valueLabel = f.value.length <= 2 ? f.value.join(", ") : `${f.value.length} selected`;
  } else if (f.value != null) {
    valueLabel = String(f.value);
  }
  return `${fieldLabel}: ${valueLabel}`;
}