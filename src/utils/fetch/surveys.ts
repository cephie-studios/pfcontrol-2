import { apiFetch } from '../apiFetch.js';
import { apiError } from './error.js';

const API_BASE_URL = import.meta.env.VITE_SERVER_URL;

export interface SurveyQuestion {
  id: string;
  text: string;
}

export interface Survey {
  id: string;
  title: string;
  description: string;
  questions: SurveyQuestion[];
}

export async function fetchActiveSurvey(): Promise<Survey | null> {
  const res = await apiFetch(`${API_BASE_URL}/api/surveys/active`, {
    credentials: 'include',
  });
  if (!res.ok) await apiError(res, 'Failed to load survey');
  const data = (await res.json()) as { survey: Survey | null };
  return data.survey;
}

export async function submitSurveyResponse(
  surveyId: string,
  answers: Record<string, boolean>,
  durationMs: number | null
): Promise<void> {
  const res = await apiFetch(
    `${API_BASE_URL}/api/surveys/${encodeURIComponent(surveyId)}/responses`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers, durationMs }),
    }
  );
  if (!res.ok) await apiError(res, 'Failed to save your answers');
}
