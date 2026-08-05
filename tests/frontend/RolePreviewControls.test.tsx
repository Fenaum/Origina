import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { SessionUser, UserRole } from "@/types/auth";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  setPreviewRole: vi.fn(),
  clearPreviewRole: vi.fn(),
  logout: vi.fn(),
  auth: {} as {
    user: SessionUser | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    effectiveRole: UserRole | null;
    isPreviewMode: boolean;
    setPreviewRole: (role: UserRole) => void;
    clearPreviewRole: () => void;
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
  },
}));

vi.mock("next/router", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("@/state/auth", () => ({
  useAuth: () => mocks.auth,
}));

vi.mock("@/state/theme", () => ({
  useTheme: () => ({ preference: "system", resolvedTheme: "light", cycle: vi.fn() }),
}));

vi.mock("@/components/app/NotificationBell", () => ({
  NotificationBell: () => <div data-testid="notification-bell" />,
}));

import { TopHeader } from "@/components/app/TopHeader";

const adminUser: SessionUser = {
  id: "admin-1",
  name: "Origina Admin",
  email: "admin@origina.dev",
  role: "it_admin",
  tenantName: "Origina Dev",
};

function setAuth(overrides: Partial<typeof mocks.auth> = {}) {
  mocks.auth = {
    user: adminUser,
    token: "test-token",
    isAuthenticated: true,
    isLoading: false,
    effectiveRole: "it_admin",
    isPreviewMode: false,
    setPreviewRole: mocks.setPreviewRole,
    clearPreviewRole: mocks.clearPreviewRole,
    login: vi.fn(),
    logout: mocks.logout,
    ...overrides,
  };
}

describe("admin role preview controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAuth();
  });

  it("exposes role preview to the canonical it_admin role and routes to the selected workspace", () => {
    render(<TopHeader />);

    fireEvent.click(screen.getByRole("button", { name: "Preview Role" }));
    expect(screen.getByRole("listbox", { name: "Preview as role" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("option", { name: "Loan Processor" }));
    expect(mocks.setPreviewRole).toHaveBeenCalledWith("loan_processor");
    expect(mocks.push).toHaveBeenCalledWith("/dashboard/processor");
  });

  it("shows a persistent preview warning and returns to the real admin workspace", () => {
    setAuth({ effectiveRole: "underwriter", isPreviewMode: true });
    render(<TopHeader />);

    expect(screen.getByRole("alert")).toHaveTextContent("Viewing as Underwriter");
    fireEvent.click(screen.getByRole("button", { name: "Return to Admin View" }));

    expect(mocks.clearPreviewRole).toHaveBeenCalledOnce();
    expect(mocks.push).toHaveBeenCalledWith("/dashboard/account-executive");
  });

  it("does not expose role preview to a non-admin", () => {
    setAuth({
      user: { ...adminUser, role: "loan_officer" },
      effectiveRole: "loan_officer",
    });
    render(<TopHeader />);

    expect(screen.queryByRole("button", { name: "Preview Role" })).not.toBeInTheDocument();
  });
});
