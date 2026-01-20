export async function submitControllerRating(controllerId: string, rating: number, flightId?: string) {
  const response = await fetch(`${import.meta.env.VITE_SERVER_URL}/api/ratings`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ controllerId, rating, flightId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to submit rating');
  }

  return response.json();
}
