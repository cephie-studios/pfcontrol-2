import type { Airport, AirportFrequency } from '../../types/airports';
import type { Aircraft } from '../../types/aircraft';
import type { Airline } from '../../types/airlines';
import type { TesterSettings } from './testers';
import type { Notification as AdminNotification } from '../fetch/admin';

interface AvailableImage {
  filename: string;
  path: string;
  extension: string;
}

async function fetchData<T>(endpoint: string): Promise<T[]> {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_SERVER_URL}/api/data/${endpoint}`
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Error fetching ${endpoint}:`, error);
    return [];
  }
}

export function fetchAirports(): Promise<Airport[]> {
  return fetchData<Airport>('airports');
}

export function fetchAircrafts(): Promise<Aircraft[]> {
  return fetchData<Aircraft>('aircrafts');
}

export function fetchAirlines(): Promise<Airline[]> {
  return fetchData<Airline>('airlines');
}

export function fetchFrequencies(): Promise<AirportFrequency[]> {
  return fetchData<AirportFrequency>('frequencies');
}

export function fetchRunways(icao: string): Promise<string[]> {
  return fetchData<string>(`airports/${icao}/runways`);
}

export function fetchSids(icao: string): Promise<string[]> {
  return fetchData<string>(`airports/${icao}/sids`);
}

export function fetchStars(icao: string): Promise<string[]> {
  return fetchData<string>(`airports/${icao}/stars`);
}

export function fetchBackgrounds(): Promise<AvailableImage[]> {
  return fetchData<AvailableImage>('backgrounds');
}

export function fetchStatistics(): Promise<string[]> {
  return fetchData<string>('statistics');
}

export async function fetchLeaderboard(): Promise<
  Record<
    string,
    Array<{
      userId: string;
      username: string;
      score: number;
      avatar: string | null;
    }>
  >
> {
  const response = await fetch(
    `${import.meta.env.VITE_SERVER_URL}/api/data/leaderboard`
  );
  if (!response.ok) throw new Error('Failed to fetch leaderboard');
  return response.json();
}

export async function getTesterSettings(): Promise<TesterSettings> {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_SERVER_URL}/api/data/settings`
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const settings: TesterSettings = await response.json();
    return settings;
  } catch (error) {
    console.error('Error fetching tester settings:', error);
    return { tester_gate_enabled: true };
  }
}

export async function fetchActiveNotifications(): Promise<AdminNotification[]> {
  const response = await fetch(
    `${import.meta.env.VITE_SERVER_URL}/api/data/notifications/active`
  );
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return await response.json();
}

export async function fetchGlobalHolidayStatus(): Promise<{
  enabled: boolean;
}> {
  const response = await fetch(
    `${import.meta.env.VITE_SERVER_URL}/api/data/holiday-enabled`
  );
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return await response.json();
}
