import { apiRequest } from "@/services/apiClient";
import type { TokenResponse, UserOut } from "@/types/api";
import type { SessionUser, UserRole } from "@/types/auth";

/**
 * Maps backend role names (from the roles table) onto the canonical frontend
 * UserRole vocabulary. Backend is the source of truth — these maps translate
 * at the API boundary so backend role renames don't cascade through the
 * front-end.
 */
const BACKEND_TO_FRONTEND_ROLE: Record<string, UserRole> = {
  // Backend-canonical → frontend-canonical
  loan_officer:    "loan_officer",
  loan_processor:  "loan_processor",
  underwriter:     "underwriter",
  account_manager: "account_manager",
  it_admin:        "it_admin",
  // Legacy aliases (kept for back-compat with anything still using the old names)
  admin:              "it_admin",
  account_executive:  "account_manager",  // legacy "AE" → modern "account_manager"
  broker:             "loan_officer",     // legacy "broker" → modern "loan_officer"
  processor:          "loan_processor",
  manager:            "account_manager",
  funder:             "account_manager",
  // borrower is never issued by the backend — kept only for shape safety
  borrower:        "borrower",
};

function resolveRole(roles: string[]): UserRole {
  for (const r of roles) {
    const mapped = BACKEND_TO_FRONTEND_ROLE[r];
    if (mapped) return mapped;
  }
  // No recognized role — fall back to a safe default rather than crash.
  return "loan_officer";
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
  // `/auth/me` is the canonical hydration endpoint.
  // `/users/me` (handled by users_me router) and `/users/me` (handled by
  // users router) both work too — they all return UserOut-shaped data.
  const out = await apiRequest<UserOut>("/auth/me", { token });
  return toSessionUser(out);
}
