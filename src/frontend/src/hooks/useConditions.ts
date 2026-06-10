import { useCallback, useEffect, useRef, useState } from "react";
import { listConditions } from "@/services/conditionsService";
import { useAuth } from "@/state/auth";
import type { ConditionOut } from "@/types/api";

export function useConditions(loanId: string | undefined) {
  const { token } = useAuth();
  const [conditions, setConditions] = useState<ConditionOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refetchRef = useRef(0);

  useEffect(() => {
    if (!loanId || !token) return;
    let cancelled = false;
    listConditions(loanId, token)
      .then((data) => { if (!cancelled) setConditions(data); })
      .catch((err: Error) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  // refetchRef.current is intentionally included so callers can trigger a re-fetch
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loanId, token, refetchRef.current]);

  const refetch = useCallback(() => {
    setConditions(null);
    setError(null);
    refetchRef.current += 1;
  }, []);

  return {
    conditions: conditions ?? [],
    loading: conditions === null && error === null,
    error,
    refetch,
  };
}
