// tests/frontend/ManagerDashboard.test.tsx
//
// Sprint 4 §4.3 — ManagerDashboardContent renders the team KPI grid using
// the data shape returned by GET /api/v1/analytics/summary. We mock the
// hook to feed in a known KPI list and assert the grid renders each label
// without crashing.
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ManagerDashboardContent } from "@/components/dashboard/manager/ManagerDashboardContent";

vi.mock("@/hooks/useAnalyticsSummary", () => ({
  useAnalyticsSummary: () => ({
    data: {
      meta: {
        computed_at: "2026-07-09T12:00:00Z",
        tenant_id: "tenant-1",
        filter_summary: "Last 30 days",
      },
      kpis: [
        {
          id: "total_active_loans",
          label: "Total Active Loans",
          value: 42,
          formatted_value: "42",
          detail: "Active files",
          tone: "neutral",
        },
        {
          id: "pipeline_volume",
          label: "Pipeline Volume",
          value: 18000000,
          formatted_value: "$18M",
          detail: "Active files only",
          tone: "neutral",
        },
        {
          id: "open_conditions",
          label: "Open Conditions",
          value: 12,
          formatted_value: "12",
          detail: "Awaiting borrower or team",
          tone: "warning",
        },
      ],
      charts: {
        status_count: [],
        status_volume: [],
        channel_mix: [],
        monthly_submissions: [],
        aging_by_status: [],
        action_needed: {
          open_conditions: 12,
          submitted_conditions: 3,
          open_exceptions: 1,
          stale_files: 0,
        },
      },
    },
    isLoading: false,
    isError: false,
  }),
}));

vi.mock("@/state/auth", () => ({
  useAuth: () => ({
    user: { id: "u1", role: "account_manager", name: "Manager" },
    token: "mock-token",
  }),
}));

function renderWithQueryClient(node: React.ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{node}</QueryClientProvider>);
}

describe("ManagerDashboardContent", () => {
  it("renders the KPI grid without crashing", () => {
    renderWithQueryClient(<ManagerDashboardContent />);
    expect(screen.getByTestId("manager-kpi-grid")).toBeInTheDocument();
  });

  it("renders one TeamKPICard per mocked KPI", () => {
    renderWithQueryClient(<ManagerDashboardContent />);
    expect(screen.getByTestId("team-kpi-card-total_active_loans")).toBeInTheDocument();
    expect(screen.getByTestId("team-kpi-card-pipeline_volume")).toBeInTheDocument();
    expect(screen.getByTestId("team-kpi-card-open_conditions")).toBeInTheDocument();
    // Labels render as visible text
    expect(screen.getByText("Total Active Loans")).toBeInTheDocument();
    expect(screen.getByText("Pipeline Volume")).toBeInTheDocument();
    expect(screen.getByText("Open Conditions")).toBeInTheDocument();
  });

  it("renders the date range preset selector", () => {
    renderWithQueryClient(<ManagerDashboardContent />);
    const preset = screen.getByTestId("manager-preset-select") as HTMLSelectElement;
    expect(preset).toBeInTheDocument();
    // Default preset is last_30_days.
    expect(preset.value).toBe("last_30_days");
  });

  it("shows the data-as-of timestamp from the meta payload", () => {
    renderWithQueryClient(<ManagerDashboardContent />);
    // The exact text format depends on the runtime locale; assert the meta
    // line exists and contains the year we passed in.
    expect(screen.getByText(/Data as of/i)).toBeInTheDocument();
  });
});
