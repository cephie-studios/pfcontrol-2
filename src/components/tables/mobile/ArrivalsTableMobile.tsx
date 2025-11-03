import { useState } from 'react';
import { EyeOff, Eye } from 'lucide-react';
import type { Flight } from '../../../types/flight';
import type { ArrivalsTableColumnSettings } from '../../../types/settings';
import TextInput from '../../common/TextInput';
import StarDropdown from '../../dropdowns/StarDropdown';
import AltitudeDropdown from '../../dropdowns/AltitudeDropdown';
import StatusDropdown from '../../dropdowns/StatusDropdown';
import Button from '../../common/Button';

interface ArrivalsTableMobileProps {
  flights: Flight[];
  onFlightChange?: (
    flightId: string | number,
    updates: Partial<Flight>
  ) => void;
  backgroundStyle?: React.CSSProperties;
  arrivalsColumns?: ArrivalsTableColumnSettings;
}

export default function ArrivalsTableMobile({
  flights,
  onFlightChange,
  backgroundStyle,
  arrivalsColumns = {
    time: true,
    callsign: true,
    gate: true,
    aircraft: true,
    wakeTurbulence: true,
    flightType: true,
    departure: true,
    runway: true,
    star: true,
    rfl: true,
    cfl: true,
    squawk: true,
    status: true,
    remark: true,
    hide: true,
  },
}: ArrivalsTableMobileProps) {
  const [showHidden, setShowHidden] = useState(false);
  const [remarkValues, setRemarkValues] = useState<
    Record<string | number, string>
  >({});

  const handleHideFlight = async (flightId: string | number) => {
    if (onFlightChange) {
      onFlightChange(flightId, { hidden: true });
    }
  };

  const handleUnhideFlight = async (flightId: string | number) => {
    if (onFlightChange) {
      onFlightChange(flightId, { hidden: false });
    }
  };

  const visibleFlights = showHidden
    ? flights
    : flights.filter((flight) => !flight.hidden);

  const hasHiddenFlights = flights.some((flight) => flight.hidden);

  return (
    <div className="mt-8 px-4">
      {hasHiddenFlights && (
        <div className="mb-4 flex items-center gap-2">
          <Button
            className="px-3 py-1 rounded flex items-center gap-1"
            onClick={() => setShowHidden((v) => !v)}
            variant="outline"
            size="sm"
          >
            {showHidden ? (
              <Eye className="w-4 h-4" />
            ) : (
              <EyeOff className="w-4 h-4" />
            )}
            {showHidden ? 'Hide hidden flights' : 'Show hidden flights'}
          </Button>
        </div>
      )}

      {visibleFlights.length === 0 ? (
        <div className="py-8 text-center text-gray-400">No arrivals found.</div>
      ) : (
        <div className="space-y-4">
          {visibleFlights.map((flight) => (
            <div
              key={flight.id}
              className={`flight-card p-4 rounded-lg border ${
                flight.hidden
                  ? 'opacity-60 text-gray-400 border-gray-600'
                  : 'border-gray-700'
              }`}
              style={backgroundStyle}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  {arrivalsColumns.callsign !== false && (
                    <h3 className="text-lg font-bold text-green-400">
                      {flight.callsign || 'Unknown'}
                    </h3>
                  )}
                  {(arrivalsColumns.departure !== false ||
                    arrivalsColumns.callsign !== false) && (
                    <p className="text-sm text-gray-400">
                      {arrivalsColumns.departure !== false && flight.departure}
                      {arrivalsColumns.departure !== false &&
                        arrivalsColumns.callsign !== false &&
                        ' → '}
                      {flight.arrival}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  {arrivalsColumns.hide !== false && (
                    <button
                      onClick={() =>
                        flight.hidden
                          ? handleUnhideFlight(flight.id)
                          : handleHideFlight(flight.id)
                      }
                      className="text-gray-400 hover:text-blue-500"
                    >
                      {flight.hidden ? (
                        <Eye className="w-5 h-5" />
                      ) : (
                        <EyeOff className="w-5 h-5" />
                      )}
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                {arrivalsColumns.gate !== false && (
                  <div>
                    <label className="block text-gray-400 mb-1">Gate</label>
                    <TextInput
                      value={flight.gate || ''}
                      onChange={(value) =>
                        onFlightChange?.(flight.id, {
                          gate: value,
                        })
                      }
                      placeholder="-"
                      maxLength={8}
                    />
                  </div>
                )}

                {arrivalsColumns.aircraft !== false && (
                  <div>
                    <label className="block text-gray-400 mb-1">Aircraft</label>
                    <span className="text-white font-mono">
                      {flight.aircraft || '-'}
                    </span>
                  </div>
                )}

                {arrivalsColumns.wakeTurbulence !== false && (
                  <div>
                    <label className="block text-gray-400 mb-1">WTC</label>
                    <span className="text-white">{flight.wtc || '-'}</span>
                  </div>
                )}

                {arrivalsColumns.flightType !== false && (
                  <div>
                    <label className="block text-gray-400 mb-1">Type</label>
                    <span className="text-white">
                      {flight.flight_type || '-'}
                    </span>
                  </div>
                )}

                {arrivalsColumns.runway !== false && (
                  <div>
                    <label className="block text-gray-400 mb-1">Runway</label>
                    <span className="text-white font-mono">
                      {flight.runway || '-'}
                    </span>
                  </div>
                )}

                {arrivalsColumns.star !== false && (
                  <div>
                    <label className="block text-gray-400 mb-1">STAR</label>
                    <StarDropdown
                      airportIcao={flight.arrival || ''}
                      value={flight.star}
                      onChange={(star) =>
                        onFlightChange?.(flight.id, {
                          star,
                        })
                      }
                      size="sm"
                      placeholder="-"
                    />
                  </div>
                )}

                {arrivalsColumns.rfl !== false && (
                  <div>
                    <label className="block text-gray-400 mb-1">RFL</label>
                    <span className="text-white font-mono">
                      {flight.cruisingFL || '-'}
                    </span>
                  </div>
                )}

                {arrivalsColumns.cfl !== false && (
                  <div>
                    <label className="block text-gray-400 mb-1">CFL</label>
                    <AltitudeDropdown
                      value={flight.clearedFL}
                      onChange={(alt) =>
                        onFlightChange?.(flight.id, {
                          clearedFL: alt,
                        })
                      }
                      size="sm"
                      placeholder="-"
                    />
                  </div>
                )}

                {arrivalsColumns.status !== false && (
                  <div>
                    <label className="block text-gray-400 mb-1">Status</label>
                    <StatusDropdown
                      value={flight.status}
                      onChange={(status) =>
                        onFlightChange?.(flight.id, {
                          status,
                        })
                      }
                      size="sm"
                      placeholder="-"
                      controllerType="arrival"
                    />
                  </div>
                )}

                {arrivalsColumns.squawk !== false && (
                  <div>
                    <label className="block text-gray-400 mb-1">Squawk</label>
                    <TextInput
                      value={flight.squawk || ''}
                      onChange={(value) =>
                        onFlightChange?.(flight.id, {
                          squawk: value,
                        })
                      }
                      placeholder="-"
                      maxLength={4}
                      pattern="[0-9]*"
                    />
                  </div>
                )}

                {arrivalsColumns.remark !== false && (
                  <div className="col-span-2">
                    <label className="block text-gray-400 mb-1">Remarks</label>
                    <TextInput
                      value={remarkValues[flight.id] ?? (flight.remark || '')}
                      onChange={(value) => {
                        setRemarkValues((prev) => ({
                          ...prev,
                          [flight.id]: value,
                        }));
                        onFlightChange?.(flight.id, { remark: value });
                      }}
                      placeholder="-"
                      maxLength={50}
                    />
                  </div>
                )}

                {/* Time is always visible */}
                <div>
                  <label className="block text-gray-400 mb-1">Time</label>
                  <span className="text-white font-mono">
                    {flight.timestamp
                      ? new Date(flight.timestamp).toLocaleTimeString('en-GB', {
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZone: 'UTC',
                        })
                      : '-'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
