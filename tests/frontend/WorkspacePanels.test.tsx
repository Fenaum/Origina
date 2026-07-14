// tests/frontend/WorkspacePanels.test.tsx
//
// Sprint 6 §6.2 — vitest smoke coverage for the read-only Borrower +
// Property panels that WorkspaceHome renders. These tests prove:
//   - The panels render with a populated borrower / property.
//   - The panels render sensible "—" placeholders when nothing is
//     populated (the empty-state contract).
//
// The two components are simple projections — full behavior coverage
// lives in the backend `test_loan_detail.py` and the higher-level
// WorkspaceHome snapshot test. Here we focus on the surface that
// would break the moment someone removes an `if (!primary)` guard.
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BorrowerPanel } from "@/components/loans/workspace/BorrowerPanel";
import { PropertyPanel } from "@/components/loans/workspace/PropertyPanel";
import type {
  BorrowerSummaryOut,
  LoanFinancialsOut,
  PropertySummaryOut,
} from "@/types/api";

const mockPrimary: BorrowerSummaryOut = {
  id: "b-primary",
  loan_id: "loan-1",
  type: "primary_borrower",
  first_name: "Jane",
  last_name: "Smith",
  email: "jane@example.com",
  phone: "555-0100",
  ssn_last4: "1234",
  dob: "1985-06-15",
  income_type: "salary",
  income_amount: 12000,
  employer_name: "Acme Co",
};

const mockCoBorrower: BorrowerSummaryOut = {
  id: "b-co",
  loan_id: "loan-1",
  type: "co_borrower",
  first_name: "John",
  last_name: "Smith",
  email: "john@example.com",
  phone: null,
  ssn_last4: null,
  dob: null,
  income_type: null,
  income_amount: null,
  employer_name: null,
};

const mockFinancials: LoanFinancialsOut = {
  loan_id: "loan-1",
  loan_amount: 450000,
  purchase_price: 500000,
  appraised_value: 510000,
  down_payment: 100000,
  ltv: 75,
  cltv: null,
  fico_score: 720,
  debt_to_income: null,
  dscr: null,
  cash_reserves: null,
  monthly_rent: null,
  monthly_income: null,
  monthly_debt: null,
  other_income: null,
  other_debt: null,
  principal_and_interest: null,
  current_balance: null,
  escrow_amount: null,
  total_monthly_payment: null,
  property_taxes: null,
  homeowners_insurance: null,
  hoa_fees: null,
  other_expenses: null,
  created_at: "2026-07-01T00:00:00Z",
  updated_at: "2026-07-01T00:00:00Z",
};

const mockSubject: PropertySummaryOut = {
  id: "p-1",
  loan_id: "loan-1",
  is_subject: true,
  address1: "123 Main St",
  address2: null,
  city: "Miami",
  state: "FL",
  postal_code: "33101",
  property_type: "single_family",
  occupancy: "investment",
};

describe("BorrowerPanel", () => {
  it("renders the primary borrower's full contact detail", () => {
    render(
      <BorrowerPanel
        primary={mockPrimary}
        coBorrower={mockCoBorrower}
        financials={mockFinancials}
      />,
    );
    // Name concatenation + contact
    expect(screen.getByText("Jane Smith")).toBeInTheDocument();
    expect(screen.getByText("John Smith")).toBeInTheDocument();
    expect(screen.getByText("jane@example.com")).toBeInTheDocument();
    expect(screen.getByText("555-0100")).toBeInTheDocument();
    // Financials
    expect(screen.getByText("720")).toBeInTheDocument();
    expect(screen.getByText("Acme Co")).toBeInTheDocument();
  });

  it("renders an empty state when no primary borrower is populated", () => {
    render(
      <BorrowerPanel
        primary={null}
        coBorrower={null}
        financials={null}
      />,
    );
    // "—" placeholders — not "null" or "undefined".
    const dashCells = screen.getAllByText("—");
    // Each FieldRow has at least one dash; we don't pin the exact
    // count, just that they're present.
    expect(dashCells.length).toBeGreaterThan(3);
  });

  it("does not crash when only the primary is populated", () => {
    render(
      <BorrowerPanel
        primary={mockPrimary}
        coBorrower={null}
        financials={null}
      />,
    );
    expect(screen.getByText("Jane Smith")).toBeInTheDocument();
  });
});

describe("PropertyPanel", () => {
  it("renders the subject property address + occupancy + appraised value", () => {
    render(
      <PropertyPanel
        subjectProperty={mockSubject}
        fallbackOccupancy={null}
        financials={mockFinancials}
      />,
    );
    expect(screen.getByText(/123 Main St/)).toBeInTheDocument();
    expect(screen.getByText(/Miami, FL, 33101/)).toBeInTheDocument();
    // Money fields render with locale-formatted currency
    expect(screen.getByText(/\$510,000/)).toBeInTheDocument();
    expect(screen.getByText(/\$500,000/)).toBeInTheDocument();
  });

  it("falls back to the loan's occupancy when the property is missing", () => {
    render(
      <PropertyPanel
        subjectProperty={null}
        fallbackOccupancy="primary_residence"
        financials={null}
      />,
    );
    // The Occupancy row should pick up the fallback value.
    expect(screen.getByText("primary_residence")).toBeInTheDocument();
  });

  it("renders an empty state when neither subject nor financials exist", () => {
    render(
      <PropertyPanel
        subjectProperty={null}
        fallbackOccupancy={null}
        financials={null}
      />,
    );
    const dashCells = screen.getAllByText("—");
    expect(dashCells.length).toBeGreaterThan(3);
  });
});
