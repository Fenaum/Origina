import { useEffect, useState } from "react";
import { apiRequest } from "@/services/apiClient";
import { useAuth } from "@/state/auth";
import type { BorrowerOut, LoanFinancialsOut, LoanOut, LoanTermsOut, PropertyOut } from "@/types/api";

export type LoanDetail = {
  loan: LoanOut | null;
  borrowers: BorrowerOut[];
  financials: LoanFinancialsOut | null;
  terms: LoanTermsOut | null;
  property: PropertyOut | null;
};

export function useLoanDetail(loanId: string | undefined) {
  const { token } = useAuth();
  const [detail, setDetail] = useState<LoanDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loanId || !token) return;
    let cancelled = false;

    Promise.all([
      apiRequest<LoanOut>(`/loans/${loanId}`, { token }).catch(() => null),
      apiRequest<BorrowerOut[]>(`/borrowers/?loan_id=${loanId}`, { token }),
      apiRequest<LoanFinancialsOut>(`/loans/${loanId}/financials`, { token }).catch(() => null),
      apiRequest<LoanTermsOut>(`/loans/${loanId}/terms`, { token }).catch(() => null),
      apiRequest<PropertyOut[]>(`/properties/?loan_id=${loanId}`, { token }).catch(() => null),
    ])
      .then(([loan, borrowers, financials, terms, properties]) => {
        if (!cancelled) {
          const property = properties?.find((p) => p.is_subject) ?? properties?.[0] ?? null;
          setDetail({ loan, borrowers, financials, terms, property });
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });

    return () => { cancelled = true; };
  }, [loanId, token]);

  return {
    detail: detail ?? ((!loanId || !token) ? { loan: null, borrowers: [], financials: null, terms: null, property: null } : null),
    loading: !!(loanId && token && detail === null && error === null),
    error,
  };
}
