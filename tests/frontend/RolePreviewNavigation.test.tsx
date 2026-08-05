import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { SessionUser, UserRole } from "@/types/auth";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  auth: {} as {
    user: SessionUser;
    effectiveRole: UserRole;
    isPreviewMode: boolean;
    isAuthenticated: boolean;
    isLoading: boolean;
  },
}));

vi.mock("next/router", () => ({
  useRouter: () => ({ pathname: "/dashboard/manager", query: {}, replace: mocks.replace }),
}));

vi.mock("@/state/auth", () => ({
  useAuth: () => mocks.auth,
}));

vi.mock("@/state/recentLoansStore", () => ({
  useRecentLoansStore: () => [],
}));

vi.mock("@/components/brand/OriginaLogo", () => ({
  OriginaLogo: ({ href }: { href: string }) => <a href={href}>Origina</a>,
}));

import { ProtectedRoute } from "@/components/app/ProtectedRoute";
import { Sidebar } from "@/components/app/Sidebar";

const adminUser: SessionUser = {
  id: "admin-1",
  name: "Origina Admin",
  email: "admin@origina.dev",
  role: "it_admin",
  tenantName: "Origina Dev",
};

describe("role-preview navigation", () => {
  beforeEach(() => {
    mocks.auth = {
      user: adminUser,
      effectiveRole: "underwriter",
      isPreviewMode: true,
      isAuthenticated: true,
      isLoading: false,
    };
    mocks.replace.mockClear();
  });

  it("filters the admin sidebar to the selected role's experience", () => {
    render(<Sidebar />);

    expect(screen.getByRole("link", { name: "Underwriting Queue" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/dashboard/underwriter");
    expect(screen.queryByRole("link", { name: "New Submission" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Exceptions" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Admin" })).not.toBeInTheDocument();
    expect(screen.getByText("Underwriter", { selector: ".sidebar-footer strong" })).toBeInTheDocument();
  });

  it("applies the preview role to UI route guards instead of the admin bypass", async () => {
    render(
      <ProtectedRoute allowedRoles={["manager"]}>
        <div>Manager-only content</div>
      </ProtectedRoute>,
    );

    expect(screen.queryByText("Manager-only content")).not.toBeInTheDocument();
    expect(screen.getByText("Redirecting...")).toBeInTheDocument();
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/dashboard/underwriter"));
  });

  it.each(["loan_officer", "loan_processor", "underwriter", "account_manager"] as UserRole[])(
    "allows canonical %s previews to open the loan pipeline",
    (effectiveRole) => {
      mocks.auth.effectiveRole = effectiveRole;

      render(
        <ProtectedRoute
          allowedRoles={[
            "loan_officer",
            "broker",
            "loan_processor",
            "processor",
            "underwriter",
            "account_manager",
            "manager",
            "funder",
          ]}
        >
          <div>Loan pipeline</div>
        </ProtectedRoute>,
      );

      expect(screen.getByText("Loan pipeline")).toBeInTheDocument();
      expect(mocks.replace).not.toHaveBeenCalled();
    },
  );
});
