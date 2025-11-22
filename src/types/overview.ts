import type { Flight } from './flight';

export interface OverviewSession {
  sessionId: string;
  airportIcao: string;
  activeRunway?: string;
  createdAt: string;
  createdBy: string;
  isPFATC: boolean;
  activeUsers: number;
  flights: Flight[];
  flightCount: number;
}

export interface OverviewData {
  activeSessions: OverviewSession[];
  totalActiveSessions: number;
  totalFlights: number;
  arrivalsByAirport: Record<
    string,
    (Flight & { sessionId: string; departureAirport: string })[]
  >;
  lastUpdated: string;
}
