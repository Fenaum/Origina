import { useEffect, useState } from "react";
import { apiRequest } from "@/services/apiClient";
import { useAuth } from "@/state/auth";

import type {
  BorrowerOut,
  BorrowerSummaryOut,
  LoanDetailOut,
  LoanFinancialsOut,
  LoanOut,
  LoanTermsOut,
  PropertyOut,
  PropertySummaryOut,
} from "@/types/api";

export type LoanDetail = {
  loan: LoanOut | null;
  // Legacy — full borrower rows for consumers (WorkspaceParties,
  // WorkspaceIncome, WorkspaceBorrowerURLA) that haven't migrated to
  // the primary/co-borrower split. WorkspaceHome is the only caller
  // using `primary_borrower` / `co_borrowers` today.
  borrowers: BorrowerOut[];
  financials: LoanFinancialsOut | null;
  terms: LoanTermsOut | null;
  // New in Sprint 6 §6.2 — primary + co-borrowers from the detail
  // endpoint's `primary_borrower` / `co_borrowers` projection.
  primary_borrower: BorrowerSummaryOut | null;
  co_borrowers: BorrowerSummaryOut[];
  // Subject property (the loan's primary property) + other attached
  // properties (typically second homes / rental properties).
  subject_property: PropertySummaryOut | null;
  other_properties: PropertySummaryOut[];
  // Legacy alias — preserves the previous behavior of "first property
  // wins" for any caller that hasn't migrated.
  property: PropertyOut | null;
};

const EMPTY_DETAIL: LoanDetail = {
  loan: null,
  borrowers: [],
  financials: null,
  terms: null,
  primary_borrower: null,
  co_borrowers: [],
  subject_property: null,
  other_properties: [],
  property: null,
};

/**
 * Convert a BorrowerSummaryOut (lightweight projection from the detail
 * endpoint) into a BorrowerOut-shaped record so legacy consumers
 * (WorkspaceParties, WorkspaceIncome, WorkspaceBorrowerURLA) can keep
 * using the full borrower shape until they migrate to the detail-only
 * summary type in Sprint 8.
 */
function summaryToBorrower(summary: BorrowerSummaryOut): BorrowerOut {
  return {
    id: summary.id,
    loan_id: summary.loan_id,
    type: summary.type,
    first_name: summary.first_name,
    last_name: summary.last_name,
    email: summary.email,
    phone: summary.phone,
    ssn_last4: summary.ssn_last4,
    dob: summary.dob,
    borrower_relationship: null,
    income_type: summary.income_type,
    income_amount: summary.income_amount,
    employment_status: null,
    employer_name: summary.employer_name,
    job_title: null,
    years_on_job: null,
    years_in_profession: null,
    work_phone: null,
    marital_status: null,
    dependents: null,
    ethnicity: null,
    race: null,
    gender: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function summaryToProperty(
  summary: PropertySummaryOut,
): PropertyOut {
  // The frontend PropertyOut shape mirrors the slim summary — no
  // tenant_id field. The backend still has it; the detail endpoint
  // strips it for response-size reasons.
  return {
    id: summary.id,
    loan_id: summary.loan_id,
    is_subject: summary.is_subject,
    address1: summary.address1,
    address2: summary.address2,
    city: summary.city,
    state: summary.state,
    postal_code: summary.postal_code,
    property_type: summary.property_type,
    occupancy: summary.occupancy,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function useLoanDetail(loanId: string | undefined) {
  const { token } = useAuth();
  const [detail, setDetail] = useState<LoanDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loanId || !token) return;
    let cancelled = false;

    apiRequest<LoanDetailOut>(`/loans/${loanId}/detail`, { token })
      .then((data) => {
        if (cancelled) return;
        const primaryBorrower = data.primary_borrower ?? null;
        const coBorrowers = data.co_borrowers ?? [];
        const allBorrowers: BorrowerOut[] = primaryBorrower
          ? [summaryToBorrower(primaryBorrower), ...coBorrowers.map(summaryToBorrower)]
          : coBorrowers.map(summaryToBorrower);

        const subjectProperty = data.subject_property ?? null;
        const otherProperties = data.other_properties ?? [];
        // No tenant_id in the frontend PropertyOut shape; the backend
        // strips it from the detail projection to keep the payload
        // small.
        const legacyProperty: PropertyOut | null = subjectProperty
          ? summaryToProperty(subjectProperty)
          : otherProperties.length > 0
            ? summaryToProperty(otherProperties[0])
            : null;

        setDetail({
          loan: data,
          borrowers: allBorrowers,
          financials: data.financials ?? null,
          terms: data.terms ?? null,
          primary_borrower: primaryBorrower,
          co_borrowers: coBorrowers,
          subject_property: subjectProperty,
          other_properties: otherProperties,
          property: legacyProperty,
        });
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });

    return () => { cancelled = true; };
  }, [loanId, token]);

  return {
    detail: detail ?? ((!loanId || !token) ? EMPTY_DETAIL : null),
    loading: !!(loanId && token && detail === null && error === null),
    error,
  };
}
