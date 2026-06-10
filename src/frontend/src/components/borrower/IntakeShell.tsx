import Link from "next/link";
import type { ReactNode } from "react";
import { getProgressPercent, questionLabels, questionOrder } from "@/data/questions";
import type { IntakeAnswers, IntakeQuestionKey } from "@/types/intake";

type IntakeShellProps = {
  answers: IntakeAnswers;
  currentQuestion: IntakeQuestionKey;
  canContinue: boolean;
  isFirstQuestion: boolean;
  onBack: () => void;
  onContinue: () => void;
  children: ReactNode;
};

export function IntakeShell({
  answers,
  currentQuestion,
  canContinue,
  isFirstQuestion,
  onBack,
  onContinue,
  children,
}: IntakeShellProps) {
  const progress = getProgressPercent(answers);
  const stepNumber = questionOrder.indexOf(currentQuestion) + 1;

  return (
    <main className="borrower-intake-page">
      <header className="intake-topbar">
        <Link href="/" className="borrower-wordmark">
          Origina
        </Link>
        <span>No credit pull. No SSN required.</span>
      </header>

      <div className="intake-shell">
        <aside className="intake-progress-panel" aria-label="Borrower intake progress">
          <div>
            <span className="borrower-eyebrow">Borrower Experience</span>
            <p className="intake-panel-tagline">Find your fit in a few focused steps.</p>
          </div>

          <div className="intake-progress-track" aria-hidden>
            <div style={{ width: `${progress}%` }} />
          </div>
          <p className="intake-progress-copy">
            Step {stepNumber} of {questionOrder.length}: {questionLabels[currentQuestion]}
          </p>

          <ol className="intake-step-list">
            {questionOrder.map((question, index) => {
              const isComplete = Boolean(answers[question]);
              const isActive = question === currentQuestion;
              return (
                <li
                  key={question}
                  className={`${isComplete ? "complete" : ""} ${isActive ? "active" : ""}`}
                  aria-current={isActive ? "step" : undefined}
                >
                  <span aria-hidden="true">{index + 1}</span>
                  {questionLabels[question]}
                </li>
              );
            })}
          </ol>
        </aside>

        <section className="intake-question-panel">
          {children}
          <footer className="intake-actions">
            <button className="borrower-secondary-btn" type="button" onClick={onBack}>
              {isFirstQuestion ? "← Back to site" : "Back"}
            </button>
            <button
              className="borrower-primary-btn"
              type="button"
              disabled={!canContinue}
              onClick={onContinue}
            >
              Continue
            </button>
          </footer>
        </section>
      </div>
    </main>
  );
}
