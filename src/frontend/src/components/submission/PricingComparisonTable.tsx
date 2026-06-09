import { formatCurrency, formatPercent } from "@/lib/utils";
import { usePricingStore } from "@/state/pricingStore";

export function PricingComparisonTable() {
  const scenarios = usePricingStore((state) => state.scenarios);
  const par = scenarios[0];
  const selected = scenarios.find((scenario) => scenario.isSelected);

  if (!par || !selected) return null;

  const savings = par.monthlyPayment - selected.monthlyPayment;

  return (
    <section className="panel fade-slide-in">
      <div className="panel-heading">
        <h3>Pricing Comparison</h3>
        <span>Scenario impact</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Scenario</th>
              <th>Rate</th>
              <th>Points</th>
              <th>Payment</th>
              <th>APR</th>
            </tr>
          </thead>
          <tbody>
            {scenarios.map((scenario) => (
              <tr key={scenario.id}>
                <td>{scenario.label}</td>
                <td>{formatPercent(scenario.rate, 3)}</td>
                <td>{scenario.points}</td>
                <td>{formatCurrency(scenario.monthlyPayment)}</td>
                <td>{formatPercent(scenario.apr, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="comparison-note">
        Choosing {selected.label} {savings > 0 ? `saves ${formatCurrency(savings)}/month` : "increases payment"} versus par.
      </div>
    </section>
  );
}
