import { Plane } from 'lucide-react';
import type { Flight } from '../../types/flight';
import type { FlightLogItem } from '../../utils/fetch/flights';
import {
  computeDepArrTiming,
  getDisplayStatus,
} from '../../utils/flightTiming';

interface FlightTimingBlockProps {
  flight: Flight;
  logs: FlightLogItem[];
}

const formatTime = (iso: string) => {
  if (!iso) return '--:--';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatDate = (iso: string) => {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export default function FlightTimingBlock({
  flight,
  logs,
}: FlightTimingBlockProps) {
  const { departure, arrival } = computeDepArrTiming(flight, logs);
  const dateLabel = formatDate(departure.time);

  return (
    <div className="bg-zinc-900 rounded-2xl px-5 py-4 -mt-4 relative z-10">
      {dateLabel && (
        <div className="text-center mb-3">
          <span className="text-xs font-mono text-zinc-400 ml-1.5">
            {dateLabel}
          </span>
        </div>
      )}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div>
          <div className="text-4xl font-extrabold font-mono text-white">
            {flight.departure || '----'}
          </div>
          <div className="text-xs text-zinc-500 mt-1.5">{departure.label}</div>
          <div className="text-lg font-bold font-mono text-zinc-100">
            {formatTime(departure.time)}
          </div>
        </div>

        <div className="flex flex-col items-center gap-1.5">
          <Plane className="h-4 w-4 text-zinc-500 rotate-45" />
          <div className="flex items-center gap-1.5 text-xs font-mono text-zinc-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
            {getDisplayStatus(flight.status)}
          </div>
        </div>

        <div className="text-right">
          <div className="text-4xl font-extrabold font-mono text-white">
            {flight.arrival || '----'}
          </div>
          <div className="text-xs text-zinc-500 mt-1.5">
            {arrival?.label ?? '—'}
          </div>
          <div
            className={`text-lg font-bold font-mono ${arrival ? 'text-zinc-100' : 'text-zinc-600'}`}
          >
            {arrival ? formatTime(arrival.time) : '--:--'}
          </div>
        </div>
      </div>
    </div>
  );
}
