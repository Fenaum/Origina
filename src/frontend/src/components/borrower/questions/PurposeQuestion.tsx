import { QuestionCard } from "@/components/borrower/QuestionCard";
import type { IntakePurpose } from "@/types/intake";

const options: { value: IntakePurpose; title: string; copy: string }[] = [
  { value: "purchase", title: "Buy a property", copy: "I am looking for financing on a new purchase." },
  { value: "refinance", title: "Refinance", copy: "I want to review options for a property I already own." },
  { value: "explore", title: "Explore options", copy: "I am early and want to understand what may fit." },
];

type Props = {
  value?: IntakePurpose;
  onAnswer: (value: IntakePurpose) => void;
};

export function PurposeQuestion({ value, onAnswer }: Props) {
  return (
    <QuestionCard
      eyebrow="Question 1"
      title="What are you trying to do?"
      note="We use this to match you to the right program, not to make an underwriting decision."
    >
      <div className="borrower-option-grid">
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
