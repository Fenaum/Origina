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
import type { LoanStatus, LoanSummary } from "@/types/loan";

export default function LoanPipelinePage() {
  const { token, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const store = usePipelineStore();
  const [loans, setLoans] = useState<LoanSummary[]>([]);
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

  const loadLoans = useCallback(
    async (isRetry = false) => {
      setError(null);
      setRetrying(isRetry);

      if (authLoading) return;

      if (!token) {
        setLoans([]);
        setLoading(false);
        setRetrying(false);
        return;
      }

      if (!isRetry) setLoading(true);

      try {
        const data = await listLoans(token, { limit: 1000 });
        setLoans(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load pipeline data.");
      } finally {
        setLoading(false);
        setRetrying(false);
      }
    },
    [authLoading, token],
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
    <AppLayout allowedRoles={["admin", "account_executive", "broker", "processor", "underwriter", "funder", "manager"]}>
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
            <PipelineGrid loans={sorted} onLoanMutated={() => void loadLoans(true)} />
          </>
        )}

        {store.filterPanelOpen && <PipelineFilterPanel />}
      </div>
    </AppLayout>
  );
}
