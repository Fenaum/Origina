import { useCallback, useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/app/AppLayout";
import { ErrorState } from "@/components/feedback/ErrorState";
import { PipelinePageSkeleton } from "@/components/loans/PipelinePageSkeleton";
import { PipelineFilterPanel } from "@/components/loans/pipeline/PipelineFilterPanel";
import { PipelineGrid } from "@/components/loans/pipeline/PipelineGrid";
import { PipelineKpis } from "@/components/loans/pipeline/PipelineKpis";
import { PipelineToolbar } from "@/components/loans/pipeline/PipelineToolbar";
import { applyPipelineFilters, applyPipelineSort } from "@/data/pipelineFilters";
import { listLoans } from "@/services/loanService";
import { usePipelineStore } from "@/state/pipelineStore";
import { useAuth } from "@/state/auth";
import type { LoanSummary } from "@/types/loan";

export default function LoanPipelinePage() {
  const { token } = useAuth();
  const store = usePipelineStore();
  const [loans, setLoans] = useState<LoanSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  const loadLoans = useCallback(
    async (isRetry = false) => {
      setError(null);
      setRetrying(isRetry);
      if (!isRetry) setLoading(true);

      try {
        const data = await listLoans(token ?? undefined);
        setLoans(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load pipeline data.");
      } finally {
        setLoading(false);
        setRetrying(false);
      }
    },
    [token],
  );

  useEffect(() => {
    void loadLoans();
  }, [loadLoans]);

  const filtered = useMemo(
    () => applyPipelineFilters(loans, store.filters),
    [loans, store.filters],
  );

  const sorted = useMemo(
    () => applyPipelineSort(filtered, store.sortField, store.sortDir),
    [filtered, store.sortField, store.sortDir],
  );

  return (
    <AppLayout allowedRoles={["account_executive", "broker", "underwriter"]}>
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
            <PipelineGrid loans={sorted} />
          </>
        )}

        {store.filterPanelOpen && <PipelineFilterPanel />}
      </div>
    </AppLayout>
  );
}
