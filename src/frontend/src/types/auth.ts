export type UserRole =
  | "admin"
  | "account_executive"
  | "broker"
  | "processor"
  | "underwriter"
  | "funder"
  | "manager"
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
  admin: "Admin",
  account_executive: "Account Executive",
  broker: "Broker / Seller",
  processor: "Processor",
  underwriter: "Underwriter",
  funder: "Funder",
  manager: "Manager",
  borrower: "Borrower",
};

export const roleDashboardPaths: Record<UserRole, string> = {
  admin: "/dashboard/account-executive",
  account_executive: "/dashboard/account-executive",
  broker: "/dashboard/broker",
  processor: "/dashboard/processor",
  underwriter: "/dashboard/underwriter",
  funder: "/dashboard/funder",
  manager: "/dashboard/manager",
  borrower: "/dashboard/borrower",
};

export const PREVIEW_ROLES: UserRole[] = [
  "account_executive",
  "broker",
  "processor",
  "underwriter",
  "funder",
  "manager",
  "borrower",
];
