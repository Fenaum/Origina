/**
 * Submission service — wires the submission flow to the real backend.
 *
 * Phase 1 status:
 *   createLoanDraft  → POST /loans/        (real — creates DB row)
 *   saveLoanDraft    → localStorage only   (TODO Phase 2: PATCH backend fields)
 *   submitLoan       → POST /loans/{id}/submit (real — transitions to submitted)
 *
 * Token strategy (Phase 1):
 *   Reads the JWT from localStorage under the key used by auth.tsx.
 *   This avoids threading `token` through every Zustand store action call site.
 *   Phase 2 TODO: inject token via dependency injection or pass explicitly from
 *   the React component layer.
 *
 * Phase 2 TODO: saveLoanDraft should PATCH /loans/{id}, POST /borrowers/,
 *   PATCH /loans/{id}/financials with the draft field values.
 *
 * Phase 3 TODO: Phase 3 S3 storage requires no changes here — the upload
 *   endpoint URL stays the same; only the backend changes.
 */

import { apiRequest } from "@/services/apiClient";
import { createEmptySubmissionDraft } from "@/data/submissionConfig";
import type { SubmissionDraft, SubmitResult, BorrowerDraft, PropertyDraft } from "@/types/submission";
import type { BorrowerOut, LoanOut, LoanSubmitOut, PropertyOut } from "@/types/api";

const LS_AUTOSAVE_PREFIX = "origina.draftAutosave";
const TOKEN_KEY = "origina.token";

// ── Token helper ──────────────────────────────────────────────────────────────

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

// ── Local autosave (offline / unauthenticated fallback) ───────────────────────

function saveLocally(draft: SubmissionDraft): void {
  if (typeof window === "undefined" || !draft.loanId) return;
  try {
    // SSN is stripped by the Zustand partialize before calling here, but
    // add an extra guard in case this is called with a full draft object.
    const safe = {
      ...draft,
      borrowers: draft.borrowers.map((b) => ({ ...b, ssn: "" })),
    };
    window.localStorage.setItem(`${LS_AUTOSAVE_PREFIX}.${draft.loanId}`, JSON.stringify(safe));
  } catch {
    // Ignore storage quota errors — autosave is best-effort.
  }
}

function loadLocally(loanId: string): SubmissionDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${LS_AUTOSAVE_PREFIX}.${loanId}`);
    return raw ? (JSON.parse(raw) as SubmissionDraft) : null;
  } catch {
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Creates a real loan draft row in the database and returns a SubmissionDraft
 * with the DB-assigned UUID as loanId.
 *
 * Falls back to a local-only draft (draft-{UUID} prefix) when no token is
 * available so the form can still be filled out before login.
 */
export async function createLoanDraft(): Promise<SubmissionDraft> {
  const token = getToken();

  if (!token) {
    // Unauthenticated — create a local-only draft.
    const draft = createEmptySubmissionDraft(`draft-${crypto.randomUUID()}`);
    saveLocally(draft);
    return draft;
  }

  const loan = await apiRequest<LoanOut>("/loans/", {
    method: "POST",
    token,
    body: JSON.stringify({}),
  });

  const draft = createEmptySubmissionDraft(loan.id);
  saveLocally(draft);
  return draft;
}

/**
 * Returns the latest draft for a given loan ID.
 * Phase 1: local autosave is the source of truth for form state.
 * Phase 2 TODO: fetch real field values from GET /loans/{id} + related endpoints.
 */
export async function fetchLoanDraft(loanId: string): Promise<SubmissionDraft> {
  return loadLocally(loanId) ?? createEmptySubmissionDraft(loanId);
}

/**
 * Persists draft form state.
 * Phase 1: saves to localStorage autosave only.
 * Phase 2 TODO: PATCH /loans/{id}, POST /borrowers/, PATCH /loans/{id}/financials.
 */
export async function saveLoanDraft(draft: SubmissionDraft): Promise<SubmissionDraft> {
  const next = { ...draft, isDraft: true };
  saveLocally(next);
  // TODO Phase 2: push field values to backend here.
  return next;
}

/**
 * Submits a loan via POST /loans/{id}/submit.
 *
 * Requires the loan to already exist in the DB (loanId must not start with
 * "draft-"). Falls back to a mock response if unauthenticated or if the
 * loan is still local-only.
 */
export async function submitLoanApplication(draft: SubmissionDraft): Promise<SubmitResult> {
  const token = getToken();
  const { loanId } = draft;
  const primaryBorrower = draft.borrowers.find((borrower) => borrower.type === "primary_borrower");
  const draftBorrowerName = primaryBorrower
    ? [primaryBorrower.firstName, primaryBorrower.lastName].filter(Boolean).join(" ") || null
    : null;

  if (!token || !loanId || loanId.startsWith("draft-")) {
    // Unauthenticated or local-only draft — return a mock result so the
    // form flow can still be demoed without a backend connection.
    return {
      loanId: loanId ?? `loan-${crypto.randomUUID()}`,
      loanNumber: null,
      borrowerName: draftBorrowerName,
      loanAmount: draft.setup.loanAmount,
      productType: draft.setup.product,
      submittedAt: new Date().toISOString(),
      assignedAeName: "Alex Morgan",
    };
  }

  const result = await apiRequest<LoanSubmitOut>(`/loans/${loanId}/submit`, {
    method: "POST",
    token,
  });

  return {
    loanId: result.id,
    loanNumber: result.loan_number,
    borrowerName: result.borrower_name,
    loanAmount: result.loan_amount,
    productType: result.loan_program,
    submittedAt: result.submitted_at,
    assignedAeName: "Alex Morgan", // TODO Phase 2: return AE from backend once assignment is implemented
  };
}

/**
 * Creates a borrower record in the database linked to a loan.
 * SSN is never sent — per security policy, ssn_last4 must be supplied explicitly
 * if needed; raw SSN is never transmitted over the API.
 */
export async function createBorrowerForLoan(
  loanId: string,
  borrower: {
    type: "primary_borrower" | "co_borrower";
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    phone?: string | null;
    dob?: string | null;
  },
): Promise<BorrowerOut | null> {
  const token = getToken();
  if (!token || loanId.startsWith("draft-")) return null;

  return apiRequest<BorrowerOut>("/borrowers/", {
    method: "POST",
    token,
    body: JSON.stringify({ loan_id: loanId, ...borrower }),
  });
}

/**
 * PATCHes header fields on a loan (loan_program, purpose, occupancy_type, etc.).
 * Purpose and program values are now canonical (match DB controlled_values).
 */
export async function patchLoanHeader(
  loanId: string,
  patch: {
    loan_program?: string | null;
    purpose?: string | null;
    occupancy_type?: string | null;
  },
): Promise<void> {
  const token = getToken();
  if (!token || loanId.startsWith("draft-")) return;

  const body: Record<string, string> = {};
  if (patch.loan_program != null) body.loan_program = patch.loan_program;
  if (patch.purpose != null) body.purpose = patch.purpose;
  if (patch.occupancy_type != null) body.occupancy_type = patch.occupancy_type;

  if (Object.keys(body).length === 0) return;

  await apiRequest<LoanOut>(`/loans/${loanId}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(body),
  });
}

/**
 * UPSERTs the loan_financials row (creates or updates).
 * Skips the call entirely when all values are null — no point creating an empty row.
 */
export async function upsertLoanFinancials(
  loanId: string,
  payload: {
    loan_amount?: number | null;
    appraised_value?: number | null;
    purchase_price?: number | null;
    fico_score?: number | null;
  },
): Promise<void> {
  const token = getToken();
  if (!token || loanId.startsWith("draft-")) return;

  const hasValue = Object.values(payload).some((v) => v != null);
  if (!hasValue) return;

  await apiRequest<unknown>(`/loans/${loanId}/financials`, {
    method: "PUT",
    token,
    body: JSON.stringify(payload),
  });
}

/**
 * PATCHes an existing borrower in the DB with current draft values.
 */
export async function patchBorrowerInDb(
  borrowerDbId: string,
  borrower: BorrowerDraft,
): Promise<void> {
  const token = getToken();
  if (!token) return;

  await apiRequest<BorrowerOut>(`/borrowers/${borrowerDbId}`, {
    method: "PATCH",
    token,
    body: JSON.stringify({
      first_name: borrower.firstName || null,
      last_name: borrower.lastName || null,
      email: borrower.email || null,
      phone: borrower.phone || null,
      dob: borrower.dob || null,
    }),
  });
}

/**
 * Creates a subject property row in the DB linked to a loan.
 */
export async function createPropertyForLoan(
  loanId: string,
  property: Partial<PropertyDraft>,
): Promise<PropertyOut | null> {
  const token = getToken();
  if (!token || loanId.startsWith("draft-")) return null;

  return apiRequest<PropertyOut>("/properties/", {
    method: "POST",
    token,
    body: JSON.stringify({
      loan_id: loanId,
      is_subject: true,
      address1: property.street1 || null,
      address2: property.street2 || null,
      city: property.city || null,
      state: property.state || null,
      postal_code: property.postalCode || null,
      property_type: property.propertyType || null,
      units: property.units ?? null,
    }),
  });
}

/**
 * PATCHes an existing subject property row with current draft values.
 */
export async function updatePropertyInDb(
  propertyDbId: string,
  property: Partial<PropertyDraft>,
): Promise<void> {
  const token = getToken();
  if (!token) return;

  await apiRequest<PropertyOut>(`/properties/${propertyDbId}`, {
    method: "PATCH",
    token,
    body: JSON.stringify({
      address1: property.street1 || null,
      address2: property.street2 || null,
      city: property.city || null,
      state: property.state || null,
      postal_code: property.postalCode || null,
      property_type: property.propertyType || null,
      units: property.units ?? null,
    }),
  });
}
