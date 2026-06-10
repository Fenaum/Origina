import { QuestionCard } from "@/components/borrower/QuestionCard";

type Props = {
  value?: number;
  onAnswer: (value: number) => void;
};

export function LoanAmountQuestion({ value, onAnswer }: Props) {
  const formatted = value
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(value)
    : null;

  return (
    <QuestionCard
      eyebrow="Question 6"
      title="What loan amount are you considering?"
      note="An estimate is fine. You can adjust it later with a licensed specialist."
    >
      <label className="borrower-field large">
        Estimated loan amount
        <input
          inputMode="numeric"
          min="0"
          placeholder="650000"
          type="number"
          value={value ?? ""}
          onChange={(event) => onAnswer(Number(event.target.value))}
        />
      </label>
      {formatted ? <div className="borrower-amount-preview">{formatted}</div> : null}
    </QuestionCard>
  );
}
