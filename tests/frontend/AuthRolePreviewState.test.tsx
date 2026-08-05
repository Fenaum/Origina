import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { SessionUser } from "@/types/auth";

const mocks = vi.hoisted(() => ({
  fetchCurrentUser: vi.fn(),
  loginWithCredentials: vi.fn(),
  replace: vi.fn(),
  setAuthToken: vi.fn(),
  setUnauthorizedHandler: vi.fn(),
}));

vi.mock("next/router", () => ({
  useRouter: () => ({ pathname: "/dashboard", asPath: "/dashboard", replace: mocks.replace }),
}));

vi.mock("@/services/authService", () => ({
  fetchCurrentUser: mocks.fetchCurrentUser,
  loginWithCredentials: mocks.loginWithCredentials,
}));

vi.mock("@/services/apiClient", () => ({
  setAuthToken: mocks.setAuthToken,
  setUnauthorizedHandler: mocks.setUnauthorizedHandler,
}));

import { AuthProvider, useAuth } from "@/state/auth";

const itAdmin: SessionUser = {
  id: "admin-1",
  name: "Origina Admin",
  email: "admin@origina.dev",
  role: "it_admin",
  tenantName: "Origina Dev",
};

function AuthProbe() {
  const { effectiveRole, isPreviewMode, setPreviewRole, clearPreviewRole } = useAuth();
  return (
    <div>
      <span data-testid="effective-role">{effectiveRole ?? "none"}</span>
      <span data-testid="preview-mode">{String(isPreviewMode)}</span>
      <button type="button" onClick={() => setPreviewRole("underwriter")}>Preview underwriter</button>
      <button type="button" onClick={clearPreviewRole}>Clear preview</button>
    </div>
  );
}

describe("AuthProvider role preview state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("restores, updates, and clears an it_admin preview role in localStorage", async () => {
    window.localStorage.setItem("origina.token", "test-token");
    window.localStorage.setItem("origina.preview_role", "loan_processor");
    mocks.fetchCurrentUser.mockResolvedValue(itAdmin);

    render(<AuthProvider><AuthProbe /></AuthProvider>);

    await waitFor(() => expect(screen.getByTestId("effective-role")).toHaveTextContent("loan_processor"));
    expect(screen.getByTestId("preview-mode")).toHaveTextContent("true");

    fireEvent.click(screen.getByRole("button", { name: "Preview underwriter" }));
    expect(screen.getByTestId("effective-role")).toHaveTextContent("underwriter");
    expect(window.localStorage.getItem("origina.preview_role")).toBe("underwriter");

    fireEvent.click(screen.getByRole("button", { name: "Clear preview" }));
    expect(screen.getByTestId("effective-role")).toHaveTextContent("it_admin");
    expect(screen.getByTestId("preview-mode")).toHaveTextContent("false");
    expect(window.localStorage.getItem("origina.preview_role")).toBeNull();
  });

  it("discards a stale admin preview when a non-admin owns the session", async () => {
    window.localStorage.setItem("origina.token", "test-token");
    window.localStorage.setItem("origina.preview_role", "underwriter");
    mocks.fetchCurrentUser.mockResolvedValue({ ...itAdmin, role: "loan_officer" });

    render(<AuthProvider><AuthProbe /></AuthProvider>);

    await waitFor(() => expect(screen.getByTestId("effective-role")).toHaveTextContent("loan_officer"));
    expect(screen.getByTestId("preview-mode")).toHaveTextContent("false");
    expect(window.localStorage.getItem("origina.preview_role")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Preview underwriter" }));
    expect(screen.getByTestId("effective-role")).toHaveTextContent("loan_officer");
    expect(window.localStorage.getItem("origina.preview_role")).toBeNull();
  });
});
