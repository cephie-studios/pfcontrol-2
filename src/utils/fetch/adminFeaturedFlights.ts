import { apiFetch } from '../apiFetch.js';
import { apiError } from './error.js';

const API_BASE_URL = import.meta.env.VITE_SERVER_URL;

export interface AdminFeaturedFlight {
  id: string;
  userId: string;
  username: string;
  avatar: string | null;
  callsign: string | null;
  departure: string | null;
  arrival: string | null;
  aircraft: string | null;
  status: string | null;
  snapImages: { cephie_id: string; url: string }[];
  createdAt: string;
  updatedAt: string;
}

export async function fetchAdminFeaturedFlights(): Promise<{
  flights: AdminFeaturedFlight[];
}> {
  const res = await apiFetch(`${API_BASE_URL}/api/admin/featured-flights`, {
    credentials: 'include',
  });
  if (!res.ok) await apiError(res, 'Failed to load featured flights');
  return res.json();
}

export async function adminUnfeatureFlight(
  userId: string,
  flightId: string
): Promise<void> {
  const res = await apiFetch(
    `${API_BASE_URL}/api/admin/featured-flights/${encodeURIComponent(userId)}/${encodeURIComponent(flightId)}/unfeature`,
    { method: 'POST', credentials: 'include' }
  );
  if (!res.ok) await apiError(res, 'Failed to unfeature flight');
}

export async function adminDeleteFeaturedFlightImage(
  userId: string,
  flightId: string,
  cephieId: string
): Promise<void> {
  const res = await apiFetch(
    `${API_BASE_URL}/api/admin/featured-flights/${encodeURIComponent(userId)}/${encodeURIComponent(flightId)}/images/${encodeURIComponent(cephieId)}`,
    { method: 'DELETE', credentials: 'include' }
  );
  if (!res.ok) await apiError(res, 'Failed to delete image');
}
