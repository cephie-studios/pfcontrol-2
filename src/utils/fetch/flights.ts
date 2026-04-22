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

export async function fetchMyFlights(): Promise<Flight[]> {
  const res = await fetch(`${API_BASE_URL}/api/flights/me/list`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch your flights');
  return res.json();
}

export async function claimSubmittedFlight(
  sessionId: string,
  flightId: string,
  acarsToken: string
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/flights/claim`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, flightId, acarsToken }),
  });

  if (!res.ok) {
    throw new Error('Failed to claim submitted flight');
  }
}

export async function fetchMyFlightById(flightId: string): Promise<Flight> {
  const res = await fetch(`${API_BASE_URL}/api/flights/me/${flightId}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch flight');
  return res.json();
}

export interface FlightLogItem {
  id: number;
  action: 'add' | 'update' | 'delete';
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
}

export interface MyFlightLogsResponse {
  logs: FlightLogItem[];
  logsDiscardedDueToAge: boolean;
}

export async function fetchMyFlightLogs(
  flightId: string
): Promise<MyFlightLogsResponse> {
  const res = await fetch(`${API_BASE_URL}/api/flights/me/${flightId}/logs`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch flight logs');
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

export async function updateFlightNotes(
  flightId: string,
  notes: string
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/flights/me/${flightId}/notes`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes }),
  });
  if (!res.ok) throw new Error('Failed to save notes');
}
