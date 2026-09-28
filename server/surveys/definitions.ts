import crypto from 'crypto';

export interface SurveyQuestion {
  id: string;
  text: string;
}

export interface SurveyDefinition {
  id: string;
  title: string;
  description: string;
  active: boolean;
  questions: SurveyQuestion[];
}

export const SURVEY_LIMITS = {
  title: 120,
  description: 500,
  questionText: 300,
  maxQuestions: 10,
} as const;

export const SEED_SURVEYS: SurveyDefinition[] = [
  {
    id: 'scope-usage-2026-09',
    title: 'Help us shape PFControl',
    description:
      "We're working out how PFControl should fit alongside other controlling tools, and we'd like your input.",
    active: true,
    questions: [
      {
        id: 'heard_of_veyra',
        text: 'Have you heard of a scope called "Veyra"?',
      },
      {
        id: 'controls_with_veyra',
        text: 'Are you using Veyra to control?',
      },
      {
        id: 'uses_pfcontrol_acars',
        text: "When you fly, do you use PFControl's ACARS / PDC?",
      },
    ],
  },
];

export function newSurveyId(): string {
  return `survey-${crypto.randomBytes(5).toString('hex')}`;
}

function newQuestionId(): string {
  return `q_${crypto.randomBytes(4).toString('hex')}`;
}

export type SurveyInput = Pick<
  SurveyDefinition,
  'title' | 'description' | 'questions'
>;

export function validateSurveyInput(
  raw: unknown
): { ok: true; value: SurveyInput } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Invalid survey' };
  }
  const input = raw as Record<string, unknown>;
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  const description =
    typeof input.description === 'string' ? input.description.trim() : '';
  if (!title || title.length > SURVEY_LIMITS.title) {
    return {
      ok: false,
      error: `Title is required (max ${SURVEY_LIMITS.title} characters).`,
    };
  }
  if (description.length > SURVEY_LIMITS.description) {
    return {
      ok: false,
      error: `Description is too long (max ${SURVEY_LIMITS.description} characters).`,
    };
  }
  if (
    !Array.isArray(input.questions) ||
    input.questions.length === 0 ||
    input.questions.length > SURVEY_LIMITS.maxQuestions
  ) {
    return {
      ok: false,
      error: `A survey needs 1 to ${SURVEY_LIMITS.maxQuestions} questions.`,
    };
  }

  const seen = new Set<string>();
  const questions: SurveyQuestion[] = [];
  for (const q of input.questions as unknown[]) {
    const item = (q ?? {}) as Record<string, unknown>;
    const text = typeof item.text === 'string' ? item.text.trim() : '';
    if (!text || text.length > SURVEY_LIMITS.questionText) {
      return {
        ok: false,
        error: `Every question needs text (max ${SURVEY_LIMITS.questionText} characters).`,
      };
    }
    let id =
      typeof item.id === 'string' && /^[a-z0-9_-]{1,64}$/i.test(item.id)
        ? item.id
        : newQuestionId();
    while (seen.has(id)) id = newQuestionId();
    seen.add(id);
    questions.push({ id, text });
  }

  return { ok: true, value: { title, description, questions } };
}

export function validateSurveyAnswers(
  survey: Pick<SurveyDefinition, 'questions'>,
  raw: unknown
): Record<string, boolean> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const input = raw as Record<string, unknown>;
  const answers: Record<string, boolean> = {};
  for (const q of survey.questions) {
    if (typeof input[q.id] !== 'boolean') return null;
    answers[q.id] = input[q.id] as boolean;
  }
  return answers;
}

export const SURVEY_DURATION_MAX_MS = 60 * 60 * 1000;
export const SURVEY_FULL_WEIGHT_MS_PER_QUESTION = 1500;
export const SURVEY_MIN_WEIGHT = 0.1;

export function parseSurveyDuration(raw: unknown): number | null {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) return null;
  return Math.min(Math.round(raw), SURVEY_DURATION_MAX_MS);
}

export function surveyResponseWeight(
  durationMs: number | null,
  questionCount: number
): number {
  if (durationMs == null || questionCount <= 0) return 1;
  const perQuestion = durationMs / questionCount;
  return Math.max(
    SURVEY_MIN_WEIGHT,
    Math.min(1, perQuestion / SURVEY_FULL_WEIGHT_MS_PER_QUESTION)
  );
}

export function publicSurvey(survey: SurveyDefinition) {
  return {
    id: survey.id,
    title: survey.title,
    description: survey.description,
    questions: survey.questions,
  };
}
