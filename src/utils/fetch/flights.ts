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
  username: string;
  user_id: string;
  avatar_url: string | null;
}

export interface MyFlightLogsResponse {
  logs: FlightLogItem[];
  logsDiscardedDueToAge: boolean;
  pilotUserId?: string;
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

export async function fetchPublicFlight(flightId: string): Promise<Flight> {
  const res = await fetch(`${API_BASE_URL}/api/flights/public/${flightId}`);
  if (!res.ok) throw new Error('Failed to fetch public flight');
  return res.json();
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

export interface SnapImage {
  cephie_id: string;
  url: string;
}

export async function uploadSnapImage(
  flightId: string,
  file: File
): Promise<{ url: string; cephie_id: string; snap_images: SnapImage[] }> {
  const formData = new FormData();
  formData.append('image', file);
  const res = await fetch(`${API_BASE_URL}/api/flights/me/${flightId}/snap`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });
  if (!res.ok) throw new Error('Failed to upload snap');
  return res.json();
}

export async function deleteSnapImage(
  flightId: string,
  cephieId: string
): Promise<void> {
  const res = await fetch(
    `${API_BASE_URL}/api/flights/me/${flightId}/snap/${encodeURIComponent(cephieId)}`,
    {
      method: 'DELETE',
      credentials: 'include',
    }
  );
  if (!res.ok) throw new Error('Failed to delete snap');
}

export async function toggleFeaturedOnProfile(
  flightId: string
): Promise<{ featured: boolean }> {
  const res = await fetch(`${API_BASE_URL}/api/flights/me/${flightId}/feature`, {
    method: 'PATCH',
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to toggle featured status');
  return res.json();
}
