import type { Flight } from '../types/flight';
import type { FlightLogItem } from './fetch/flights';

export interface TimingPoint {
  label: string;
  time: string;
}

export interface DepArrTiming {
  departure: TimingPoint;
  arrival: TimingPoint | null;
}

const ARRIVAL_MILESTONE_LABEL: Record<string, string> = {
  RWY_ARRV: 'Runway',
  TAXI_ARRV: 'Taxi',
  GATE: 'Gate',
};

function statusLogTime(
  logs: FlightLogItem[],
  status: string
): string | undefined {
  return logs.find((log) => log.new_data?.status === status)?.created_at;
}

export function computeDepArrTiming(
  flight: Flight,
  logs: FlightLogItem[]
): DepArrTiming {
  const pushTime = statusLogTime(logs, 'PUSH');
  const departure: TimingPoint = pushTime
    ? { label: 'Push', time: pushTime }
    : { label: 'Created', time: flight.created_at ?? '' };

  const status = flight.status;
  const arrivalLabel = status ? ARRIVAL_MILESTONE_LABEL[status] : undefined;
  const arrival: TimingPoint | null = arrivalLabel
    ? {
        label: arrivalLabel,
        time: statusLogTime(logs, status as string) ?? flight.updated_at ?? '',
      }
    : null;

  return { departure, arrival };
}

export function getDisplayStatus(status?: string): string {
  if (!status) return 'PENDING';
  if (status === 'TAXI_ORIG' || status === 'TAXI_ARRV') return 'TAXI';
  if (status === 'RWY_ORIG' || status === 'RWY_ARRV') return 'RWY';
  return status;
}
