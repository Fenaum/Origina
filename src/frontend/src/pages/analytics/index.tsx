import { useCallback, useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/app/AppLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingSpinner } from "@/components/feedback/LoadingSpinner";
import { PipelineCharts } from "@/components/loans/PipelineCharts";
import { PipelineKpiGrid } from "@/components/loans/PipelineKpiGrid";
import { buildPipelineKpis } from "@/data/pipelineAnalytics";
import { listLoans } from "@/services/loanService";
import { useAuth } from "@/state/auth";
import type { LoanSummary } from "@/types/loan";

export default function AnalyticsPage() {
  const { token } = useAuth();
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
        setError(e instanceof Error ? e.message : "Unable to load analytics data.");
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

  const kpis = useMemo(() => buildPipelineKpis(loans), [loans]);

  return (
    <AppLayout allowedRoles={["account_executive", "broker", "underwriter"]}>
      <div className="page-action-row">
        <PageHeader
          eyebrow="Analytics"
          title="Pipeline Analytics"
          description="Volume trends, status distribution, channel mix, and open item breakdowns across all active files."
        />
        <button
          type="button"
          className="ghost-button"
          onClick={() => void loadLoans(true)}
          disabled={retrying}
        >
          {retrying ? "Refreshing…" : "↺ Refresh"}
        </button>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <ErrorState
          title="Analytics unavailable"
          description={error}
          isRetrying={retrying}
          onRetry={() => void loadLoans(true)}
        />
      ) : (
        <>
          <PipelineKpiGrid kpis={kpis} />
          <PipelineCharts loans={loans} />
        </>
      )}
    </AppLayout>
  );
}
