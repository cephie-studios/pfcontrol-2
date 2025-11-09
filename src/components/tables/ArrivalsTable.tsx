import { useState, useCallback, useEffect, useMemo } from 'react';
import { useMediaQuery } from 'react-responsive';
import { EyeOff, Eye, Route, GripVertical } from 'lucide-react';
import type { Flight } from '../../types/flight';
import type { ArrivalsTableColumnSettings } from '../../types/settings';
import TextInput from '../common/TextInput';
import StarDropdown from '../dropdowns/StarDropdown';
import AltitudeDropdown from '../dropdowns/AltitudeDropdown';
import StatusDropdown from '../dropdowns/StatusDropdown';
import Button from '../common/Button';
import ArrivalsTableMobile from './mobile/ArrivalsTableMobile';
import RouteModal from '../tools/RouteModal';

interface ArrivalsTableProps {
  flights: Flight[];
  onFlightChange?: (
    flightId: string | number,
    updates: Partial<Flight>
  ) => void;
  backgroundStyle?: React.CSSProperties;
  arrivalsColumns?: ArrivalsTableColumnSettings;
}

export default function ArrivalsTable({
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
    route: true,
    hide: true,
  },
}: ArrivalsTableProps) {
  const [showHidden, setShowHidden] = useState(false);
  const [routeModalOpen, setRouteModalOpen] = useState(false);
  const [selectedFlight, setSelectedFlight] = useState<Flight | null>(null);
  const isMobile = useMediaQuery({ maxWidth: 1000 });

  const [draggedFlightId, setDraggedFlightId] = useState<
    string | number | null
  >(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [customFlightOrder, setCustomFlightOrder] = useState<
    (string | number)[]
  >([]);

  useEffect(() => {
    const savedOrder = localStorage.getItem('arrival-strip-order');
    if (savedOrder) {
      try {
        setCustomFlightOrder(JSON.parse(savedOrder));
      } catch (error) {
        console.error('Failed to parse saved arrival order:', error);
      }
    }
  }, []);

  const orderedFlights = useMemo(() => {
    if (customFlightOrder.length === 0) {
      return flights;
    }

    const orderedList: Flight[] = [];
    const remainingFlights = [...flights];

    customFlightOrder.forEach((flightId) => {
      const flightIndex = remainingFlights.findIndex((f) => f.id === flightId);
      if (flightIndex !== -1) {
        orderedList.push(remainingFlights[flightIndex]);
        remainingFlights.splice(flightIndex, 1);
      }
    });

    orderedList.push(...remainingFlights);

    return orderedList;
  }, [flights, customFlightOrder]);

  const saveFlightOrder = useCallback((flightIds: (string | number)[]) => {
    localStorage.setItem('arrival-strip-order', JSON.stringify(flightIds));
    setCustomFlightOrder(flightIds);
  }, []);

  const handleDragStart = useCallback(
    (e: React.DragEvent, flightId: string | number) => {
      setDraggedFlightId(flightId);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(flightId));
    },
    []
  );

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, dropIndex: number) => {
      e.preventDefault();

      if (draggedFlightId === null) return;

      const currentFlights = orderedFlights;
      const draggedIndex = currentFlights.findIndex(
        (f) => f.id === draggedFlightId
      );

      if (draggedIndex === -1 || draggedIndex === dropIndex) {
        setDraggedFlightId(null);
        setDragOverIndex(null);
        return;
      }

      const newFlights = [...currentFlights];
      const [draggedFlight] = newFlights.splice(draggedIndex, 1);
      newFlights.splice(dropIndex, 0, draggedFlight);

      const newOrder = newFlights.map((f) => f.id);
      saveFlightOrder(newOrder);

      setDraggedFlightId(null);
      setDragOverIndex(null);
    },
    [draggedFlightId, orderedFlights, saveFlightOrder]
  );

  const handleDragEnd = useCallback(() => {
    setDraggedFlightId(null);
    setDragOverIndex(null);
  }, []);

  const handleRouteOpen = (flight: Flight) => {
    if (flight.route && flight.route.trim()) {
      setSelectedFlight(flight);
      setRouteModalOpen(true);
    }
  };

  const handleRouteClose = () => {
    setRouteModalOpen(false);
    setSelectedFlight(null);
  };

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

  const handleRemarkChange = (flightId: string | number, remark: string) => {
    if (onFlightChange) {
      onFlightChange(flightId, { remark });
    }
  };

  const handleSquawkChange = (flightId: string | number, squawk: string) => {
    if (onFlightChange) {
      onFlightChange(flightId, { squawk });
    }
  };

  const handleStarChange = (flightId: string | number, star: string) => {
    if (onFlightChange) {
      onFlightChange(flightId, { star });
    }
  };

  const handleClearedFLChange = (
    flightId: string | number,
    clearedFL: string
  ) => {
    if (onFlightChange) {
      onFlightChange(flightId, { clearedFL });
    }
  };

  const handleStatusChange = (flightId: string | number, status: string) => {
    if (onFlightChange) {
      onFlightChange(flightId, { status });
    }
  };

  const handleGateChange = (flightId: string | number, gate: string) => {
    if (onFlightChange) {
      onFlightChange(flightId, { gate });
    }
  };

  const visibleFlights = showHidden
    ? orderedFlights
    : orderedFlights.filter((flight) => !flight.hidden);

  const hasHiddenFlights = orderedFlights.some((flight) => flight.hidden);

  if (isMobile) {
    return (
      <>
        <ArrivalsTableMobile
          flights={orderedFlights}
          onFlightChange={onFlightChange}
          backgroundStyle={backgroundStyle}
          arrivalsColumns={arrivalsColumns}
        />
        <RouteModal
          isOpen={routeModalOpen}
          onClose={handleRouteClose}
          flight={selectedFlight}
          onFlightChange={onFlightChange}
        />
      </>
    );
  }

  return (
    <div className="mt-8 px-4">
      {hasHiddenFlights && (
        <div className="mb-2 flex items-center gap-2">
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
        <div className="mt-24 px-4 py-6 text-center text-gray-400">
          No arrivals found.
        </div>
      ) : (
        <div className="table-view">
          <table className="min-w-full rounded-lg">
            <thead>
              <tr className="bg-green-950 text-green-200">
                {/* Time column is always visible */}
                <th className="py-2.5 px-4 text-left column-time">TIME</th>
                {arrivalsColumns.callsign !== false && (
                  <th className="py-2.5 px-4 text-left">CALLSIGN</th>
                )}
                {arrivalsColumns.gate !== false && (
                  <th className="py-2.5 px-4 text-left w-24 column-gate">
                    GATE
                  </th>
                )}
                {arrivalsColumns.aircraft !== false && (
                  <th className="py-2.5 px-4 text-left">ATYP</th>
                )}
                {arrivalsColumns.wakeTurbulence !== false && (
                  <th className="py-2.5 px-4 text-left column-w">W</th>
                )}
                {arrivalsColumns.flightType !== false && (
                  <th className="py-2.5 px-4 text-left">V</th>
                )}
                {arrivalsColumns.departure !== false && (
                  <th className="py-2.5 px-4 text-left">ADEP</th>
                )}
                {arrivalsColumns.runway !== false && (
                  <th className="py-2.5 px-4 text-left column-rwy">RWY</th>
                )}
                {arrivalsColumns.star !== false && (
                  <th className="py-2.5 px-4 text-left">STAR</th>
                )}
                {arrivalsColumns.rfl !== false && (
                  <th className="py-2.5 px-4 text-left column-rfl">RFL</th>
                )}
                {arrivalsColumns.cfl !== false && (
                  <th className="py-2.5 px-4 text-left">CFL</th>
                )}
                {arrivalsColumns.squawk !== false && (
                  <th className="py-2.5 px-4 text-left w-28">ASSR</th>
                )}
                {arrivalsColumns.status !== false && (
                  <th className="py-2.5 px-4 text-left">STS</th>
                )}
                {arrivalsColumns.remark !== false && (
                  <th className="py-2.5 px-4 text-left w-64 column-rmk">RMK</th>
                )}
                {arrivalsColumns.route !== false && (
                  <th className="py-2.5 px-4 text-left column-route">ROUTE</th>
                )}
                {arrivalsColumns.hide !== false && (
                  <th className="py-2.5 px-4 text-left column-hide">HIDE</th>
                )}
              </tr>
            </thead>
            <tbody>
              {visibleFlights.map((flight, index) => {
                const isDragging = draggedFlightId === flight.id;
                const isDragOver = dragOverIndex === index;

                return (
                  <tr
                    key={flight.id}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`select-none ${
                      flight.hidden ? 'opacity-60 text-gray-400' : ''
                    } ${isDragging ? 'opacity-50' : ''} ${
                      isDragOver ? 'border-t-2 border-green-400' : ''
                    }`}
                    style={backgroundStyle}
                  >
                    {/* Time column */}
                    <td className="py-2 px-4 column-time">
                      <div className="flex items-center gap-2">
                        <div
                          draggable={true}
                          onDragStart={(e) => handleDragStart(e, flight.id)}
                          className="cursor-move text-zinc-500 hover:text-zinc-300 transition-colors"
                        >
                          <GripVertical className="w-4 h-4" />
                        </div>
                        <span>
                          {flight.timestamp
                            ? new Date(flight.timestamp).toLocaleTimeString(
                                'en-GB',
                                {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  timeZone: 'UTC',
                                }
                              )
                            : '-'}
                        </span>
                      </div>
                    </td>
                    {arrivalsColumns.callsign !== false && (
                      <td className="py-2 px-4">
                        <span className="text-white font-mono">
                          {flight.callsign || '-'}
                        </span>
                      </td>
                    )}
                    {arrivalsColumns.gate !== false && (
                      <td className="py-2 px-4 column-gate">
                        <TextInput
                          value={flight.gate || ''}
                          onChange={(value) =>
                            handleGateChange(flight.id, value)
                          }
                          className="bg-transparent border-none focus:bg-gray-800 px-1 rounded text-white"
                          placeholder="-"
                          maxLength={8}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.currentTarget.blur();
                            }
                          }}
                        />
                      </td>
                    )}
                    {arrivalsColumns.aircraft !== false && (
                      <td className="py-2 px-4">
                        <span className="text-white font-mono">
                          {flight.aircraft || '-'}
                        </span>
                      </td>
                    )}
                    {arrivalsColumns.wakeTurbulence !== false && (
                      <td className="py-2 px-4 column-w">
                        {flight.wtc || '-'}
                      </td>
                    )}
                    {arrivalsColumns.flightType !== false && (
                      <td className="py-2 px-4">{flight.flight_type || '-'}</td>
                    )}
                    {arrivalsColumns.departure !== false && (
                      <td className="py-2 px-4">
                        <span className="text-white font-mono">
                          {flight.departure || '-'}
                        </span>
                      </td>
                    )}
                    {arrivalsColumns.runway !== false && (
                      <td className="py-2 px-4 column-rwy">
                        <span className="text-white font-mono">
                          {flight.runway || '-'}
                        </span>
                      </td>
                    )}
                    {arrivalsColumns.star !== false && (
                      <td className="py-2 px-4">
                        <StarDropdown
                          airportIcao={flight.arrival || ''}
                          value={flight.star}
                          onChange={(star) => handleStarChange(flight.id, star)}
                          size="xs"
                          placeholder="-"
                        />
                      </td>
                    )}
                    {arrivalsColumns.rfl !== false && (
                      <td className="py-2 px-4 column-rfl">
                        <span className="text-white font-mono">
                          {flight.cruisingFL || '-'}
                        </span>
                      </td>
                    )}
                    {arrivalsColumns.cfl !== false && (
                      <td className="py-2 px-4">
                        <AltitudeDropdown
                          value={flight.clearedFL}
                          onChange={(alt) =>
                            handleClearedFLChange(flight.id, alt)
                          }
                          size="xs"
                          placeholder="-"
                        />
                      </td>
                    )}
                    {arrivalsColumns.squawk !== false && (
                      <td className="py-2 px-4">
                        <TextInput
                          value={flight.squawk || ''}
                          onChange={(value) =>
                            handleSquawkChange(flight.id, value)
                          }
                          className="bg-transparent border-none focus:bg-gray-800 px-1 rounded text-white"
                          placeholder="-"
                          maxLength={4}
                          pattern="[0-9]*"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.currentTarget.blur();
                            }
                          }}
                        />
                      </td>
                    )}
                    {arrivalsColumns.status !== false && (
                      <td className="py-2 px-4">
                        <StatusDropdown
                          value={flight.status}
                          onChange={(status) =>
                            handleStatusChange(flight.id, status)
                          }
                          size="xs"
                          placeholder="-"
                          controllerType="arrival"
                        />
                      </td>
                    )}
                    {arrivalsColumns.remark !== false && (
                      <td className="py-2 px-4 column-rmk">
                        <TextInput
                          value={flight.remark || ''}
                          onChange={(value) =>
                            handleRemarkChange(flight.id, value)
                          }
                          className="bg-transparent border-none focus:bg-gray-800 px-1 rounded text-white"
                          placeholder="-"
                          maxLength={50}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.currentTarget.blur();
                            }
                          }}
                        />
                      </td>
                    )}
                    {arrivalsColumns.route !== false && (
                      <td className="py-2 px-4 column-route">
                        <button
                          className={`px-2 py-1 rounded transition-colors ${
                            flight.route && flight.route.trim()
                              ? 'text-gray-400 hover:text-blue-500'
                              : 'text-red-500 cursor-not-allowed'
                          }`}
                          onClick={() => handleRouteOpen(flight)}
                          title={
                            flight.route && flight.route.trim()
                              ? 'View Route'
                              : 'No route specified'
                          }
                          disabled={!flight.route || !flight.route.trim()}
                        >
                          <Route />
                        </button>
                      </td>
                    )}
                    {arrivalsColumns.hide !== false && (
                      <td className="py-2 px-4 column-hide">
                        <button
                          title={flight.hidden ? 'Unhide' : 'Hide'}
                          className="text-gray-400 hover:text-blue-500"
                          onClick={() =>
                            flight.hidden
                              ? handleUnhideFlight(flight.id)
                              : handleHideFlight(flight.id)
                          }
                        >
                          {flight.hidden ? <Eye /> : <EyeOff />}
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <RouteModal
        isOpen={routeModalOpen}
        onClose={handleRouteClose}
        flight={selectedFlight}
        onFlightChange={onFlightChange}
      />
    </div>
  );
}
