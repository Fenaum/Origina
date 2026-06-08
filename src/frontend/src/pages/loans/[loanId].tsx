import { useRouter } from "next/router";
import { AppLayout } from "@/components/app/AppLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { LoanDetailSummary } from "@/components/loans/LoanDetailSummary";
import { mockLoans } from "@/data/mockLoans";

export default function LoanDetailPage() {
  const router = useRouter();
  const loanId = String(router.query.loanId ?? "");
  const loan = mockLoans.find((item) => item.id === loanId);

  return (
    <AppLayout allowedRoles={["account_executive", "broker", "underwriter"]}>
      {loan ? (
        <>
          <PageHeader
            eyebrow="Loan Detail"
            title={`${loan.borrowerName} - ${loan.loanNumber}`}
            description="Core file context with space reserved for conditions, documents, status history, and decisions."
          />
          <LoanDetailSummary loan={loan} />
        </>
      ) : (
        <PageHeader
          eyebrow="Loan Detail"
          title="Loan not found"
          description="The requested mock loan does not exist."
        />
      )}
    </AppLayout>
  );
}
