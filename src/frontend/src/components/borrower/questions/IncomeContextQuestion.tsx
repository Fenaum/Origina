import { QuestionCard } from "@/components/borrower/QuestionCard";
import type { IntakeAnswers, IntakeIncomeType } from "@/types/intake";

type Props = {
  answers: IntakeAnswers;
  onAnswer: (key: string, value: string | number) => void;
};

export function IncomeContextQuestion({ answers, onAnswer }: Props) {
  const incomeType = answers.income_type;

  if (incomeType === "self_employed") {
    return (
      <QuestionCard
        eyebrow="Question 4"
        title="How would you prefer to document self-employed income?"
        note="Bank statement programs often use deposits instead of tax returns."
      >
        <div className="borrower-option-grid">
          <button
            className={`borrower-option-card${answers.income_context === "bank_statements" && answers["income_context.bank_statement_months"] === "12" ? " selected" : ""}`}
            type="button"
            onClick={() => {
              onAnswer("income_context", "bank_statements");
              onAnswer("income_context.bank_statement_months", "12");
            }}
          >
            <strong>12 months of bank statements</strong>
            <span>A faster review path when recent deposits are consistent.</span>
          </button>
          <button
            className={`borrower-option-card${answers.income_context === "bank_statements" && answers["income_context.bank_statement_months"] === "24" ? " selected" : ""}`}
            type="button"
            onClick={() => {
              onAnswer("income_context", "bank_statements");
              onAnswer("income_context.bank_statement_months", "24");
            }}
          >
            <strong>24 months of bank statements</strong>
            <span>Often helpful when deposits vary seasonally.</span>
          </button>
        </div>
      </QuestionCard>
    );
  }

  if (incomeType === "rental") {
    return (
      <QuestionCard
        eyebrow="Question 4"
        title="What rental income context best fits?"
        note="Rental details help determine whether DSCR may be a fit."
      >
        <div className="borrower-option-grid">
          <button
            className={`borrower-option-card${answers["income_context.owns_rental_property"] === "yes" ? " selected" : ""}`}
            type="button"
            onClick={() => {
              onAnswer("income_context", "owns_rental_property");
              onAnswer("income_context.owns_rental_property", "yes");
            }}
          >
            <strong>I already own rental property</strong>
            <span>Existing lease or rent history may support the review.</span>
          </button>
          <button
            className={`borrower-option-card${answers["income_context.owns_rental_property"] === "no" ? " selected" : ""}`}
            type="button"
            onClick={() => {
              onAnswer("income_context", "projected_rent");
              onAnswer("income_context.owns_rental_property", "no");
            }}
          >
            <strong>I am buying a rental property</strong>
            <span>A market rent schedule may be used after appraisal.</span>
          </button>
        </div>
        <label className="borrower-field">
          Estimated monthly rent
          <input
            inputMode="numeric"
            placeholder="$3,500"
            type="number"
            value={answers["income_context.monthly_rent"] ?? ""}
            onChange={(event) => onAnswer("income_context.monthly_rent", Number(event.target.value))}
          />
        </label>
      </QuestionCard>
    );
  }

  if (incomeType === "assets" || incomeType === "retired") {
    return (
      <QuestionCard
        eyebrow="Question 4"
        title={incomeType === "retired" ? "What retirement income applies?" : "What asset range best describes you?"}
        note="Asset-based paths use balances and reserves rather than employment income."
      >
        <div className="borrower-option-grid">
          {["under_250k", "250k_750k", "750k_1_5m", "1_5m_plus"].map((range) => (
            <button
              className={`borrower-option-card${answers["income_context.asset_value_range"] === range ? " selected" : ""}`}
              key={range}
              type="button"
              onClick={() => {
                onAnswer("income_context", incomeType === "retired" ? "retirement_assets" : "asset_depletion");
                onAnswer("income_context.asset_value_range", range);
              }}
            >
              <strong>{assetRangeLabel(range)}</strong>
              <span>{incomeType === "retired" ? "Includes retirement and distribution sources." : "Approximate liquid or retirement asset value."}</span>
            </button>
          ))}
        </div>
      </QuestionCard>
    );
  }

  if (incomeType === "foreign_national") {
    return (
      <QuestionCard
        eyebrow="Question 4"
        title="Do you have a U.S. ITIN or SSN?"
        note="Foreign national programs can vary based on U.S. identification and property use."
      >
        <div className="borrower-option-grid">
          {["yes", "no"].map((answer) => (
            <button
              className={`borrower-option-card${answers["income_context.has_us_itin"] === answer ? " selected" : ""}`}
              key={answer}
              type="button"
              onClick={() => {
                onAnswer("income_context", "foreign_national_id");
                onAnswer("income_context.has_us_itin", answer);
              }}
            >
              <strong>{answer === "yes" ? "Yes" : "No"}</strong>
              <span>{answer === "yes" ? "I have a U.S. ITIN or SSN." : "I do not have U.S. identification yet."}</span>
            </button>
          ))}
        </div>
      </QuestionCard>
    );
  }

  return (
    <W2Context
      value={answers.income_context}
      incomeType={incomeType}
      onAnswer={(value) => onAnswer("income_context", value)}
    />
  );
}

function W2Context({
  value,
  incomeType,
  onAnswer,
}: {
  value?: string;
  incomeType?: IntakeIncomeType;
  onAnswer: (value: string) => void;
}) {
  return (
    <QuestionCard
      eyebrow="Question 4"
      title="Do you have 2 years of consistent employment?"
      note={incomeType ? "Consistency may improve which programs are likely to fit." : "This helps us understand documentation strength."}
    >
      <div className="borrower-option-grid">
        <button
          className={`borrower-option-card${value === "consistent_employment_yes" ? " selected" : ""}`}
          type="button"
          onClick={() => onAnswer("consistent_employment_yes")}
        >
          <strong>Yes</strong>
          <span>My income and employment have been broadly consistent.</span>
        </button>
        <button
          className={`borrower-option-card${value === "consistent_employment_no" ? " selected" : ""}`}
          type="button"
          onClick={() => onAnswer("consistent_employment_no")}
        >
          <strong>Not exactly</strong>
          <span>My employment, role, or income has recently changed.</span>
        </button>
      </div>
    </QuestionCard>
  );
}

function assetRangeLabel(value: string): string {
  return {
    under_250k: "Under $250k",
    "250k_750k": "$250k to $750k",
    "750k_1_5m": "$750k to $1.5M",
    "1_5m_plus": "$1.5M+",
  }[value] ?? value;
}
