export interface ProviderMessage {
  id: string;
  created_at?: string;
  responded_at?: string | null;
  direction: 'uplink' | 'downlink';
  sender?: string;
  body?: string;
  lines?: string[];
  state?: 'sending' | 'sent' | 'open' | 'closed' | 'timeout' | 'error';
  min?: number;
  mrn?: number | null;
  element?: string;
  response_attr?: 'W/U' | 'A/N' | 'R' | 'N' | 'Y' | string;
}

export interface ProviderClearance {
  assigned_squawk?: string | null;
  cleared_flight_level?: number | null;
  sector_exit_flight_level?: number | null;
  assigned_heading?: number | null;
  assigned_speed?: number | null;
  direct_to?: string | null;
  cleared?: boolean;
  status?: string;
  stand?: string | null;
  departure_sequence?: number;
  arrival_sequence?: number;
}

export interface ProviderFlight {
  callsign: string;
  controller?: string | null;
  aircraft_type?: string | null;
  flight_rules?: string | null;
  departure_airport?: string | null;
  destination_airport?: string | null;
  requested_flight_level?: number | null;
  route?: string | null;
  alternate?: string | null;
  runway?: string | null;
  sid?: string | null;
  star?: string | null;
  clearance?: ProviderClearance | null;
  transponder?: { squawk?: string | null } | null;
  stale?: boolean;
  updated_at?: string;
  filed_at?: string;
  expires_at?: string;
}

export interface ProviderDatalink {
  state: '' | 'logon_pending' | 'connected' | string;
  station?: string;
  controller?: string;
  suspended?: boolean;
  suspended_reason?: string;
  suspended_until?: string;
  messages?: ProviderMessage[];
}

export interface ProviderAtis {
  airport: string;
  letter: string;
  text: string;
}

export interface ProviderStatus {
  pfcontrol?: { claimUrl: string };
  callsign?: string;
  online?: boolean;
  flight?: ProviderFlight | null;
  filing?: ProviderFlight | null;
  datalink?: ProviderDatalink | null;
  controllers?: string[];
  atis?: ProviderAtis[];
}

export interface ProviderResult {
  delivered: boolean;
  route?: string;
}

export interface ProviderRoute {
  filed_route?: string | null;
  valid: boolean;
  reason?: string | null;
  route?: string | null;
  sid?: string | null;
  star?: string | null;
  runway?: string | null;
  distance_nm?: number | null;
  amendable: boolean;
}

export type ProviderRequest = <T>(
  path: string,
  options?: { body?: Record<string, unknown>; signal?: AbortSignal }
) => Promise<T>;

export type ProviderCommand = (
  path: string,
  options?: {
    body?: Record<string, unknown>;
    success?: string;
    silent?: boolean;
  }
) => Promise<ProviderResult | null>;
