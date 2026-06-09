import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/app/AppLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { PipelineCharts } from "@/components/loans/PipelineCharts";
import { PipelineKpiGrid } from "@/components/loans/PipelineKpiGrid";
import { PipelinePageSkeleton } from "@/components/loans/PipelinePageSkeleton";
import { LoanPipelineTable } from "@/components/loans/LoanPipelineTable";
import { buildPipelineKpis } from "@/data/pipelineAnalytics";
import { listLoans } from "@/services/loanService";
import { useAuth } from "@/state/auth";
import type { LoanSummary } from "@/types/loan";

export default function LoanPipelinePage() {
  const { token } = useAuth();
  const [loans, setLoans] = useState<LoanSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const loadLoans = useCallback(async (retrying = false) => {
    setError(null);
    setIsRetrying(retrying);
    setIsLoading(!retrying);

    try {
      const nextLoans = await listLoans(token ?? undefined);
      setLoans(nextLoans);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load loan pipeline data.",
      );
    } finally {
      setIsLoading(false);
      setIsRetrying(false);
    }
  }, [token]);

  useEffect(() => {
    void loadLoans();
  }, [loadLoans]);

  const kpis = useMemo(() => buildPipelineKpis(loans), [loans]);

  return (
    <AppLayout allowedRoles={["account_executive", "broker", "underwriter"]}>
      <div className="page-action-row">
        <PageHeader
          eyebrow="Pipeline"
          title="Loan Pipeline"
          description="A simple starting view for active files, prepared for filters, exports, and richer pipeline states."
        />
        <Link className="primary-button" href="/loans/new">
          + New Loan
        </Link>
      </div>

      {isLoading ? <PipelinePageSkeleton /> : null}

      {!isLoading && error ? (
        <ErrorState
          title="Loan data unavailable"
          description={error}
          isRetrying={isRetrying}
          onRetry={() => void loadLoans(true)}
        />
      ) : null}

      {!isLoading && !error && loans.length === 0 ? (
        <EmptyState
          title="No pipeline data"
          description="Loan pipeline analytics and table rows will appear after the API returns files."
        />
      ) : null}

      {!isLoading && !error && loans.length > 0 ? (
        <>
          <PipelineKpiGrid kpis={kpis} />
          <PipelineCharts loans={loans} />
          <LoanPipelineTable loans={loans} />
        </>
      ) : null}
    </AppLayout>
  );
}
