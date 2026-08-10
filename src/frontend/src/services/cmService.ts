/**
 * Capital Markets (CM) service module.
 *
 * Thin wrapper around `apiRequest` for all `/cm/*` endpoints. Per repo
 * convention (see CLAUDE.md), frontend data fetching goes through this
 * service layer; React Query hooks (in `useCm*.ts`) compose these calls
 * with caching, polling, and mutation wiring.
 *
 * Mirrors the backend router at `src/backend/app/api/v1/cm.py` and the
 * out-shapes documented in `src/types/api.ts`. Per the CM ADRs in
 * docs/DECISIONS.md: every persisted decision returns snapshot + version
 * metadata so the UI can show "priced against X (sheet version Y)".
 */
import { apiRequest } from "@/services/apiClient";
import type {
  CMAllocationOut,
  CMAllocationRequestBody,
  CMAuditChain,
  CMListLoanRow,
  CMLockOut,
  CMLockRequestBody,
  CMLoanCMSummary,
  CMMaterialChangeResult,
  CMPipelineSummary,
  CMPoolOut,
  CMBestExRunOut,
  CMAlertOut,
  LockStatus,
  MarketShiftDelta,
} from "@/types/api";

// ── Pipeline / cockpit ──────────────────────────────────────────────────────
export function getCMPipeline(): Promise<CMPipelineSummary> {
  return apiRequest<CMPipelineSummary>("/cm/pipeline");
}

// ── Per-loan CM summary ─────────────────────────────────────────────────────
export function getLoanCMSummary(loanId: string): Promise<CMLoanCMSummary> {
  return apiRequest<CMLoanCMSummary>(
    `/cm/loans/${encodeURIComponent(loanId)}/summary`,
  );
}

// ── Locks ───────────────────────────────────────────────────────────────────
export function requestLock(body: CMLockRequestBody): Promise<CMLockOut> {
  return apiRequest<CMLockOut>("/cm/locks", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function confirmLock(lockId: string): Promise<CMLockOut> {
  return apiRequest<CMLockOut>(`/cm/locks/${encodeURIComponent(lockId)}/confirm`, {
    method: "POST",
  });
}

export function expireLock(lockId: string): Promise<CMLockOut> {
  return apiRequest<CMLockOut>(`/cm/locks/${encodeURIComponent(lockId)}/expire`, {
    method: "POST",
  });
}

export function repriceLoan(loanId: string): Promise<CMLockOut> {
  return apiRequest<CMLockOut>(
    `/cm/loans/${encodeURIComponent(loanId)}/reprice`,
    { method: "POST" },
  );
}

// ── Best-ex / eligibility ───────────────────────────────────────────────────
export type BestExBody = {
  loan_id: string;
  lock_period_days: number;
};

export function evaluateEligibility(
  body: BestExBody,
): Promise<{ loan_id: string; results: unknown[] }> {
  return apiRequest("/cm/eligibility/evaluate", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function runBestEx(body: BestExBody): Promise<CMBestExRunOut> {
  return apiRequest<CMBestExRunOut>("/cm/best-ex/run", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ── Allocations ─────────────────────────────────────────────────────────────
export function createAllocation(body: CMAllocationRequestBody): Promise<CMAllocationOut> {
  return apiRequest<CMAllocationOut>("/cm/allocations", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ── Pools ───────────────────────────────────────────────────────────────────
export type CreatePoolBody = {
  name: string;
  pool_type: string;
  target_investor_program_id: string | null;
  pool_criteria?: Record<string, unknown>;
};

export function listPools(): Promise<CMPoolOut[]> {
  return apiRequest<CMPoolOut[]>("/cm/pools");
}

export function createPool(body: CreatePoolBody): Promise<CMPoolOut> {
  return apiRequest<CMPoolOut>("/cm/pools", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function addLoanToPool(poolId: string, loanId: string): Promise<{ pool_id: string; loan_id: string }> {
  return apiRequest(`/cm/pools/${encodeURIComponent(poolId)}/loans`, {
    method: "POST",
    body: JSON.stringify({ loan_id: loanId }),
  });
}

// ── Alerts ──────────────────────────────────────────────────────────────────
export function listAlerts(opts?: { status?: "open" | "ack" | "resolved"; loanId?: string }): Promise<CMAlertOut[]> {
  const params = new URLSearchParams();
  if (opts?.status) params.set("status", opts.status);
  if (opts?.loanId) params.set("loan_id", opts.loanId);
  const q = params.toString();
  return apiRequest<CMAlertOut[]>(`/cm/alerts${q ? `?${q}` : ""}`);
}

export function acknowledgeAlert(alertId: string): Promise<CMAlertOut> {
  return apiRequest<CMAlertOut>(
    `/cm/alerts/${encodeURIComponent(alertId)}/acknowledge`,
    { method: "POST" },
  );
}

// ── Audit chain ─────────────────────────────────────────────────────────────
export function getLoanAuditChain(loanId: string): Promise<CMAuditChain> {
  return apiRequest<CMAuditChain>(
    `/cm/audit/loan/${encodeURIComponent(loanId)}`,
  );
}

// ── Material-change watcher (PoC demo-only endpoint) ─────────────────────────
export function detectMaterialChange(loanId: string): Promise<CMMaterialChangeResult> {
  return apiRequest<CMMaterialChangeResult>(
    `/cm/_internal/detect-material-change/${encodeURIComponent(loanId)}`,
    { method: "POST" },
  );
}

// ── Demo control: shift market ±25bp (local in-memory; the backend doesn't
//    own a "market" so this is a client-side knob the demo uses to show how
//    the next best-ex run reacts. It does NOT persist.) ──────────────────────
const MARKET_KEY = "origina.cm.marketShiftBps";
export function getMarketShift(): MarketShiftDelta {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(MARKET_KEY);
  const n = raw ? Number(raw) : 0;
  return (n === -25 || n === -10 || n === 10 || n === 25 ? n : 0) as MarketShiftDelta;
}
export function setMarketShift(delta: MarketShiftDelta): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MARKET_KEY, String(delta));
}

// ── /cm/loans (list — Pipeline + Lock queue modules) ─────────────────────────
export type ListCmLoansOpts = {
  status?: LockStatus;
  limit?: number;
};
export function listCmLoans(opts: ListCmLoansOpts = {}): Promise<CMListLoanRow[]> {
  const params = new URLSearchParams();
  if (opts.status) params.set("status", opts.status);
  if (opts.limit) params.set("limit", String(opts.limit));
  const q = params.toString();
  return apiRequest<CMListLoanRow[]>(`/cm/loans${q ? `?${q}` : ""}`);
}
