import type { Flight } from '../../types/flight';
import DepartureTable from './DepartureTable';
import ArrivalsTable from './ArrivalsTable';

interface CombinedFlightsTableProps {
  departureFlights: Flight[];
  arrivalFlights: Flight[];
  onFlightDelete: (flightId: string | number) => void;
  onFlightChange?: (
    flightId: string | number,
    updates: Partial<Flight>
  ) => void;
  backgroundStyle?: React.CSSProperties;
  flashFlightId: string | null;
  onIssuePDC?: (
    flightId: string | number,
    pdcText: string
  ) => Promise<void> | void;
  onToggleClearance: (flightId: string | number, checked: boolean) => void;
  flashingPDCIds: Set<string>;
  setFlashingPDCIds: React.Dispatch<React.SetStateAction<Set<string>>>;
}

export default function CombinedFlightsTable({
  departureFlights,
  arrivalFlights,
  onFlightDelete,
  onFlightChange,
  onIssuePDC,
  backgroundStyle,
  flashFlightId,
  onToggleClearance,
  flashingPDCIds,
  setFlashingPDCIds,
}: CombinedFlightsTableProps) {
  return (
    <div className="space-y-12 mt-8">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2 px-4">
          Departures ({departureFlights.length})
        </h2>
        <DepartureTable
          flights={departureFlights}
          onFlightDelete={onFlightDelete}
          onFlightChange={onFlightChange ?? (() => {})}
          backgroundStyle={backgroundStyle}
          onIssuePDC={onIssuePDC}
          flashFlightId={flashFlightId}
          onToggleClearance={onToggleClearance}
          flashingPDCIds={flashingPDCIds}
          setFlashingPDCIds={setFlashingPDCIds}
        />
      </div>

      <div>
        <h2 className="text-2xl font-bold text-white mb-2 px-4">
          Arrivals ({arrivalFlights.length})
        </h2>
        <ArrivalsTable
          flights={arrivalFlights}
          onFlightDelete={onFlightDelete}
          onFlightChange={onFlightChange}
          backgroundStyle={backgroundStyle}
        />
      </div>
    </div>
  );
}
