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
  // Legacy aliases — re-route to the same dashboards
  admin:            "/dashboard/account-executive",
  account_executive: "/dashboard/account-executive",
  broker:           "/dashboard/broker",
  processor:        "/dashboard/processor",
  manager:          "/dashboard/manager",
  funder:           "/dashboard/funder",
  borrower:         "/dashboard/borrower",
};


// Roles available for the demo / preview switcher (kept stable for UX).
export const PREVIEW_ROLES: UserRole[] = [
  "loan_officer",
  "loan_processor",
  "underwriter",
  "account_manager",
  "it_admin",
  "broker",
  "processor",
  "manager",
  "funder",
  "borrower",
];
