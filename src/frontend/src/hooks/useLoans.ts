import { useEffect, useState } from "react";
import { getLoanById, listLoans } from "@/services/loanService";
import { useAuth } from "@/state/auth";
import type { LoanSummary } from "@/types/loan";

/**
 * Paginated pipeline loader.
 *
 * `useLoans(page, pageSize)` re-fetches whenever the page (1-indexed) or
 * page size changes. The returned `total` reflects the server-side row count
 * across all pages so the grid can render Next / Prev controls without a
 * second request.
 */
export function useLoans(page = 1, pageSize = 50) {
  const { token } = useAuth();
  const [loans, setLoans] = useState<LoanSummary[] | null>(null);
  const [total, setTotal] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const skip = (page - 1) * pageSize;
    listLoans(token ?? undefined, { skip, limit: pageSize })
      .then((data) => {
        if (!cancelled) {
          setLoans(data.loans);
          setTotal(data.total);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(String(err?.message ?? err));
      });
    return () => {
      cancelled = true;
    };
  }, [token, page, pageSize]);

  return {
    loans: loans ?? [],
    total,
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