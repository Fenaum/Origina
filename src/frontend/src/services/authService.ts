import type { SessionUser, UserRole } from "@/types/auth";

const mockUsers: Record<UserRole, SessionUser> = {
  account_executive: {
    id: "user-ae",
    name: "Alex Morgan",
    email: "alex.morgan@origina.local",
    role: "account_executive",
    tenantName: "Origina Capital",
  },
  broker: {
    id: "user-broker",
    name: "Blair Chen",
    email: "blair.chen@partner.local",
    role: "broker",
    tenantName: "Northline Lending",
  },
  underwriter: {
    id: "user-uw",
    name: "Uma Patel",
    email: "uma.patel@origina.local",
    role: "underwriter",
    tenantName: "Origina Capital",
  },
  borrower: {
    id: "user-borrower",
    name: "Elena Park",
    email: "elena.park@example.com",
    role: "borrower",
    tenantName: "Borrower Portal",
  },
};

export function getMockUser(role: UserRole): SessionUser {
  return mockUsers[role];
}
