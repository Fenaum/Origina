import { apiRequest } from "@/services/apiClient";
import type { TokenResponse, UserOut } from "@/types/api";
import type { SessionUser, UserRole } from "@/types/auth";

// Maps email prefixes to frontend roles for the dev environment.
// Replace with a real /auth/me-roles endpoint once RBAC is wired to users.
const EMAIL_PREFIX_TO_ROLE: Record<string, UserRole> = {
  admin: "account_executive",
  underwriter: "underwriter",
  processor: "account_executive",
  broker: "broker",
  borrower: "borrower",
};

function deriveRole(email: string): UserRole {
  const prefix = email.split("@")[0].toLowerCase();
  return EMAIL_PREFIX_TO_ROLE[prefix] ?? "account_executive";
}

function toSessionUser(out: UserOut): SessionUser {
  return {
    id: out.id,
    name: out.full_name ?? out.email,
    email: out.email,
    role: deriveRole(out.email),
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
