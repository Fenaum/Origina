import { loanStatusLabels, type LoanSummary } from "@/types/loan";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function LoanDetailSummary({ loan }: { loan: LoanSummary }) {
  return (
    <section className="detail-grid">
      <div className="panel">
        <div className="panel-heading">
          <h3>Loan Summary</h3>
          <span className="status-pill">{loanStatusLabels[loan.status]}</span>
        </div>
        <dl className="definition-list">
          <div>
            <dt>Borrower</dt>
            <dd>{loan.borrowerName}</dd>
          </div>
          <div>
            <dt>Loan Number</dt>
            <dd>{loan.loanNumber}</dd>
          </div>
          <div>
            <dt>Loan Amount</dt>
            <dd>{currencyFormatter.format(loan.loanAmount)}</dd>
          </div>
          <div>
            <dt>Channel</dt>
            <dd>{loan.channel}</dd>
          </div>
          <div>
            <dt>Property State</dt>
            <dd>{loan.propertyState}</dd>
          </div>
          <div>
            <dt>File Owner</dt>
            <dd>{loan.owner}</dd>
          </div>
        </dl>
      </div>

      <div className="panel">
        <div className="panel-heading">
          <h3>Next Actions</h3>
        </div>
        <div className="status-list">
          <div className="status-row">
            <div>
              <strong>Conditions</strong>
              <span>Backend integration pending</span>
            </div>
            <p>3 open</p>
          </div>
          <div className="status-row">
            <div>
              <strong>Documents</strong>
              <span>Document API pending</span>
            </div>
            <p>2 requested</p>
          </div>
          <div className="status-row">
            <div>
              <strong>Decisioning</strong>
              <span>Underwriting workflow pending</span>
            </div>
            <p>In review</p>
          </div>
        </div>
      </div>
    </section>
  );
}
