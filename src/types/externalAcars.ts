export interface ProviderMessage {
  id: string;
  created_at?: string;
  direction: 'uplink' | 'downlink';
  sender?: string;
  body?: string;
  lines?: string[];
  state?: 'open' | 'closed';
  min?: number;
  element?: string;
  response_attr?: string;
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
  clearance?: { cleared?: boolean } | null;
  transponder?: { squawk?: string | null } | null;
}

export interface ProviderDatalink {
  state: string;
  station?: string;
  controller?: string;
  suspended?: boolean;
  suspended_reason?: string;
  messages?: ProviderMessage[];
}

export interface ProviderAtis {
  airport: string;
  letter: string;
  text: string;
}

export interface ProviderStatus {
  pfcontrol?: { claimUrl: string };
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
  valid: boolean;
  reason?: string | null;
  route?: string | null;
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
