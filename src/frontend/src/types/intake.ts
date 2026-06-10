export type IntakePurpose = "purchase" | "refinance" | "explore";
export type IntakePropertyType = "primary" | "investment" | "second_home";
export type IntakeIncomeType =
  | "w2"
  | "self_employed"
  | "rental"
  | "assets"
  | "retired"
  | "foreign_national";
export type IntakeCreditRange =
  | "580_619"
  | "620_659"
  | "660_699"
  | "700_739"
  | "740_plus";
export type IntakeTimeline =
  | "now"
  | "1_3_months"
  | "3_6_months"
  | "just_exploring";
export type MatchStrength = "strong" | "possible" | "unlikely";
export type IntakeStatus = "idle" | "in_progress" | "complete" | "submitted";

export type IntakeQuestionKey =
  | "purpose"
  | "property_type"
  | "income_type"
  | "income_context"
  | "credit_range"
  | "loan_amount"
  | "timeline";

export type IntakeAnswers = {
  purpose?: IntakePurpose;
  property_type?: IntakePropertyType;
  income_type?: IntakeIncomeType;
  income_context?: string;
  credit_range?: IntakeCreditRange;
  loan_amount?: number;
  timeline?: IntakeTimeline;
  "income_context.bank_statement_months"?: "12" | "24";
  "income_context.owns_rental_property"?: "yes" | "no";
  "income_context.monthly_rent"?: number;
  "income_context.asset_value_range"?: string;
  "income_context.has_us_itin"?: "yes" | "no";
};

export type ProgramRecommendation = {
  program_key: string;
  rank: number;
  match_strength: MatchStrength;
  title: string;
  tagline: string;
  rate_range_label: string;
  doc_requirements: string[];
  suitability_note: string;
  disqualified: boolean;
};

export type IntakeSession = {
  sessionId: string | null;
  answers: IntakeAnswers;
  currentQuestion: IntakeQuestionKey | null;
  results: ProgramRecommendation[] | null;
  status: IntakeStatus;
};

export type IntakeSessionResponse = {
  id: string;
  created_at: string;
};

export type IntakeHandoffResponse = {
  handoff_id: string;
};
