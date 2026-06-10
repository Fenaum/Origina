import { rankMockPrograms } from "@/data/programs";
import { apiRequest } from "@/services/apiClient";
import type {
  IntakeAnswers,
  IntakeHandoffResponse,
  IntakeSessionResponse,
  ProgramRecommendation,
} from "@/types/intake";

export async function createIntakeSession(): Promise<IntakeSessionResponse> {
  return apiRequest<IntakeSessionResponse>("/intake/sessions", { method: "POST" });
}

export async function saveIntakeAnswer(
  sessionId: string,
  questionKey: string,
  value: string | number,
): Promise<void> {
  await apiRequest("/intake/sessions/" + sessionId + "/answers", {
    method: "POST",
    body: JSON.stringify({
      question_key: questionKey,
      value,
    }),
  });
}

export async function fetchIntakeResults(
  sessionId: string,
  answers: IntakeAnswers,
): Promise<ProgramRecommendation[]> {
  try {
    return await apiRequest<ProgramRecommendation[]>("/intake/sessions/" + sessionId + "/results");
  } catch {
    return rankMockPrograms(answers);
  }
}

export async function submitIntakeHandoff(
  sessionId: string,
  name: string,
  email: string,
): Promise<IntakeHandoffResponse> {
  return apiRequest<IntakeHandoffResponse>("/intake/sessions/" + sessionId + "/handoff", {
    method: "POST",
    body: JSON.stringify({ name, email }),
  });
}
