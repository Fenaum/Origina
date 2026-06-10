import { QuestionCard } from "@/components/borrower/QuestionCard";
import type { IntakePropertyType } from "@/types/intake";

const options: { value: IntakePropertyType; title: string; copy: string }[] = [
  { value: "primary", title: "Primary residence", copy: "A home you plan to live in most of the year." },
  { value: "investment", title: "Investment property", copy: "A rental or income-producing property." },
  { value: "second_home", title: "Second home", copy: "A vacation or part-time residence." },
];

type Props = {
  value?: IntakePropertyType;
  onAnswer: (value: IntakePropertyType) => void;
};

export function PropertyTypeQuestion({ value, onAnswer }: Props) {
  return (
    <QuestionCard
      eyebrow="Question 2"
      title="What type of property is this?"
      note="Property use changes which Non-QM programs can be considered."
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
