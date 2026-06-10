import type { IntakeAnswers, IntakeQuestionKey } from "@/types/intake";

export const questionOrder: IntakeQuestionKey[] = [
  "purpose",
  "property_type",
  "income_type",
  "income_context",
  "credit_range",
  "loan_amount",
  "timeline",
];

export const questionLabels: Record<IntakeQuestionKey, string> = {
  purpose: "Goal",
  property_type: "Property",
  income_type: "Income",
  income_context: "Context",
  credit_range: "Credit",
  loan_amount: "Loan amount",
  timeline: "Timeline",
};

export function getNextQuestion(answers: IntakeAnswers): IntakeQuestionKey | null {
  if (!answers.purpose) return "purpose";
  if (!answers.property_type) return "property_type";
  if (!answers.income_type) return "income_type";
  if (!answers.income_context) return "income_context";
  if (!answers.credit_range) return "credit_range";
  if (!answers.loan_amount) return "loan_amount";
  if (!answers.timeline) return "timeline";
  return null;
}

export function getProgressPercent(answers: IntakeAnswers): number {
  const answered = questionOrder.filter((key) => Boolean(answers[key])).length;
  return Math.round((answered / questionOrder.length) * 100);
}
