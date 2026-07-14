// PropertyPanel — read-only subject-property summary panel for the loan
// workspace home. Split out from WorkspaceHome in Sprint 6 §6.2 so it can
// be unit-tested in isolation.
//
// Inputs come from `GET /loans/{id}/detail`'s `subject_property`
// projection. The `financials` carry the appraised-value / purchase-price
// money columns.
import type {
  LoanFinancialsOut,
  PropertyOut,
  PropertySummaryOut,
} from "@/types/api";

type Props = {
  subjectProperty: PropertyOut | PropertySummaryOut | null;
  fallbackOccupancy: string | null;
  financials: LoanFinancialsOut | null;
};

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function addressOf(property: PropertyOut | PropertySummaryOut | null): string {
  if (!property) return "—";
  return [
    property.address1,
    property.city,
    property.state,
    property.postal_code,
  ]
    .filter(Boolean)
    .join(", ") || "—";
}

function fieldOf(
  property: PropertyOut | PropertySummaryOut | null,
  key: keyof PropertyOut & keyof PropertySummaryOut,
): string | null {
  if (!property) return null;
  const value = property[key];
  return typeof value === "string" ? value : null;
}

function FieldRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="home-field-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function PropertyPanel({ subjectProperty, fallbackOccupancy, financials }: Props) {
  return (
    <div className="home-block">
      <h4>Subject Property</h4>
      <FieldRow label="Address" value={addressOf(subjectProperty)} />
      <FieldRow
        label="Occupancy"
        value={
          fieldOf(subjectProperty, "occupancy") ?? fallbackOccupancy ?? "—"
        }
      />
      <FieldRow label="Type" value={fieldOf(subjectProperty, "property_type") ?? "—"} />
      <FieldRow label="Units" value="—" />
      <FieldRow
        label="Appraised value"
        value={
          financials?.appraised_value != null
            ? money.format(Number(financials.appraised_value))
            : "—"
        }
      />
      <FieldRow
        label="Purchase price"
        value={
          financials?.purchase_price != null
            ? money.format(Number(financials.purchase_price))
            : "—"
        }
      />
    </div>
  );
}
