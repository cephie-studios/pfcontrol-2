export interface AirportFrequencies {
  APP?: string;
  TWR?: string;
  GND?: string;
  DEL?: string;
  [key: string]: string | undefined;
}

export type Runway = string;
export type Sid = string;
export type Star = string;

export type DepartureMap = Record<string, string>;
export type ArrivalsMap = Record<string, string>;

export interface Airport {
  icao: string;
  name: string;
  controlName?: string;
  elevation?: number;
  picture: string;
  allFrequencies: AirportFrequencies;
  sids: Sid[];
  sidWaypoints?: Record<string, string[]>;
  runways: Runway[];
  departures: Record<Runway, DepartureMap>;
  stars: Star[];
  starWaypoints?: Record<string, string[]>;
  arrivals: Record<Runway, ArrivalsMap>;
  retired?: boolean;
}

export interface AirportFrequency {
  icao: string;
  name: string;
  APP?: string;
  TWR?: string;
  GND?: string;
  DEL?: string;
  [key: string]: string | undefined;
}
