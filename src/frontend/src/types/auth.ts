export type UserRole =
  | "account_executive"
  | "broker"
  | "underwriter"
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
  account_executive: "Account Executive",
  broker: "Broker",
  underwriter: "Underwriter",
  borrower: "Borrower",
};

export const roleDashboardPaths: Record<UserRole, string> = {
  account_executive: "/dashboard/account-executive",
  broker: "/dashboard/broker",
  underwriter: "/dashboard/underwriter",
  borrower: "/dashboard/borrower",
};
