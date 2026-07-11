// tests/frontend/BugRegressions.test.tsx
//
// Sprint 6.0.4 — named regression tests for the three logged bugs from
// BUILD_HISTORY.md that previously only had manual coverage:
//
//   BUG-2026-07-09-001 — ProtectedRoute redirect loop for it_admin
//   BUG-2026-07-09-002 — Activity-rail composer placeholder garbled Unicode
//   BUG-2026-07-09-003 — Pre-File Exceptions envelope unwrap
//
// The TESTING.md §9 gate says "every bug gets a named regression test" —
// these three are the ones Sprint 6 closes that gap for. If any of them
// break, the B-gate fails and the bug is officially back.
//
// Each test exercises the smallest possible real surface: ProtectedRoute
// renders children, the placeholder string contains only ASCII, and the
// exceptions page parses `{items, total}` not a bare array.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { RouterContext } from "next/dist/shared/lib/router-context.shared-runtime.js";
import { useEffect } from "react";

// ── BUG-2026-07-09-001 — ProtectedRoute redirect loop ────────────────────────
//
// Symptom: an `it_admin` user landing on a role-guarded page that they
// don't own used to render "Redirecting…" indefinitely because the
// redirect target was the same page they were denied on, and the
// `router.replace` would fire again immediately. The fix:
//   1. ADMIN_ROLES = ["it_admin", "admin"] — admins pass every guard
//   2. Bail out when `target === router.pathname`
//
// Regression coverage: mount <ProtectedRoute allowedRoles={["loan_officer"]}>
// with an it_admin user and prove the children render — not "Redirecting…".
describe("BUG-2026-07-09-001 — ProtectedRoute it_admin no longer loops", () => {
  beforeEach(() => {
    // Mock the auth hook at the module level — vitest hoists vi.mock
    // calls but our source uses a context provider, so we mock it
    // through the consume side instead. We import the actual hook below.
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renders the children for an it_admin on a role-guarded page", async () => {
    // Mock useAuth so we don't need a real AuthProvider.
    vi.doMock("@/state/auth", () => ({
      useAuth: () => ({
        user: {
          id: "u1",
          email: "admin@origina.dev",
          fullName: "Admin User",
          role: "it_admin",
          effectiveRole: "it_admin",
        },
        token: "fake-token",
        isAuthenticated: true,
        isLoading: false,
        effectiveRole: "it_admin",
        isPreviewMode: false,
        setPreviewRole: () => {},
        clearPreviewRole: () => {},
        login: async () => {},
        logout: () => {},
      }),
    }));

    const { ProtectedRoute } = await import("@/components/app/ProtectedRoute");

    const fakeRouter: any = {
      push: vi.fn(),
      replace: vi.fn(),
      reload: vi.fn(),
      back: vi.fn(),
      prefetch: vi.fn(),
      beforePopState: vi.fn(),
      events: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
      isFallback: false,
      isLocaleDomain: false,
      isReady: true,
      defaultLocale: "en",
      domainLocales: [],
      locale: "en",
      locales: ["en"],
      asPath: "/dashboard/loan-officer",
      basePath: "",
      pathname: "/dashboard/loan-officer",
      route: "/dashboard/loan-officer",
      query: {},
      forward: vi.fn(),
      rewrite: vi.fn(),
    };

    render(
      <RouterContext.Provider value={fakeRouter}>
        <ProtectedRoute allowedRoles={["loan_officer"]}>
          <div data-testid="protected-child">SECRET DASHBOARD</div>
        </ProtectedRoute>
      </RouterContext.Provider>,
    );

    // If the bug regressed, this would render "Redirecting…" forever.
    expect(screen.getByTestId("protected-child")).toBeInTheDocument();
    expect(screen.queryByText(/Redirecting/i)).not.toBeInTheDocument();
    // The router.replace should NOT have been called — admin is allowed.
    expect(fakeRouter.replace).not.toHaveBeenCalled();
  });
});


// ── BUG-2026-07-09-002 — composer placeholder must be ASCII ────────────────
//
// The fix replaced the Unicode characters ⌘↵ with the literal text
// "Cmd+Enter". The replacement must remain ASCII so no font fallback can
// garble the placeholder again.
describe("BUG-2026-07-09-002 — WorkspaceConversation composer placeholder", () => {
  it("uses only ASCII characters in the placeholder", async () => {
    // Pull the placeholder string out of the component without instantiating
    // the full composer (which would require loan + auth +30+ service imports).
    // The fix lives in a single string literal in
    // `src/components/loans/workspace/WorkspaceConversation.tsx`; this test
    // guards that string against accidental re-introduction of Unicode.
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(
      "src/components/loans/workspace/WorkspaceConversation.tsx",
      "utf8",
    );
    const match = source.match(/placeholder=\{`([^`]+)`\}/);
    expect(match).not.toBeNull();
    const placeholder = match![1];
    // ASCII only — code points 0x00..0x7F. If anyone re-introduces ⌘
    // (U+2318) or ↵ (U+21B5) or … (U+2026), this fails.
    for (const ch of placeholder) {
      expect(ch.codePointAt(0)!).toBeLessThan(0x80);
    }
    // Be deliberate: the canonical text says "Cmd+Enter".
    expect(placeholder).toContain("Cmd+Enter");
    expect(placeholder).not.toContain("\u2318"); // ⌘
    expect(placeholder).not.toContain("\u21B5"); // ↵
  });
});


// ── BUG-2026-07-09-003 — exceptions envelope unwrap ────────────────────────
//
// The Pre-File Exceptions page previously crashed with
// `exceptions is not iterable` because the backend returned a paginated
// envelope `{items, total}` and the frontend read it as a bare array.
// The fix parses `res.json()` as `PaginatedResponse<ExceptionOut>` and
// assigns `.items ?? []`.
//
// Regression coverage: assert the live page module reads `.items ?? []`,
// not `.json()` directly. We do this by reading the module source and
// confirming the unwrap pattern is present.
describe("BUG-2026-07-09-003 — exceptions envelope unwrap", () => {
  it("reads .items ?? [] from the paginated envelope, not the bare array", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync("src/pages/exceptions/index.tsx", "utf8");
    // The fix is on the line that parses the listing endpoint response.
    // We assert (a) the envelope is bound to a variable called `envelope`
    // (or similar) and (b) the array passed to setState is `.items ?? []`.
    expect(source).toMatch(/envelope\s*\.\s*items\s*\?\?\s*\[\]/);
    // Sanity: the variable assignment that picks the body should mention
    // PaginatedResponse<ExceptionOut> (the type alias is the contract).
    expect(source).toMatch(/PaginatedResponse<ExceptionOut>/);
  });
});
