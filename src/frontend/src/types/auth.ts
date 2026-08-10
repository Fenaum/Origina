/**
 * Frontend role vocabulary.
 *
 * Sprint 2 reconciliation: the backend is canonical. The five backend roles
 * (from the `roles` table) are the primary keys. Legacy / display-role aliases
 * (broker, processor, manager, funder, account_executive, admin) are kept in
 * the union for compile-time back-compat with the dozens of existing pages
 * — but new code should prefer the canonical names.
 *
 * `borrower` is the only standalone frontend-only pseudo-role (used by the
 * unauthenticated intake flow at `/borrower/welcome`). It is not stored in
 * the backend `roles` table.
 */
export type UserRole =
  // ── Backend-canonical (Sprint 2+) ─────────────────────────────────────
  | "loan_officer"
  | "loan_processor"
  | "underwriter"
  | "account_manager"
  | "it_admin"
  | "capital_markets"
  // ── Legacy aliases kept for back-compat with existing pages ───────────
  | "admin"
  | "account_executive"
  | "broker"
  | "processor"
  | "manager"
  | "funder"
  // ── Frontend-only pseudo-role ─────────────────────────────────────────
  | "borrower";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  tenantName: string;
};

export type SessionState = {
  user: SessionUser | null;
  isAuthenticated: boolean;
};

export const roleLabels: Record<UserRole, string> = {
  // Backend-canonical
  loan_officer:     "Loan Officer",
  loan_processor:   "Loan Processor",
  underwriter:      "Underwriter",
  account_manager:  "Account Manager",
  it_admin:         "IT Admin",
  capital_markets:  "Capital Markets",
  // Legacy aliases
  admin:            "Admin",
  account_executive: "Account Executive",
  broker:           "Broker / Seller",
  processor:        "Processor",
  manager:          "Manager",
  funder:           "Funder",
  // Frontend pseudo-role
  borrower:         "Borrower",
};

export const roleDashboardPaths: Record<UserRole, string> = {
  // Backend-canonical — points at existing dashboard pages (loan-officer and
  // account-manager page files are not in the tree yet, so we reuse their
  // legacy siblings `broker` and `manager` until those are built). Adding
  // dedicated pages later is a one-liner.
  loan_officer:     "/dashboard/broker",
  loan_processor:   "/dashboard/processor",
  underwriter:      "/dashboard/underwriter",
  account_manager:  "/dashboard/manager",
  it_admin:         "/dashboard/account-executive",
  // Sprint 7 — CM PoC: dashboard page lives at /dashboard/capital-markets
  // (the CM Cockpit — see Milestone 3 B10 + docs/CAPITAL_MARKETS_WORKSPACE_
  // ARCHITECTURE.md §6.1).
  capital_markets:  "/dashboard/capital-markets",
  // Legacy aliases — re-route to the same dashboards
  admin:            "/dashboard/account-executive",
  account_executive: "/dashboard/account-executive",
  broker:           "/dashboard/broker",
  processor:        "/dashboard/processor",
  manager:          "/dashboard/manager",
  funder:           "/dashboard/funder",
  borrower:         "/dashboard/borrower",
};


/** Backend roles that may use the UI-only role preview controls. */
export const ADMIN_ROLES: readonly UserRole[] = ["it_admin", "admin"];

export function isAdminRole(role: UserRole | null | undefined): boolean {
  return role !== null && role !== undefined && ADMIN_ROLES.includes(role);
}

// Roles available for the demo / preview switcher. Legacy roles remain here
// because they still have distinct workspaces that are useful during UX review.
export const PREVIEW_ROLES: readonly UserRole[] = [
  "loan_officer",
  "loan_processor",
  "underwriter",
  "account_manager",
  "broker",
  "processor",
  "manager",
  "funder",
  "borrower",
];

export function isPreviewRole(role: string | null): role is UserRole {
  return role !== null && PREVIEW_ROLES.some((previewRole) => previewRole === role);
}

/** Roles that can open the shared loan pipeline and loan workspaces. */
export const LOAN_TEAM_ROLES: readonly UserRole[] = [
  "loan_officer",
  "broker",
  "loan_processor",
  "processor",
  "underwriter",
  "account_manager",
  "manager",
  "funder",
];
