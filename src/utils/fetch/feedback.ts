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
  const res = await fetch(`${API_BASE_URL}/api/feedback`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rating, comment }),
  });

  if (!res.ok) {
    throw new Error('Failed to submit feedback');
  }

  return res.json();
}

export async function fetchFeedback(): Promise<Feedback[]> {
  const res = await fetch(`${API_BASE_URL}/api/admin/feedback`, {
    credentials: 'include',
  });

  if (!res.ok) {
    throw new Error('Failed to fetch feedback');
  }

  return res.json();
}

export async function fetchFeedbackStats(): Promise<FeedbackStats> {
  const res = await fetch(`${API_BASE_URL}/api/admin/feedback/stats`, {
    credentials: 'include',
  });

  if (!res.ok) {
    throw new Error('Failed to fetch feedback stats');
  }

  return res.json();
}

export async function deleteFeedback(id: number): Promise<Feedback> {
  const res = await fetch(`${API_BASE_URL}/api/admin/feedback/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!res.ok) {
    throw new Error('Failed to delete feedback');
  }

  return res.json();
}
