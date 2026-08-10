/**
 * CM React Query hooks — one file because the call sites are tightly
 * coupled (a single loan page can fire 4-5 queries; clustering them keeps
 * the invalidation set obvious).
 *
 * Per repo convention (CLAUDE.md): all data fetching uses `useQuery` /
 * `useMutation` — never `useEffect + fetch`. `staleTime` is 30s for
 * cockpit/listing pages (acceptable staleness for an in-app monitor) and
 * 0 for audit chains (always want fresh on screen).
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import * as cm from "@/services/cmService";
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
} from "@/types/api";
import { useAuth } from "@/state/auth";

const ENABLED = (token: string | null) => Boolean(token);

// ── Pipeline / cockpit ──────────────────────────────────────────────────────
export function useCMPipeline(): UseQueryResult<CMPipelineSummary> {
  const { token } = useAuth();
  return useQuery<CMPipelineSummary>({
    queryKey: ["cm", "pipeline"],
    queryFn: () => cm.getCMPipeline(),
    enabled: ENABLED(token),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

// ── Per-loan summary ────────────────────────────────────────────────────────
export function useLoanCMSummary(loanId: string | null): UseQueryResult<CMLoanCMSummary> {
  const { token } = useAuth();
  return useQuery<CMLoanCMSummary>({
    queryKey: ["cm", "loanSummary", loanId],
    queryFn: () => cm.getLoanCMSummary(loanId as string),
    enabled: ENABLED(token) && Boolean(loanId),
    staleTime: 30_000,
  });
}

// ── Locks ───────────────────────────────────────────────────────────────────
export function useRequestLock(): UseMutationResult<
  CMLockOut,
  Error,
  CMLockRequestBody
> {
  const qc = useQueryClient();
  return useMutation<CMLockOut, Error, CMLockRequestBody>({
    mutationFn: (body) => cm.requestLock(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cm"] });
    },
  });
}

export function useConfirmLock(): UseMutationResult<CMLockOut, Error, string> {
  const qc = useQueryClient();
  return useMutation<CMLockOut, Error, string>({
    mutationFn: (lockId) => cm.confirmLock(lockId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cm"] });
    },
  });
}

export function useExpireLock(): UseMutationResult<CMLockOut, Error, string> {
  const qc = useQueryClient();
  return useMutation<CMLockOut, Error, string>({
    mutationFn: (lockId) => cm.expireLock(lockId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cm"] });
    },
  });
}

export function useRepriceLoan(): UseMutationResult<CMLockOut, Error, string> {
  const qc = useQueryClient();
  return useMutation<CMLockOut, Error, string>({
    mutationFn: (loanId) => cm.repriceLoan(loanId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cm"] });
    },
  });
}

// ── Best-ex ─────────────────────────────────────────────────────────────────
export function useRunBestEx(): UseMutationResult<
  CMBestExRunOut,
  Error,
  cm.BestExBody
> {
  const qc = useQueryClient();
  return useMutation<CMBestExRunOut, Error, cm.BestExBody>({
    mutationFn: (body) => cm.runBestEx(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cm"] });
    },
  });
}

export function useDetectMaterialChange(): UseMutationResult<
  CMMaterialChangeResult,
  Error,
  string
> {
  const qc = useQueryClient();
  return useMutation<CMMaterialChangeResult, Error, string>({
    mutationFn: (loanId) => cm.detectMaterialChange(loanId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cm"] });
    },
  });
}

// ── Allocations ─────────────────────────────────────────────────────────────
export function useCreateAllocation(): UseMutationResult<
  CMAllocationOut,
  Error,
  CMAllocationRequestBody
> {
  const qc = useQueryClient();
  return useMutation<CMAllocationOut, Error, CMAllocationRequestBody>({
    mutationFn: (body) => cm.createAllocation(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cm"] });
    },
  });
}

// ── Pools ───────────────────────────────────────────────────────────────────
export function usePools(): UseQueryResult<CMPoolOut[]> {
  const { token } = useAuth();
  return useQuery<CMPoolOut[]>({
    queryKey: ["cm", "pools"],
    queryFn: () => cm.listPools(),
    enabled: ENABLED(token),
    staleTime: 30_000,
  });
}

export function useCreatePool(): UseMutationResult<
  CMPoolOut,
  Error,
  cm.CreatePoolBody
> {
  const qc = useQueryClient();
  return useMutation<CMPoolOut, Error, cm.CreatePoolBody>({
    mutationFn: (body) => cm.createPool(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cm"] });
    },
  });
}

export function useAddLoanToPool(): UseMutationResult<
  { pool_id: string; loan_id: string },
  Error,
  { poolId: string; loanId: string }
> {
  const qc = useQueryClient();
  return useMutation<{ pool_id: string; loan_id: string }, Error, { poolId: string; loanId: string }>({
    mutationFn: ({ poolId, loanId }) => cm.addLoanToPool(poolId, loanId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cm"] });
    },
  });
}

// ── Alerts ──────────────────────────────────────────────────────────────────
export function useAlerts(
  status?: "open" | "ack" | "resolved",
  loanId?: string,
): UseQueryResult<CMAlertOut[]> {
  const { token } = useAuth();
  return useQuery<CMAlertOut[]>({
    queryKey: ["cm", "alerts", status ?? null, loanId ?? null],
    queryFn: () => cm.listAlerts({ status, loanId }),
    enabled: ENABLED(token),
    staleTime: 15_000,
  });
}

export function useAcknowledgeAlert(): UseMutationResult<CMAlertOut, Error, string> {
  const qc = useQueryClient();
  return useMutation<CMAlertOut, Error, string>({
    mutationFn: (alertId) => cm.acknowledgeAlert(alertId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cm", "alerts"] });
    },
  });
}

// ── Audit chain ─────────────────────────────────────────────────────────────
export function useLoanAuditChain(
  loanId: string | null,
): UseQueryResult<CMAuditChain> {
  const { token } = useAuth();
  return useQuery<CMAuditChain>({
    queryKey: ["cm", "audit", loanId],
    queryFn: () => cm.getLoanAuditChain(loanId as string),
    enabled: ENABLED(token) && Boolean(loanId),
    // Audit must always reflect the latest state.
    staleTime: 0,
  });
}

// ── /cm/loans list (Pipeline + Lock queue modules) ───────────────────────────
export function useCmLoans(
  opts?: { status?: string; limit?: number },
): UseQueryResult<CMListLoanRow[]> {
  const { token } = useAuth();
  return useQuery<CMListLoanRow[]>({
    queryKey: ["cm", "loans", opts?.status ?? null, opts?.limit ?? null],
    queryFn: () => cm.listCmLoans(opts as cm.ListCmLoansOpts),
    enabled: ENABLED(token),
    staleTime: 30_000,
  });
}
