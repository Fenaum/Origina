import { create } from "zustand";
import { createJSONStorage, devtools, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { getNextQuestion } from "@/data/questions";
import { rankMockPrograms } from "@/data/programs";
import {
  createIntakeSession,
  fetchIntakeResults,
  saveIntakeAnswer,
  submitIntakeHandoff,
} from "@/services/intakeService";
import type {
  IntakeAnswers,
  IntakeQuestionKey,
  IntakeStatus,
  ProgramRecommendation,
} from "@/types/intake";

type IntakeStore = {
  sessionId: string | null;
  answers: IntakeAnswers;
  currentQuestion: IntakeQuestionKey | null;
  visitedQuestions: IntakeQuestionKey[];
  results: ProgramRecommendation[] | null;
  status: IntakeStatus;
  error: string | null;
  startSession: () => Promise<void>;
  answer: (questionKey: string, value: string | number) => Promise<void>;
  advance: () => void;
  back: () => void;
  fetchResults: () => Promise<void>;
  submitHandoff: (email: string, name: string) => Promise<void>;
  reset: () => void;
};

const initialState = {
  sessionId: null,
  answers: {},
  currentQuestion: "purpose" as IntakeQuestionKey,
  visitedQuestions: [] as IntakeQuestionKey[],
  results: null,
  status: "idle" as IntakeStatus,
  error: null,
};

export const useIntakeStore = create<IntakeStore>()(
  devtools(
    persist(
      immer((set, get) => ({
        ...initialState,
        startSession: async () => {
          set((state) => {
            state.status = "in_progress";
            state.error = null;
            state.currentQuestion = getNextQuestion(state.answers) ?? "purpose";
          });

          if (get().sessionId) return;

          try {
            const session = await createIntakeSession();
            set((state) => {
              state.sessionId = session.id;
            });
          } catch {
            set((state) => {
              state.error = null;
            });
          }
        },
        answer: async (questionKey, value) => {
          set((state) => {
            if (questionKey === "income_type") {
              delete state.answers.income_context;
              delete state.answers["income_context.bank_statement_months"];
              delete state.answers["income_context.owns_rental_property"];
              delete state.answers["income_context.monthly_rent"];
              delete state.answers["income_context.asset_value_range"];
              delete state.answers["income_context.has_us_itin"];
            }
            state.answers = {
              ...state.answers,
              [questionKey]: value,
            };
            state.status = "in_progress";
          });

          const sessionId = get().sessionId;
          if (!sessionId) return;

          try {
            await saveIntakeAnswer(sessionId, questionKey, value);
          } catch {
            set((state) => {
              state.error = "Your answer is saved in this browser. We could not sync it yet.";
            });
          }
        },
        advance: () =>
          set((state) => {
            const current = state.currentQuestion;
            const next = getNextQuestion(state.answers);

            if (current && (!state.visitedQuestions.length || state.visitedQuestions.at(-1) !== current)) {
              state.visitedQuestions.push(current);
            }

            if (!next) {
              state.currentQuestion = null;
              state.status = "complete";
              return;
            }

            state.currentQuestion = next;
          }),
        back: () =>
          set((state) => {
            const previous = state.visitedQuestions.pop();
            if (previous) {
              state.currentQuestion = previous;
              state.status = "in_progress";
            }
          }),
        fetchResults: async () => {
          set((state) => {
            state.error = null;
          });

          const { sessionId, answers } = get();
          try {
            const results = sessionId
              ? await fetchIntakeResults(sessionId, answers)
              : rankMockPrograms(answers);
            set((state) => {
              state.results = results;
              state.status = "complete";
            });
          } catch {
            set((state) => {
              state.results = rankMockPrograms(state.answers);
              state.status = "complete";
            });
          }
        },
        submitHandoff: async (email, name) => {
          const { sessionId } = get();
          if (!sessionId) {
            set((state) => {
              state.status = "submitted";
            });
            return;
          }

          await submitIntakeHandoff(sessionId, name, email);
          set((state) => {
            state.status = "submitted";
          });
        },
        reset: () => set(initialState),
      })),
      {
        name: "origina.borrower.intake",
        storage: createJSONStorage(() => sessionStorage),
        partialize: (state) => ({
          sessionId: state.sessionId,
          answers: state.answers,
          currentQuestion: state.currentQuestion,
          visitedQuestions: state.visitedQuestions,
          results: state.results,
          status: state.status,
        }),
      },
    ),
    { name: "origina-intake" },
  ),
);
