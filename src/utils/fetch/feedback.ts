import { apiFetch } from '../apiFetch.js';
import { apiError } from './error.js';
export interface Feedback {
  id: number;
  user_id: string;
  username: string;
  rating: number;
  comment?: string;
  created_at: string;
  updated_at: string;
  avatar?: string;
}

export interface FeedbackStats {
  total_feedback: number;
  average_rating: number;
  five_star: number;
  four_star: number;
  three_star: number;
  two_star: number;
  one_star: number;
}

const API_BASE_URL = import.meta.env.VITE_SERVER_URL;

export async function submitFeedback(
  rating: number,
  comment?: string
): Promise<Feedback> {
  const res = await apiFetch(`${API_BASE_URL}/api/feedback`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rating, comment }),
  });

  if (!res.ok) {
    await apiError(res, 'Failed to submit feedback');
  }

  return res.json();
}

export interface FeedbackPage {
  feedback: Feedback[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export async function fetchFeedback({
  page = 1,
  limit = 25,
  search = '',
  rating,
  withText = false,
}: {
  page?: number;
  limit?: number;
  search?: string;
  rating?: number;
  withText?: boolean;
} = {}): Promise<FeedbackPage> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    ...(search && { search }),
    ...(rating !== undefined && { rating: rating.toString() }),
    ...(withText && { withText: 'true' }),
  });
  const res = await apiFetch(
    `${API_BASE_URL}/api/admin/feedback?${params.toString()}`,
    {
      credentials: 'include',
    }
  );

  if (!res.ok) {
    await apiError(res, 'Failed to fetch feedback');
  }

  return res.json();
}

export async function fetchFeedbackStats(): Promise<FeedbackStats> {
  const res = await apiFetch(`${API_BASE_URL}/api/admin/feedback/stats`, {
    credentials: 'include',
  });

  if (!res.ok) {
    await apiError(res, 'Failed to fetch feedback stats');
  }

  return res.json();
}

export async function deleteFeedback(id: number): Promise<Feedback> {
  const res = await apiFetch(`${API_BASE_URL}/api/admin/feedback/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!res.ok) {
    await apiError(res, 'Failed to delete feedback');
  }

  return res.json();
}
