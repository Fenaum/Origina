import { useRouter } from "next/router";
import { AppLayout } from "@/components/app/AppLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingSpinner } from "@/components/feedback/LoadingSpinner";
import { LoanDetailSummary } from "@/components/loans/LoanDetailSummary";
import { useLoan } from "@/hooks/useLoans";

export default function LoanDetailPage() {
  const router = useRouter();
  const loanId = router.query.loanId ? String(router.query.loanId) : undefined;
  const { loan, loading, error } = useLoan(loanId);

  return (
    <AppLayout allowedRoles={["account_executive", "broker", "underwriter"]}>
      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <ErrorState
          title="Could not load loan"
          description={error}
          onRetry={() => router.reload()}
        />
      ) : loan ? (
        <>
          <PageHeader
            eyebrow="Loan Detail"
            title={`${loan.borrowerName} — ${loan.loanNumber}`}
            description="Core file context with space reserved for conditions, documents, status history, and decisions."
          />
          <LoanDetailSummary loan={loan} />
        </>
      ) : (
        <PageHeader
          eyebrow="Loan Detail"
          title="Loan not found"
          description="This loan ID does not exist or is not accessible with your current role."
        />
      )}
    </AppLayout>
  );
}
