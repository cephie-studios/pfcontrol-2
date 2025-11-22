import { useContext, createContext } from 'react';
import type { Airport, AirportFrequency } from '../../types/airports';
import type { Aircraft } from '../../types/aircraft';
import type { Airline } from '../../types/airlines';

interface DataContextType {
  airports: Airport[];
  aircrafts: Aircraft[];
  airlines: Airline[];
  frequencies: AirportFrequency[];
  airportRunways: Record<string, string[]>;
  airportSids: Record<string, string[]>;
  loading: boolean;
  error: string | null;
  fetchAirportData: (icao: string) => Promise<void>;
  fetchedAirports: Set<string>;
}

export const DataContext = createContext<DataContextType | null>(null);

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
