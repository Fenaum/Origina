/**
 * Settings service — swap point for real API calls.
 * Currently wires directly to apiClient.ts. Replace internals when ready.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/services/apiClient";
import type {
  AuditLogResponse,
  TenantSettingsOut,
  UserMeOut,
  UserSessionOut,
} from "@/types/api";

// ── User / profile ──────────────────────────────────────────────────────────────

export function useUserMe() {
  return useQuery<UserMeOut>({
    queryKey: ["user-me"],
    queryFn: () => apiRequest<UserMeOut>("/users/me"),
  });
}

export function useUpdateUserMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<UserMeOut>) =>
      apiRequest<UserMeOut>("/users/me", { method: "PATCH", body: JSON.stringify(payload) }),
    onSuccess: (data) => {
      qc.setQueryData(["user-me"], data);
    },
  });
}

export function useUpdateUserPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiRequest<UserMeOut>("/users/me/preferences", { method: "PATCH", body: JSON.stringify(payload) }),
    onSuccess: (data) => {
      qc.setQueryData(["user-me"], data);
    },
  });
}

export function useUpdateUserNotifications() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiRequest<UserMeOut>("/users/me/notifications", { method: "PATCH", body: JSON.stringify(payload) }),
    onSuccess: (data) => {
      qc.setQueryData(["user-me"], data);
    },
  });
}

// ── Password ────────────────────────────────────────────────────────────────────

export function useChangePassword() {
  return useMutation({
    mutationFn: (payload: { current_password: string; new_password: string }) =>
      apiRequest<{ message: string }>("/users/me/password", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  });
}

// ── Sessions ────────────────────────────────────────────────────────────────────

export function useUserSessions() {
  return useQuery<UserSessionOut[]>({
    queryKey: ["user-sessions"],
    queryFn: () => apiRequest<UserSessionOut[]>("/users/me/sessions"),
  });
}

export function useRevokeSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) =>
      apiRequest<{ message: string }>(`/users/me/sessions/${sessionId}/revoke`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-sessions"] });
    },
  });
}

export function useRevokeAllSessions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiRequest<{ message: string }>("/users/me/sessions/revoke-all", { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-sessions"] });
    },
  });
}

// ── Organization ────────────────────────────────────────────────────────────────

export function useOrganization() {
  return useQuery<TenantSettingsOut>({
    queryKey: ["organization"],
    queryFn: () => apiRequest<TenantSettingsOut>("/admin/organization"),
  });
}

export function useUpdateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<TenantSettingsOut>) =>
      apiRequest<TenantSettingsOut>("/admin/organization", {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: (data) => {
      qc.setQueryData(["organization"], data);
    },
  });
}

// ── Audit log ────────────────────────────────────────────────────────────────────

export function useAuditLog(params?: {
  table_name?: string;
  actor_id?: string;
  entity_id?: string;
  days?: number;
  skip?: number;
  limit?: number;
}) {
  const qs = new URLSearchParams();
  if (params?.table_name) qs.set("table_name", params.table_name);
  if (params?.actor_id) qs.set("actor_id", params.actor_id);
  if (params?.entity_id) qs.set("entity_id", params.entity_id);
  if (params?.days !== undefined) qs.set("days", String(params.days));
  if (params?.skip !== undefined) qs.set("skip", String(params.skip));
  if (params?.limit !== undefined) qs.set("limit", String(params.limit));
  const query = qs.toString();

  return useQuery<AuditLogResponse>({
    queryKey: ["audit-log", params],
    queryFn: () => apiRequest<AuditLogResponse>(`/admin/audit-log${query ? `?${query}` : ""}`),
  });
}
