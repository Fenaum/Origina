import { useLoanSubmissionStore } from "@/state/submissionStore";
import { AssetDepletionPanel } from "@/components/submission/steps/panels/AssetDepletionPanel";
import { BankStatementIncomePanel } from "@/components/submission/steps/panels/BankStatementIncomePanel";
import { DscrIncomePanel } from "@/components/submission/steps/panels/DscrIncomePanel";
import { InterestOnlyPanel } from "@/components/submission/steps/panels/InterestOnlyPanel";
import { JumboFullDocPanel } from "@/components/submission/steps/panels/JumboFullDocPanel";

export function IncomeSection() {
  const income = useLoanSubmissionStore((state) => state.draft.income);

  if (income.type === "dscr") return <DscrIncomePanel income={income} />;
  if (income.type === "bank_statement") return <BankStatementIncomePanel income={income} />;
  if (income.type === "asset_depletion") return <AssetDepletionPanel income={income} />;
  if (income.type === "interest_only") return <InterestOnlyPanel income={income} />;
  return <JumboFullDocPanel income={income} />;
}
