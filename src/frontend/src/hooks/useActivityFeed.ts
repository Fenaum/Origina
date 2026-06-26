import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/services/apiClient";
import { useAuth } from "@/state/auth";
import type { ActivityEventOut } from "@/types/api";

export function useActivityFeed(loanId: string) {
  const { token } = useAuth();
  const [events, setEvents] = useState<ActivityEventOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiRequest<ActivityEventOut[]>(
        `/loans/${loanId}/activity`,
        { token },
      );
      setEvents(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load activity");
    }
  }, [loanId, token]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const postNote = useCallback(async (body: string): Promise<void> => {
    if (!token || !body.trim()) return;
    await apiRequest<ActivityEventOut>(`/loans/${loanId}/notes`, {
      method: "POST",
      token,
      body: JSON.stringify({ body: body.trim() }),
    });
    await load();
  }, [loanId, token, load]);

  return {
    events,
    loading: events === null && !error,
    error,
    reload: load,
    postNote,
  };
}
