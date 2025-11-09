import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  EyeOff,
  Eye,
  Trash2,
  FileSpreadsheet,
  RefreshCw,
  Route,
} from 'lucide-react';
import type { Flight } from '../../../types/flight';
import type { DepartureTableColumnSettings } from '../../../types/settings';
import Checkbox from '../../common/Checkbox';
import TextInput from '../../common/TextInput';
import AirportDropdown from '../../dropdowns/AirportDropdown';
import RunwayDropdown from '../../dropdowns/RunwayDropdown';
import AircraftDropdown from '../../dropdowns/AircraftDropdown';
import SidDropdown from '../../dropdowns/SidDropdown';
import AltitudeDropdown from '../../dropdowns/AltitudeDropdown';
import StatusDropdown from '../../dropdowns/StatusDropdown';
import Button from '../../common/Button';
import PDCModal from '../../tools/PDCModal';
import RouteModal from '../../tools/RouteModal';

interface DepartureTableProps {
  flights: Flight[];
  onFlightDelete: (flightId: string | number) => void;
  onFlightChange?: (
    flightId: string | number,
    updates: Partial<Flight>
  ) => void;
  backgroundStyle?: React.CSSProperties;
  departureColumns?: DepartureTableColumnSettings;
  onPDCOpen?: (flight: Flight) => void;
  flashingPDCIds?: Set<string>;
  onStopFlashing?: (flightId: string | number) => void;
}

export default function DepartureTableMobile({
  flights,
  onFlightDelete,
  onFlightChange,
  backgroundStyle,
  departureColumns = {
    time: true,
    callsign: true,
    stand: true,
    aircraft: true,
    wakeTurbulence: true,
    flightType: true,
    arrival: true,
    runway: true,
    sid: true,
    rfl: true,
    cfl: true,
    squawk: true,
    clearance: true,
    status: true,
    remark: true,
    route: true,
    pdc: true,
    hide: true,
    delete: true,
  },
  onPDCOpen,
  flashingPDCIds = new Set(),
  onStopFlashing,
}: DepartureTableProps) {
  const [showHidden, setShowHidden] = useState(false);
  const [pdcModalOpen, setPdcModalOpen] = useState(false);
  const [routeModalOpen, setRouteModalOpen] = useState(false);
  const [selectedFlight, setSelectedFlight] = useState<Flight | null>(null);
  const [remarkValues, setRemarkValues] = useState<
    Record<string | number, string>
  >({});

  const [draggedFlightId, setDraggedFlightId] = useState<
    string | number | null
  >(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [customFlightOrder, setCustomFlightOrder] = useState<
    (string | number)[]
  >([]);

  useEffect(() => {
    const savedOrder = localStorage.getItem('flight-strip-order-mobile');
    if (savedOrder) {
      try {
        setCustomFlightOrder(JSON.parse(savedOrder));
      } catch (error) {
        console.error('Failed to parse saved flight order:', error);
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
    localStorage.setItem(
      'flight-strip-order-mobile',
      JSON.stringify(flightIds)
    );
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

  const handleRouteClick = (flight: Flight) => {
    if (flight.route && flight.route.trim()) {
      setSelectedFlight(flight);
      setRouteModalOpen(true);
    }
  };

  const handleRouteClose = () => {
    setRouteModalOpen(false);
    setSelectedFlight(null);
  };

  const handlePDCClick = (flight: Flight) => {
    if (onStopFlashing) {
      onStopFlashing(flight.id);
    }

    if (onPDCOpen) {
      onPDCOpen(flight);
    } else {
      setSelectedFlight(flight);
      setPdcModalOpen(true);
    }
  };

  const handlePDCClose = () => {
    setPdcModalOpen(false);
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

  const handleDeleteFlight = async (flightId: string | number) => {
    onFlightDelete(flightId);
  };

  const handleToggleClearance = (
    flightId: string | number,
    checked: boolean
  ) => {
    if (onFlightChange) {
      onFlightChange(flightId, { clearance: checked });
    }
  };

  const generateRandomSquawk = (): string => {
    let squawk = '';
    for (let i = 0; i < 4; i++) {
      squawk += Math.floor(Math.random() * 6) + 1;
    }
    return squawk;
  };

  const handleRegenerateSquawk = (flightId: string | number) => {
    const newSquawk = generateRandomSquawk();
    if (onFlightChange) {
      onFlightChange(flightId, { squawk: newSquawk });
    }
  };

  const handleRemarkChange = (flightId: string | number, remark: string) => {
    if (onFlightChange) {
      onFlightChange(flightId, { remark });
    }
  };

  const handleCallsignChange = (
    flightId: string | number,
    callsign: string
  ) => {
    if (onFlightChange) {
      onFlightChange(flightId, { callsign });
    }
  };

  const handleStandChange = (flightId: string | number, stand: string) => {
    if (onFlightChange) {
      onFlightChange(flightId, { stand });
    }
  };

  const handleSquawkChange = (flightId: string | number, squawk: string) => {
    if (onFlightChange) {
      onFlightChange(flightId, { squawk });
    }
  };

  const handleArrivalChange = (flightId: string | number, arrival: string) => {
    if (onFlightChange) {
      onFlightChange(flightId, { arrival });
    }
  };

  const handleRunwayChange = (flightId: string | number, runway: string) => {
    if (onFlightChange) {
      onFlightChange(flightId, { runway });
    }
  };

  const handleAircraftChange = (
    flightId: string | number,
    aircraft: string
  ) => {
    if (onFlightChange) {
      onFlightChange(flightId, { aircraft });
    }
  };

  const handleSidChange = (flightId: string | number, sid: string) => {
    if (onFlightChange) {
      onFlightChange(flightId, { sid });
    }
  };

  const handleCruisingFLChange = (
    flightId: string | number,
    cruisingFL: string
  ) => {
    if (onFlightChange) {
      onFlightChange(flightId, { cruisingFL });
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

  const visibleFlights = showHidden
    ? orderedFlights
    : orderedFlights.filter((flight) => !flight.hidden);

  if (visibleFlights.length === 0) {
    return (
      <div className="mt-8 px-4 py-6 text-center text-gray-400">
        No departures found.
      </div>
    );
  }

  const isClearanceChecked = (
    clearance: boolean | string | undefined
  ): boolean => {
    if (typeof clearance === 'boolean') {
      return clearance;
    }
    if (typeof clearance === 'string') {
      return clearance.toLowerCase() === 'true';
    }
    return false;
  };

  return (
    <div className="mt-8 px-4">
      {flights.some((flight) => flight.hidden) && (
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
      <div className="card-view space-y-4">
        {visibleFlights.map((flight, index) => {
          const isDragging = draggedFlightId === flight.id;
          const isDragOver = dragOverIndex === index;

          return (
            <div
              key={flight.id}
              draggable={true}
              onDragStart={(e) => handleDragStart(e, flight.id)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={`flight-card p-4 rounded-lg border cursor-move select-none ${
                flight.hidden
                  ? 'opacity-60 text-gray-400 border-gray-600'
                  : 'border-zinc-700'
              } ${isDragging ? 'opacity-50' : ''} ${
                isDragOver ? 'border-t-4 border-blue-400' : ''
              }`}
              style={backgroundStyle}
            >
              <div className="grid grid-cols-2 gap-2 text-sm">
                {departureColumns.callsign !== false && (
                  <div>
                    <strong>Callsign:</strong>{' '}
                    <TextInput
                      value={flight.callsign || ''}
                      onChange={(value) =>
                        handleCallsignChange(flight.id, value)
                      }
                      className="bg-transparent border-none focus:bg-gray-800 px-1 rounded text-white"
                      placeholder="-"
                      maxLength={16}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.currentTarget.blur();
                        }
                      }}
                    />
                  </div>
                )}
                {departureColumns.stand !== false && (
                  <div>
                    <strong>Stand:</strong>{' '}
                    <TextInput
                      value={flight.stand || ''}
                      onChange={(value) => handleStandChange(flight.id, value)}
                      className="bg-transparent border-none focus:bg-gray-800 px-1 rounded text-white"
                      placeholder="-"
                      maxLength={8}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.currentTarget.blur();
                        }
                      }}
                    />
                  </div>
                )}
                {departureColumns.aircraft !== false && (
                  <div>
                    <strong>Aircraft:</strong>{' '}
                    <AircraftDropdown
                      value={flight.aircraft}
                      onChange={(type) => handleAircraftChange(flight.id, type)}
                      size="xs"
                      showFullName={false}
                    />
                  </div>
                )}
                {departureColumns.wakeTurbulence !== false && (
                  <div>
                    <strong>WTC:</strong> {flight.wtc || '-'}
                  </div>
                )}
                {departureColumns.flightType !== false && (
                  <div>
                    <strong>Type:</strong> {flight.flight_type || '-'}
                  </div>
                )}
                {departureColumns.arrival !== false && (
                  <div>
                    <strong>ADES:</strong>{' '}
                    <AirportDropdown
                      value={flight.arrival}
                      onChange={(icao) => handleArrivalChange(flight.id, icao)}
                      size="xs"
                      showFullName={false}
                    />
                  </div>
                )}
                {departureColumns.runway !== false && (
                  <div>
                    <strong>Runway:</strong>{' '}
                    <RunwayDropdown
                      airportIcao={flight.departure || ''}
                      value={flight.runway}
                      onChange={(runway) =>
                        handleRunwayChange(flight.id, runway)
                      }
                      size="xs"
                      placeholder="-"
                    />
                  </div>
                )}
                {departureColumns.sid !== false && (
                  <div>
                    <strong>SID:</strong>{' '}
                    <SidDropdown
                      airportIcao={flight.departure || ''}
                      value={flight.sid}
                      onChange={(sid) => handleSidChange(flight.id, sid)}
                      size="xs"
                      placeholder="-"
                    />
                  </div>
                )}
                {departureColumns.rfl !== false && (
                  <div>
                    <strong>RFL:</strong>{' '}
                    <AltitudeDropdown
                      value={flight.cruisingFL}
                      onChange={(alt) => handleCruisingFLChange(flight.id, alt)}
                      size="xs"
                      placeholder="-"
                    />
                  </div>
                )}
                {departureColumns.cfl !== false && (
                  <div>
                    <strong>CFL:</strong>{' '}
                    <AltitudeDropdown
                      value={flight.clearedFL}
                      onChange={(alt) => handleClearedFLChange(flight.id, alt)}
                      size="xs"
                      placeholder="-"
                    />
                  </div>
                )}
                {departureColumns.squawk !== false && (
                  <div>
                    <strong>Squawk:</strong>{' '}
                    <div className="flex items-center gap-0.5 mt-1">
                      <TextInput
                        value={flight.squawk || ''}
                        onChange={(value) =>
                          handleSquawkChange(flight.id, value)
                        }
                        className="bg-transparent border-none focus:bg-gray-800 px-1 rounded text-white w-full min-w-0"
                        placeholder="-"
                        maxLength={4}
                        pattern="[0-9]*"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.currentTarget.blur();
                          }
                        }}
                      />
                      <button
                        onClick={() => handleRegenerateSquawk(flight.id)}
                        className="text-gray-400 hover:text-blue-500 rounded transition-colors flex-shrink-0"
                        title="Generate new squawk"
                        type="button"
                      >
                        <RefreshCw className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
                {departureColumns.clearance !== false && (
                  <div>
                    <strong>Clearance:</strong>{' '}
                    <Checkbox
                      checked={isClearanceChecked(flight.clearance)}
                      onChange={(checked) =>
                        handleToggleClearance(flight.id, checked)
                      }
                      label=""
                      checkedClass="bg-green-600 border-green-600"
                      className="mt-3"
                    />
                  </div>
                )}
                {departureColumns.status !== false && (
                  <div>
                    <strong>Status:</strong>{' '}
                    <StatusDropdown
                      value={flight.status}
                      onChange={(status) =>
                        handleStatusChange(flight.id, status)
                      }
                      size="xs"
                      placeholder="-"
                      controllerType="departure"
                    />
                  </div>
                )}
                {departureColumns.remark !== false && (
                  <div className="col-span-2">
                    <strong>Remark:</strong>{' '}
                    <TextInput
                      value={remarkValues[flight.id] ?? (flight.remark || '')}
                      onChange={(value) => {
                        setRemarkValues((prev) => ({
                          ...prev,
                          [flight.id]: value,
                        }));
                        handleRemarkChange(flight.id, value);
                      }}
                      className="bg-transparent border-none focus:bg-gray-800 px-1 rounded text-white"
                      placeholder="-"
                      maxLength={50}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.currentTarget.blur();
                        }
                      }}
                    />
                  </div>
                )}
                {/* Time is always visible */}
                <div>
                  <strong>Time:</strong>{' '}
                  {flight.timestamp
                    ? new Date(flight.timestamp).toLocaleTimeString('en-GB', {
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: 'UTC',
                      })
                    : '-'}
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                {departureColumns.route !== false && (
                  <button
                    className={`px-2 py-1 rounded transition-colors ${
                      flight.route && flight.route.trim()
                        ? 'text-gray-400 hover:text-blue-500'
                        : 'text-red-500 cursor-not-allowed'
                    }`}
                    onClick={() => handleRouteClick(flight)}
                    title={
                      flight.route && flight.route.trim()
                        ? 'View Route'
                        : 'No route specified'
                    }
                    disabled={!flight.route || !flight.route.trim()}
                  >
                    <Route className="w-4 h-4" />
                  </button>
                )}
                {departureColumns.pdc !== false && (
                  <button
                    className={`text-gray-400 hover:text-blue-500 px-2 py-1 rounded transition-colors ${
                      flashingPDCIds.has(String(flight.id)) &&
                      !isClearanceChecked(flight.clearance)
                        ? 'animate-pulse'
                        : ''
                    }`}
                    onClick={() => handlePDCClick(flight)}
                    title="Generate PDC"
                  >
                    <FileSpreadsheet
                      className={`w-4 h-4 ${
                        flashingPDCIds.has(String(flight.id)) &&
                        !isClearanceChecked(flight.clearance)
                          ? 'text-orange-400'
                          : ''
                      }`}
                    />
                  </button>
                )}
                {departureColumns.hide !== false && (
                  <button
                    title={flight.hidden ? 'Unhide' : 'Hide'}
                    className="text-gray-400 hover:text-blue-500 px-2 py-1 rounded"
                    onClick={() =>
                      flight.hidden
                        ? handleUnhideFlight(flight.id)
                        : handleHideFlight(flight.id)
                    }
                  >
                    {flight.hidden ? (
                      <Eye className="w-4 h-4" />
                    ) : (
                      <EyeOff className="w-4 h-4" />
                    )}
                  </button>
                )}
                {departureColumns.delete !== false && (
                  <button
                    title="Delete"
                    className="text-gray-400 hover:text-red-500 px-2 py-1 rounded"
                    onClick={() => handleDeleteFlight(flight.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!onPDCOpen && (
        <PDCModal
          isOpen={pdcModalOpen}
          onClose={handlePDCClose}
          flight={selectedFlight}
        />
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
