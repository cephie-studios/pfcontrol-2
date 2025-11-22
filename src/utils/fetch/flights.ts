import type { Flight } from '../../types/flight';

const API_BASE_URL = import.meta.env.VITE_SERVER_URL;

export async function fetchFlights(sessionId: string): Promise<Flight[]> {
  const res = await fetch(`${API_BASE_URL}/api/flights/${sessionId}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch flights');
  return res.json();
}

export async function addFlight(
  sessionId: string,
  flight: Partial<Flight>
): Promise<Flight> {
  const res = await fetch(`${API_BASE_URL}/api/flights/${sessionId}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(flight),
  });
  if (!res.ok) throw new Error('Failed to add flight');
  return res.json();
}

export async function updateFlight(
  sessionId: string,
  flightId: string | number,
  updates: Partial<Flight>
): Promise<Flight> {
  const res = await fetch(
    `${API_BASE_URL}/api/flights/${sessionId}/${flightId}`,
    {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    }
  );
  if (!res.ok) throw new Error('Failed to update flight');
  return res.json();
}

export async function deleteFlight(
  sessionId: string,
  flightId: string | number
): Promise<void> {
  const res = await fetch(
    `${API_BASE_URL}/api/flights/${sessionId}/${flightId}`,
    {
      method: 'DELETE',
      credentials: 'include',
    }
  );
  if (!res.ok) throw new Error('Failed to delete flight');
}
