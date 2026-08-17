import { apiFetch } from '../apiFetch.js';
import { apiError } from './error.js';

export async function submitControllerRating(
  controllerId: string,
  rating: number,
  flightId?: string,
  sessionId?: string,
  comment?: string
) {
  const response = await apiFetch(
    `${import.meta.env.VITE_SERVER_URL}/api/ratings`,
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        controllerId,
        rating,
        flightId,
        sessionId,
        comment,
      }),
    }
  );

  if (!response.ok) {
    await apiError(response, 'Failed to submit rating');
  }

  return response.json();
}

export interface MyControllerRating {
  id: number;
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface MyControllerRatingsResponse {
  ratings: MyControllerRating[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface MyControllerRatingStats {
  averageRating: number;
  ratingCount: number;
}

export interface MyDailyRatingStats {
  date: string;
  count: number;
  avg_rating: number;
}

async function ratingsRequest(path: string) {
  const response = await apiFetch(
    `${import.meta.env.VITE_SERVER_URL}/api/ratings${path}`,
    { credentials: 'include' }
  );

  if (!response.ok) {
    await apiError(response, 'Failed to fetch ratings');
  }

  return response.json();
}

export async function fetchMyRatings(
  page: number = 1,
  limit: number = 20
): Promise<MyControllerRatingsResponse> {
  return ratingsRequest(`/mine?page=${page}&limit=${limit}`);
}

export async function fetchMyRatingStats(): Promise<MyControllerRatingStats> {
  return ratingsRequest('/mine/stats');
}

export async function fetchMyRatingsDaily(
  days: number = 30
): Promise<MyDailyRatingStats[]> {
  return ratingsRequest(`/mine/daily?days=${days}`);
}
