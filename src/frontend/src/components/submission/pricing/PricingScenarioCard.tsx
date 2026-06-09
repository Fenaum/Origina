import { formatCurrency, formatPercent } from "@/lib/utils";
import type { PricingScenario } from "@/types/submission";

export function PricingScenarioCard({
  scenario,
  selected,
  onSelect,
}: {
  scenario: PricingScenario;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <article className={selected ? "scenario-card selected" : "scenario-card"}>
      {scenario.label === "Buy Down" ? <span className="recommended-badge">Recommended</span> : null}
      <h3>{scenario.label}</h3>
      <strong>{formatPercent(scenario.rate, 3)}</strong>
      <p>
        {scenario.points} points
        {scenario.points > 0 ? ` (${formatCurrency((scenario.loanAmount * scenario.points) / 100)})` : ""}
      </p>
      <dl>
        <div>
          <dt>Payment</dt>
          <dd>{formatCurrency(scenario.monthlyPayment)} / mo</dd>
        </div>
        <div>
          <dt>APR</dt>
          <dd>{formatPercent(scenario.apr, 2)}</dd>
        </div>
        <div>
          <dt>Break-even</dt>
          <dd>{scenario.breakEvenMonths ? `${scenario.breakEvenMonths} mo` : "—"}</dd>
        </div>
      </dl>
      <button className="primary-button" type="button" onClick={onSelect}>
        {selected ? "Selected" : "Select"}
      </button>
    </article>
  );
}
