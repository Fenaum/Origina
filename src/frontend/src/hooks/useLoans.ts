import { useEffect, useState } from "react";
import { getLoanById, listLoans } from "@/services/loanService";
import { useAuth } from "@/state/auth";
import type { LoanSummary } from "@/types/loan";

// Derive loading from data being null (never fetched) vs empty array (fetched, no results).
export function useLoans() {
  const { token } = useAuth();
  const [loans, setLoans] = useState<LoanSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listLoans(token ?? undefined)
      .then((data) => { if (!cancelled) setLoans(data); })
      .catch((err) => { if (!cancelled) setError(String(err?.message ?? err)); });
    return () => { cancelled = true; };
  }, [token]);

  return {
    loans: loans ?? [],
    loading: loans === null && error === null,
    error,
  };
}

export function useLoan(loanId: string | undefined) {
  const { token } = useAuth();
  // undefined = not yet fetched, null = fetched but not found
  const [loan, setLoan] = useState<LoanSummary | null | undefined>(
    loanId === undefined ? null : undefined
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loanId) return;
    let cancelled = false;
    getLoanById(loanId, token ?? undefined)
      .then((data) => { if (!cancelled) setLoan(data); })
      .catch((err) => { if (!cancelled) setError(String(err?.message ?? err)); });
    return () => { cancelled = true; };
  }, [loanId, token]);

  return {
    loan: loan ?? null,
    loading: loan === undefined,
    error,
  };
}
