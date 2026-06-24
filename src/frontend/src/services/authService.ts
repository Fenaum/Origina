import { apiRequest } from "@/services/apiClient";
import type { TokenResponse, UserOut } from "@/types/api";
import type { SessionUser, UserRole } from "@/types/auth";

// Maps backend role names (from the roles table) to frontend UserRole values.
const BACKEND_ROLE_MAP: Record<string, UserRole> = {
  admin: "admin",
  it_admin: "admin",
  account_manager: "account_executive",
  account_executive: "account_executive",
  loan_officer: "broker",
  broker: "broker",
  loan_processor: "processor",
  processor: "processor",
  underwriter: "underwriter",
  funder: "funder",
  manager: "manager",
  borrower: "borrower",
};

function resolveRole(roles: string[]): UserRole {
  for (const r of roles) {
    const mapped = BACKEND_ROLE_MAP[r];
    if (mapped) return mapped;
  }
  return "account_executive";
}

function toSessionUser(out: UserOut): SessionUser {
  return {
    id: out.id,
    name: out.full_name ?? out.email,
    email: out.email,
    role: resolveRole(out.roles ?? []),
    tenantName: "Origina",
  };
}

export async function loginWithCredentials(
  email: string,
  password: string,
): Promise<{ access_token: string; user: SessionUser }> {
  const body = new URLSearchParams({ username: email, password });
  const tokenData = await apiRequest<TokenResponse>("/auth/login", {
    method: "POST",
    body: body.toString(),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  const profile = await fetchCurrentUser(tokenData.access_token);
  return { access_token: tokenData.access_token, user: profile };
}

export async function fetchCurrentUser(token: string): Promise<SessionUser> {
  const out = await apiRequest<UserOut>("/auth/me", { token });
  return toSessionUser(out);
}
