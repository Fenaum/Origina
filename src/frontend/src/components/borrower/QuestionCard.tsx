import type { ReactNode } from "react";

type QuestionCardProps = {
  eyebrow: string;
  title: string;
  note?: string;
  children: ReactNode;
};

export function QuestionCard({ eyebrow, title, note, children }: QuestionCardProps) {
  return (
    <section className="question-card">
      <span className="borrower-eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      {note ? <p className="question-note">{note}</p> : null}
      <div className="question-content">{children}</div>
    </section>
  );
}
