import Link from "next/link";
import { EmptyState } from "@/components/feedback/EmptyState";
import { loanStatusLabels, type LoanSummary } from "@/types/loan";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function LoanPipelineTable({ loans }: { loans: LoanSummary[] }) {
  if (loans.length === 0) {
    return (
      <EmptyState
        title="No loans found"
        description="Pipeline records will appear here after loans are submitted or returned by the API."
      />
    );
  }

  return (
    <section className="panel fade-slide-in">
      <div className="panel-heading">
        <h3>Loan Pipeline</h3>
        <span>{loans.length} active files</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Loan</th>
              <th>Borrower</th>
              <th>Status</th>
              <th>Amount</th>
              <th>Action Items</th>
              <th>State</th>
              <th>Owner</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {loans.map((loan) => (
              <tr key={loan.id}>
                <td>
                  <Link href={`/loans/${loan.id}`}>{loan.loanNumber}</Link>
                </td>
                <td>{loan.borrowerName}</td>
                <td>
                  <span className="status-pill">{loanStatusLabels[loan.status]}</span>
                </td>
                <td>{currencyFormatter.format(loan.loanAmount)}</td>
                <td>{loan.actionsNeeded}</td>
                <td>{loan.propertyState}</td>
                <td>{loan.owner}</td>
                <td>{loan.updatedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
