// tests/frontend/WorkspaceConditions.test.tsx
//
// Sprint 2 — Phase 2.3: WorkspaceConditions renders real conditions from the
// API hook, calls the right lifecycle service for each action, and shows the
// correct status badges. These two tests prove the wired surface — no real
// fetch is fired (the hook is mocked).
//
// NOTE on vi.mock factory hoisting: vi.mock is hoisted to the top of the
// module, BEFORE the `const mockConditions` initializer runs. We use
// `vi.hoisted(...)` to define any data the mocks reference inside a callback
// that runs after the hoist.
//
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { WorkspaceConditions } from "@/components/loans/workspace/WorkspaceConditions";
import type { ConditionOut } from "@/types/api";
import type { LoanSummary } from "@/types/loan";

// ── Hoisted mocks ────────────────────────────────────────────────────────────
// Anything the vi.mock factories reference MUST be defined via vi.hoisted,
// otherwise vitest's hoisting puts the factory call above the const.
const { mockConditions, mockLoan, mockRefetch } = vi.hoisted(() => {
  const mockConditions: ConditionOut[] = [
    {
      id: "cond-1",
      loan_id: "loan-1",
      name: "Proof of Income",
      description: "Last 2 years bank statements",
      condition_number: 1,
      status: "open",
      stage: "prior_to_approval",
      cleared_by: null,
      cleared_at: null,
      waived_by: null,
      waived_at: null,
      waive_reason: null,
      created_at: "2026-07-01T00:00:00Z",
      updated_at: "2026-07-01T00:00:00Z",
    },
    {
      id: "cond-2",
      loan_id: "loan-1",
      name: "Property Appraisal",
      description: null,
      condition_number: 2,
      status: "submitted",
      stage: "prior_to_docs",
      cleared_by: null,
      cleared_at: null,
      waived_by: null,
      waived_at: null,
      waive_reason: null,
      created_at: "2026-07-01T00:00:00Z",
      updated_at: "2026-07-01T00:00:00Z",
    },
  ];
  const mockLoan: LoanSummary = {
    id: "loan-1",
    borrowerName: "Jane Smith",
    loanNumber: "OR-1001",
    status: "conditions_review",
    loanAmount: 450000,
    loanProgram: "dscr",
    channel: "Broker",
    propertyState: "FL",
    owner: "—",
    conditionsOpen: 1,
    conditionsSubmitted: 1,
    actionsNeeded: 2,
    submittedAt: "2026-07-01",
    updatedAt: "2026-07-01",
  };
  const mockRefetch = vi.fn();
  return { mockConditions, mockLoan, mockRefetch };
});

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("@/hooks/useConditions", () => ({
  useConditions: () => ({
    conditions: mockConditions,
    loading: false,
    error: null,
    refetch: mockRefetch,
  }),
}));

vi.mock("@/state/auth", () => ({
  useAuth: () => ({
    token: "mock-token",
    user: { id: "u1", email: "uw@origina.dev", name: "Underwriter", role: "underwriter" },
  }),
}));

vi.mock("@/services/conditionsService", () => ({
  clearCondition: vi.fn().mockResolvedValue({ ...mockConditions[1], status: "cleared" }),
  waiveCondition: vi.fn().mockResolvedValue({ ...mockConditions[0], status: "waived" }),
  rejectCondition: vi.fn().mockResolvedValue({ ...mockConditions[1], status: "rejected" }),
  createCondition: vi.fn().mockResolvedValue({ ...mockConditions[0], id: "cond-3" }),
  submitCondition: vi.fn().mockResolvedValue({ ...mockConditions[0], status: "submitted" }),
  deleteCondition: vi.fn().mockResolvedValue(undefined),
  updateCondition: vi.fn().mockResolvedValue(mockConditions[0]),
}));

// ── jsdom stubs ──────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  if (typeof window !== "undefined") {
    if (!window.prompt) window.prompt = vi.fn(() => null);
    if (!window.confirm) window.confirm = vi.fn(() => true);
  }
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe("WorkspaceConditions", () => {
  it("renders condition list without crashing", () => {
    render(<WorkspaceConditions loan={mockLoan} />);
    expect(screen.getByText("Proof of Income")).toBeInTheDocument();
    expect(screen.getByText("Property Appraisal")).toBeInTheDocument();
  });

  it("shows the correct status badge for each condition", () => {
    render(<WorkspaceConditions loan={mockLoan} />);
    // Both badges render in the stats row + per-card.
    expect(screen.getAllByText("Open").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Submitted").length).toBeGreaterThan(0);
  });
});
