import { useRouter } from "next/router";
import { LoanWorkspaceLayout } from "@/components/app/LoanWorkspaceLayout";
import { LoanWorkspaceShell } from "@/components/loans/LoanWorkspaceShell";
import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingSpinner } from "@/components/feedback/LoadingSpinner";
import { useLoan } from "@/hooks/useLoans";

export default function LoanDetailPage() {
  const router = useRouter();
  const loanId = router.query.loanId ? String(router.query.loanId) : undefined;
  const { loan, loading, error } = useLoan(loanId);

  return (
    <LoanWorkspaceLayout allowedRoles={["account_executive", "broker", "underwriter"]}>
      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <ErrorState
          title="Could not load loan"
          description={error}
          onRetry={() => router.reload()}
        />
      ) : loan ? (
        <LoanWorkspaceShell loan={loan} />
      ) : (
        <div className="workspace-placeholder">
          <h2>Loan not found</h2>
          <p>This loan ID does not exist or is not accessible with your current role.</p>
        </div>
      )}
    </LoanWorkspaceLayout>
  );
}
