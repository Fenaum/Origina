import { QuestionCard } from "@/components/borrower/QuestionCard";
import type { IntakeTimeline } from "@/types/intake";

const options: { value: IntakeTimeline; title: string; copy: string }[] = [
  { value: "now", title: "Looking now", copy: "I may need guidance or next steps soon." },
  { value: "1_3_months", title: "1-3 months", copy: "I am preparing for a near-term application." },
  { value: "3_6_months", title: "3-6 months", copy: "I am planning ahead." },
  { value: "just_exploring", title: "Just exploring", copy: "I want to understand options before taking action." },
];

type Props = {
  value?: IntakeTimeline;
  onAnswer: (value: IntakeTimeline) => void;
};

export function TimelineQuestion({ value, onAnswer }: Props) {
  return (
    <QuestionCard
      eyebrow="Question 7"
      title="What is your timeline?"
      note="Timeline helps prioritize whether education, pricing, or a specialist handoff makes sense."
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
