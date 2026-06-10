import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect } from "react";
import { IntakeShell } from "@/components/borrower/IntakeShell";
import { CreditRangeQuestion } from "@/components/borrower/questions/CreditRangeQuestion";
import { IncomeContextQuestion } from "@/components/borrower/questions/IncomeContextQuestion";
import { IncomeTypeQuestion } from "@/components/borrower/questions/IncomeTypeQuestion";
import { LoanAmountQuestion } from "@/components/borrower/questions/LoanAmountQuestion";
import { PropertyTypeQuestion } from "@/components/borrower/questions/PropertyTypeQuestion";
import { PurposeQuestion } from "@/components/borrower/questions/PurposeQuestion";
import { TimelineQuestion } from "@/components/borrower/questions/TimelineQuestion";
import { useIntakeStore } from "@/state/intakeStore";
import type {
  IntakeCreditRange,
  IntakeIncomeType,
  IntakePropertyType,
  IntakePurpose,
  IntakeQuestionKey,
  IntakeTimeline,
} from "@/types/intake";

export default function BorrowerIntakePage() {
  const router = useRouter();
  const {
    answers,
    currentQuestion,
    visitedQuestions,
    status,
    startSession,
    answer,
    advance,
    back,
    fetchResults,
  } = useIntakeStore();

  useEffect(() => {
    if (status === "idle") {
      void startSession();
    }
  }, [startSession, status]);

  useEffect(() => {
    if (status === "complete") {
      void fetchResults().then(() => router.push("/borrower/results"));
    }
  }, [fetchResults, router, status]);

  if (!currentQuestion) {
    return <div className="centered-screen">Preparing your results...</div>;
  }

  const canContinue = Boolean(answers[currentQuestion]);

  return (
    <>
      <Head>
        <title>Borrower Intake | Origina</title>
      </Head>
      <IntakeShell
        answers={answers}
        currentQuestion={currentQuestion}
        canContinue={canContinue}
        isFirstQuestion={visitedQuestions.length === 0}
        onBack={() => {
          if (visitedQuestions.length === 0) {
            void router.push("/borrower/welcome");
          } else {
            back();
          }
        }}
        onContinue={advance}
      >
        <QuestionRenderer
          currentQuestion={currentQuestion}
          answers={answers}
          onAnswer={(key, value) => {
            void answer(key, value);
          }}
        />
      </IntakeShell>
    </>
  );
}

function QuestionRenderer({
  currentQuestion,
  answers,
  onAnswer,
}: {
  currentQuestion: IntakeQuestionKey;
  answers: ReturnType<typeof useIntakeStore.getState>["answers"];
  onAnswer: (key: string, value: string | number) => void;
}) {
  if (currentQuestion === "purpose") {
    return (
      <PurposeQuestion
        value={answers.purpose}
        onAnswer={(value: IntakePurpose) => onAnswer("purpose", value)}
      />
    );
  }
  if (currentQuestion === "property_type") {
    return (
      <PropertyTypeQuestion
        value={answers.property_type}
        onAnswer={(value: IntakePropertyType) => onAnswer("property_type", value)}
      />
    );
  }
  if (currentQuestion === "income_type") {
    return (
      <IncomeTypeQuestion
        value={answers.income_type}
        onAnswer={(value: IntakeIncomeType) => onAnswer("income_type", value)}
      />
    );
  }
  if (currentQuestion === "income_context") {
    return <IncomeContextQuestion answers={answers} onAnswer={onAnswer} />;
  }
  if (currentQuestion === "credit_range") {
    return (
      <CreditRangeQuestion
        value={answers.credit_range}
        onAnswer={(value: IntakeCreditRange) => onAnswer("credit_range", value)}
      />
    );
  }
  if (currentQuestion === "loan_amount") {
    return (
      <LoanAmountQuestion
        value={answers.loan_amount}
        onAnswer={(value: number) => onAnswer("loan_amount", value)}
      />
    );
  }
  return (
    <TimelineQuestion
      value={answers.timeline}
      onAnswer={(value: IntakeTimeline) => onAnswer("timeline", value)}
    />
  );
}
