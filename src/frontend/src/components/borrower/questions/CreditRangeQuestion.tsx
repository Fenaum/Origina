import { QuestionCard } from "@/components/borrower/QuestionCard";
import type { IntakeCreditRange } from "@/types/intake";

const options: { value: IntakeCreditRange; label: string }[] = [
  { value: "580_619", label: "580-619" },
  { value: "620_659", label: "620-659" },
  { value: "660_699", label: "660-699" },
  { value: "700_739", label: "700-739" },
  { value: "740_plus", label: "740+" },
];

type Props = {
  value?: IntakeCreditRange;
  onAnswer: (value: IntakeCreditRange) => void;
};

export function CreditRangeQuestion({ value, onAnswer }: Props) {
  return (
    <QuestionCard
      eyebrow="Question 5"
      title="What is your estimated credit range?"
      note="This is self-reported and does not trigger a credit pull."
    >
      <div className="borrower-choice-row">
        {options.map((option) => (
          <button
            className={`borrower-chip${value === option.value ? " selected" : ""}`}
            key={option.value}
            type="button"
            onClick={() => onAnswer(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </QuestionCard>
  );
}
