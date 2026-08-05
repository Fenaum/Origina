import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { AppLayout } from "@/components/app/AppLayout";
import { ErrorState } from "@/components/feedback/ErrorState";
import { PipelinePageSkeleton } from "@/components/loans/PipelinePageSkeleton";
import { PipelineFilterPanel } from "@/components/loans/pipeline/PipelineFilterPanel";
import { PipelineGrid } from "@/components/loans/pipeline/PipelineGrid";
import { PipelineKpis } from "@/components/loans/pipeline/PipelineKpis";
import { PipelineToolbar } from "@/components/loans/pipeline/PipelineToolbar";
import { applyPipelineFilters, applyPipelineSort } from "@/data/pipelineFilters";
import { listLoans } from "@/services/loanService";
import { EMPTY_FILTERS, usePipelineStore } from "@/state/pipelineStore";
import { useAuth } from "@/state/auth";
import { LOAN_TEAM_ROLES } from "@/types/auth";
import type { LoanStatus, LoanSummary } from "@/types/loan";

const PAGE_SIZE = 50;

export default function LoanPipelinePage() {
  const { token, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const store = usePipelineStore();
  const [loans, setLoans] = useState<LoanSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  // Apply URL filter params from dashboard card deep-links (one-time on mount).
  const appliedQueryRef = useRef(false);
  useEffect(() => {
    if (!router.isReady || appliedQueryRef.current) return;
    const q = router.query;
    if (!q.status && !q.actionNeeded && !q.conditionsOutstanding) return;

    appliedQueryRef.current = true;
    const patch = { ...EMPTY_FILTERS };
    if (typeof q.status === "string") patch.statuses = [q.status as LoanStatus];
    if (q.actionNeeded === "true") patch.actionNeeded = true;
    if (q.conditionsOutstanding === "true") patch.conditionsOutstanding = true;
    store.setFilters(patch);
  }, [router.isReady, router.query, store]);

  // Reset to page 1 whenever the active filters change so users don't land
  // on a page that no longer reflects what they searched for.
  useEffect(() => {
    setPage(1);
  }, [
    store.filters.search,
    store.filters.statuses,
    store.filters.programs,
    store.filters.actionNeeded,
    store.filters.conditionsOutstanding,
  ]);

  const loadLoans = useCallback(
    async (isRetry = false) => {
      setError(null);
      setRetrying(isRetry);

      if (authLoading) return;

      if (!token) {
        setLoans([]);
        setTotal(0);
        setLoading(false);
        setRetrying(false);
        return;
      }

      if (!isRetry) setLoading(true);

      try {
        const skip = (page - 1) * PAGE_SIZE;
        const data = await listLoans(token, { skip, limit: PAGE_SIZE });
        setLoans(data.loans);
        setTotal(data.total);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load pipeline data.");
      } finally {
        setLoading(false);
        setRetrying(false);
      }
    },
    [authLoading, token, page],
  );

  useEffect(() => {
    void loadLoans();
  }, [loadLoans]);

  const filtered = useMemo(
    () => applyPipelineFilters(loans, store.filters),
    [loans, store.filters],
  );

  // Scroll to top of results whenever active filters change so search results
  // are never off-screen above the user's current scroll position.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [store.filters.search, store.filters.statuses, store.filters.programs, store.filters.actionNeeded, store.filters.conditionsOutstanding]);

  const sorted = useMemo(
    () => applyPipelineSort(filtered, store.sortField, store.sortDir),
    [filtered, store.sortField, store.sortDir],
  );

  return (
    <AppLayout allowedRoles={[...LOAN_TEAM_ROLES]}>
      <div className="pipeline-workspace">
        <PipelineToolbar
          totalCount={loans.length}
          exportLoans={sorted}
          onRefresh={() => void loadLoans(true)}
        />

        {loading ? (
          <PipelinePageSkeleton />
        ) : error ? (
          <div className="pipeline-workspace-body">
            <ErrorState
              title="Pipeline unavailable"
              description={error}
              isRetrying={retrying}
              onRetry={() => void loadLoans(true)}
            />
          </div>
        ) : (
          <>
            <PipelineKpis loans={loans} />
            <PipelineGrid
              loans={sorted}
              total={total}
              page={page}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              onLoanMutated={() => void loadLoans(true)}
            />
          </>
        )}

        {store.filterPanelOpen && <PipelineFilterPanel />}
      </div>
    </AppLayout>
  );
}
