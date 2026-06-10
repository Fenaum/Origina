import { QuestionCard } from "@/components/borrower/QuestionCard";
import type { IntakeIncomeType } from "@/types/intake";

const options: { value: IntakeIncomeType; title: string; copy: string }[] = [
  { value: "w2", title: "W-2 employment", copy: "Salary, hourly, bonus, or commission employment." },
  { value: "self_employed", title: "Self-employed", copy: "Business owner, contractor, or 1099 income." },
  { value: "rental", title: "Rental income", copy: "The property or portfolio generates rental income." },
  { value: "assets", title: "Assets", copy: "Savings or investments may support qualifying income." },
  { value: "retired", title: "Retired", copy: "Social Security, pension, IRA, or retirement assets." },
  { value: "foreign_national", title: "Foreign national", copy: "International income or limited U.S. credit history." },
];

type Props = {
  value?: IntakeIncomeType;
  onAnswer: (value: IntakeIncomeType) => void;
};

export function IncomeTypeQuestion({ value, onAnswer }: Props) {
  return (
    <QuestionCard
      eyebrow="Question 3"
      title="How do you earn income?"
      note="This helps us understand which approach to documenting your income may work best for your situation."
    >
      <div className="borrower-option-grid compact">
        {options.map((option) => (
          <button
            className={`borrower-option-card${value === option.value ? " selected" : ""}`}
            key={option.value}
            type="button"
            onClick={() => onAnswer(option.value)}
          >
            <strong>{option.title}</strong>
            <span>{option.copy}</span>
          </button>
        ))}
      </div>
    </QuestionCard>
  );
}
