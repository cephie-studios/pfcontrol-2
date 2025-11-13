import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useMediaQuery } from 'react-responsive';
import {
  EyeOff,
  Eye,
  Trash2,
  FileSpreadsheet,
  RefreshCw,
  Route,
  GripVertical,
  Menu,
} from 'lucide-react';
import type { Flight } from '../../types/flight';
import type { DepartureTableColumnSettings } from '../../types/settings';
import type { FieldEditingState } from '../../sockets/sessionUsersSocket';
import { useData } from '../../hooks/data/useData';
import { parseCallsign } from '../../utils/callsignParser';
import Checkbox from '../common/Checkbox';
import TextInput from '../common/TextInput';
import AirportDropdown from '../dropdowns/AirportDropdown';
import RunwayDropdown from '../dropdowns/RunwayDropdown';
import AircraftDropdown from '../dropdowns/AircraftDropdown';
import SidDropdown from '../dropdowns/SidDropdown';
import AltitudeDropdown from '../dropdowns/AltitudeDropdown';
import StatusDropdown from '../dropdowns/StatusDropdown';
import Button from '../common/Button';
import DepartureTableMobile from './mobile/DepartureTableMobile';
import PDCModal from '../tools/PDCModal';
import RouteModal from '../tools/RouteModal';
import ConfirmationDialog from '../common/ConfirmationDialog';

interface DepartureTableProps {
  flights: Flight[];
  onFlightChange: (flightId: string | number, updates: Partial<Flight>) => void;
  onFlightDelete: (flightId: string | number) => void;
  backgroundStyle?: React.CSSProperties;
  departureColumns?: DepartureTableColumnSettings;
  fieldEditingStates?: FieldEditingState[];
  onFieldEditingStart?: (flightId: string | number, fieldName: string) => void;
  flashFlightId: string | null;
  onFieldEditingStop?: (flightId: string | number, fieldName: string) => void;
  onIssuePDC?: (
    flightId: string | number,
    pdcText: string
  ) => Promise<void> | void;
  onToggleClearance: (flightId: string | number, checked: boolean) => void;
  flashingPDCIds: Set<string>;
  setFlashingPDCIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  id?: string;
}

export default function DepartureTable({
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
  fieldEditingStates = [],
  onFieldEditingStart,
  onFieldEditingStop,
  onIssuePDC,
  onToggleClearance,
  flashingPDCIds,
  setFlashingPDCIds,
  id,
}: DepartureTableProps) {
  const { airlines, loading: airlinesLoading } = useData();
  const [showHidden, setShowHidden] = useState(false);
  const [pdcModalOpen, setPdcModalOpen] = useState(false);
  const [routeModalOpen, setRouteModalOpen] = useState(false);
  const [selectedFlight, setSelectedFlight] = useState<Flight | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [flightToDelete, setFlightToDelete] = useState<string | number | null>(
    null
  );
  const [openDropdownId, setOpenDropdownId] = useState<string | number | null>(
    null
  );
  const buttonRefs = useRef<Record<string | number, HTMLButtonElement | null>>(
    {}
  );
  const isMobile = useMediaQuery({ maxWidth: 1000 });

  const [remarkValues, setRemarkValues] = useState<
    Record<string | number, string>
  >({});
  const [callsignValues, setCallsignValues] = useState<
    Record<string | number, string>
  >({});
  const [standValues, setStandValues] = useState<
    Record<string | number, string>
  >({});
  const [squawkValues, setSquawkValues] = useState<
    Record<string | number, string>
  >({});
  const debounceTimeouts = useRef<Record<string | number, NodeJS.Timeout>>({});

  const [draggedFlightId, setDraggedFlightId] = useState<
    string | number | null
  >(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [customFlightOrder, setCustomFlightOrder] = useState<
    (string | number)[]
  >([]);

  useEffect(() => {
    const savedOrder = localStorage.getItem('flight-strip-order');
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
    localStorage.setItem('flight-strip-order', JSON.stringify(flightIds));
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

  const debouncedHandleRemarkChange = useCallback(
    (flightId: string | number, remark: string) => {
      setRemarkValues((prev) => ({ ...prev, [flightId]: remark }));

      if (debounceTimeouts.current[flightId]) {
        clearTimeout(debounceTimeouts.current[flightId]);
      }

      debounceTimeouts.current[flightId] = setTimeout(() => {
        if (onFlightChange) {
          onFlightChange(flightId, { remark });
        }
        delete debounceTimeouts.current[flightId];
      }, 500);
    },
    [onFlightChange]
  );

  const debouncedHandleCallsignChange = useCallback(
    (flightId: string | number, callsign: string) => {
      setCallsignValues((prev) => ({ ...prev, [flightId]: callsign }));

      if (debounceTimeouts.current[flightId]) {
        clearTimeout(debounceTimeouts.current[flightId]);
      }

      debounceTimeouts.current[flightId] = setTimeout(() => {
        if (onFlightChange) {
          onFlightChange(flightId, { callsign });
        }
        delete debounceTimeouts.current[flightId];
      }, 500);
    },
    [onFlightChange]
  );

  const debouncedHandleStandChange = useCallback(
    (flightId: string | number, stand: string) => {
      setStandValues((prev) => ({ ...prev, [flightId]: stand }));

      if (debounceTimeouts.current[flightId]) {
        clearTimeout(debounceTimeouts.current[flightId]);
      }

      debounceTimeouts.current[flightId] = setTimeout(() => {
        if (onFlightChange) {
          onFlightChange(flightId, { stand });
        }
        delete debounceTimeouts.current[flightId];
      }, 500);
    },
    [onFlightChange]
  );

  const debouncedHandleSquawkChange = useCallback(
    (flightId: string | number, squawk: string) => {
      setSquawkValues((prev) => ({ ...prev, [flightId]: squawk }));

      if (debounceTimeouts.current[flightId]) {
        clearTimeout(debounceTimeouts.current[flightId]);
      }

      debounceTimeouts.current[flightId] = setTimeout(() => {
        if (onFlightChange) {
          onFlightChange(flightId, { squawk });
        }
        delete debounceTimeouts.current[flightId];
      }, 500);
    },
    [onFlightChange]
  );

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

  const handleDeleteClick = (flightId: string | number) => {
    setFlightToDelete(flightId);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = () => {
    if (flightToDelete !== null) {
      onFlightDelete(flightToDelete);
      setFlightToDelete(null);
    }
    setDeleteConfirmOpen(false);
  };

  const handleCancelDelete = () => {
    setFlightToDelete(null);
    setDeleteConfirmOpen(false);
  };

  const isClearanceChecked = (v: boolean | string | undefined) => {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'string')
      return ['true', 'c', 'yes', '1'].includes(v.trim().toLowerCase());
    return false;
  };

  const handleRemarkChange = (flightId: string | number, remark: string) => {
    debouncedHandleRemarkChange(flightId, remark);
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
  const hasHiddenFlights = orderedFlights.some((flight) => flight.hidden);

  const handlePDCOpen = (flight: Flight) => {
    setSelectedFlight(flight);
    setPdcModalOpen(true);
    setFlashingPDCIds((prev) => {
      const next = new Set(prev);
      next.delete(String(flight.id));
      return next;
    });
  };

  const handlePDCClose = () => {
    setPdcModalOpen(false);
    setSelectedFlight(null);
  };

  const handleRouteOpen = (flight: Flight) => {
    setSelectedFlight(flight);
    setRouteModalOpen(true);
  };

  const handleRouteClose = () => {
    setRouteModalOpen(false);
    setSelectedFlight(null);
  };

  const getFieldEditingState = (
    flightId: string | number,
    fieldName: string
  ) => {
    return fieldEditingStates.find(
      (state) => state.flightId === flightId && state.fieldName === fieldName
    );
  };

  const handleFieldFocus = (flightId: string | number, fieldName: string) => {
    if (onFieldEditingStart) {
      onFieldEditingStart(flightId, fieldName);
    }
  };

  const handleFieldBlur = (flightId: string | number, fieldName: string) => {
    if (onFieldEditingStop) {
      onFieldEditingStop(flightId, fieldName);
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
    setSquawkValues((prev) => ({ ...prev, [flightId]: newSquawk }));
    if (onFlightChange) {
      onFlightChange(flightId, { squawk: newSquawk });
    }
  };

  const handleStopFlashing = (flightId: string | number) => {
    setFlashingPDCIds((prev) => {
      const next = new Set(prev);
      next.delete(String(flightId));
      return next;
    });
  };

  if (isMobile) {
    return (
      <>
        <DepartureTableMobile
          flights={flights}
          onFlightDelete={onFlightDelete}
          onFlightChange={onFlightChange}
          backgroundStyle={backgroundStyle}
          departureColumns={departureColumns}
          onPDCOpen={handlePDCOpen}
          flashingPDCIds={flashingPDCIds}
          onStopFlashing={handleStopFlashing}
        />
        <PDCModal
          isOpen={pdcModalOpen}
          onClose={handlePDCClose}
          flight={selectedFlight}
          onIssuePDC={onIssuePDC}
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
          No departures found.
        </div>
      ) : (
        <div className="table-view">
          <table className="min-w-full rounded-lg" id={id}>
            <thead>
              <tr className="bg-blue-950 text-blue-200">
                {/* Drag handle column */}
                <th className="py-2.5 px-2 text-left w-8"></th>
                {/* Time column */}
                <th className="py-2.5 px-4 text-left column-time">TIME</th>
                {departureColumns.callsign !== false && (
                  <th className="py-2.5 px-4 text-left w">CALLSIGN</th>
                )}
                {departureColumns.stand !== false && (
                  <th className="py-2.5 px-4 text-left w-24 column-stand">
                    STAND
                  </th>
                )}
                {departureColumns.aircraft !== false && (
                  <th className="py-2.5 px-4 text-left column-atyp">ATYP</th>
                )}
                {departureColumns.wakeTurbulence !== false && (
                  <th className="py-2.5 px-4 text-left column-w">W</th>
                )}
                {departureColumns.flightType !== false && (
                  <th className="py-2.5 px-4 text-left column-flight-type">
                    V
                  </th>
                )}
                {departureColumns.arrival !== false && (
                  <th className="py-2.5 px-4 text-left column-ades">ADES</th>
                )}
                {departureColumns.runway !== false && (
                  <th className="py-2.5 px-4 text-left column-rwy">RWY</th>
                )}
                {departureColumns.sid !== false && (
                  <th className="py-2.5 px-4 text-left column-sid">SID</th>
                )}
                {departureColumns.rfl !== false && (
                  <th className="py-2.5 px-4 text-left column-rfl">RFL</th>
                )}
                {departureColumns.cfl !== false && (
                  <th className="py-2.5 px-4 text-left column-cfl">CFL</th>
                )}
                {departureColumns.route !== false && (
                  <th className="py-2.5 px-4 text-left column-route">RTE</th>
                )}
                {departureColumns.squawk !== false && (
                  <th className="py-2.5 px-4 text-center w-28">ASSR</th>
                )}
                {departureColumns.clearance !== false && (
                  <th className="py-2.5 px-4 text-left column-clearance">C</th>
                )}
                {departureColumns.status !== false && (
                  <th className="py-2.5 px-4 text-left column-sts">STS</th>
                )}
                {departureColumns.remark !== false && (
                  <th className="py-2.5 px-4 text-left w-64 column-rmk">RMK</th>
                )}
                {departureColumns.pdc !== false && (
                  <th className="py-2.5 px-2 text-left column-pdc">PDC</th>
                )}
                <th className="py-2.5 pr-4 pl-2 text-center column-more">
                  MORE
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleFlights.map((flight, index) => {
                const callsignEditingState = getFieldEditingState(
                  flight.id,
                  'callsign'
                );
                const standEditingState = getFieldEditingState(
                  flight.id,
                  'stand'
                );
                const squawkEditingState = getFieldEditingState(
                  flight.id,
                  'squawk'
                );
                const remarkEditingState = getFieldEditingState(
                  flight.id,
                  'remark'
                );
                const isFlashing =
                  flashingPDCIds?.has(String(flight.id)) &&
                  !isClearanceChecked(flight.clearance);
                const isDragging = draggedFlightId === flight.id;
                const isDragOver = dragOverIndex === index;

                return (
                  <tr
                    key={flight.id}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`flight-row select-none ${
                      flight.hidden ? 'opacity-60 text-gray-400' : ''
                    } ${isDragging ? 'opacity-50' : ''} ${
                      isDragOver ? 'border-t-2 border-blue-400' : ''
                    }`}
                    style={backgroundStyle}
                  >
                    {/* Drag handle column */}
                    <td className="py-2 px-2">
                      <div
                        draggable={true}
                        onDragStart={(e) => handleDragStart(e, flight.id)}
                        className="cursor-move text-zinc-500 hover:text-zinc-300 transition-colors"
                      >
                        <GripVertical className="w-4 h-4" />
                      </div>
                    </td>
                    {/* Time column */}
                    <td className="py-2 px-4 column-time">
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
                    </td>
                    {departureColumns.callsign !== false && (
                      <td className="py-2 px-4">
                        <div title={!airlinesLoading ? parseCallsign(flight.callsign, airlines) : flight.callsign || ''}>
                          <TextInput
                            value={
                              callsignValues[flight.id] ?? (flight.callsign || '')
                            }
                            onChange={(value) =>
                              debouncedHandleCallsignChange(flight.id, value)
                            }
                            className="bg-transparent border-none focus:bg-gray-800 px-1 rounded text-white"
                            placeholder="-"
                            maxLength={16}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.currentTarget.blur();
                              }
                            }}
                            editingAvatar={callsignEditingState?.avatar || null}
                            editingUsername={callsignEditingState?.username}
                            onFocus={() =>
                              handleFieldFocus(flight.id, 'callsign')
                            }
                            onBlur={() => handleFieldBlur(flight.id, 'callsign')}
                          />
                        </div>
                      </td>
                    )}
                    {departureColumns.stand !== false && (
                      <td className="py-2 px-4 column-stand">
                        <TextInput
                          value={standValues[flight.id] ?? (flight.stand || '')}
                          onChange={(value) =>
                            debouncedHandleStandChange(flight.id, value)
                          }
                          className="bg-transparent border-none focus:bg-gray-800 px-1 rounded text-white"
                          placeholder="-"
                          maxLength={8}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.currentTarget.blur();
                            }
                          }}
                          editingAvatar={standEditingState?.avatar || null}
                          editingUsername={standEditingState?.username}
                          onFocus={() => handleFieldFocus(flight.id, 'stand')}
                          onBlur={() => handleFieldBlur(flight.id, 'stand')}
                        />
                      </td>
                    )}
                    {departureColumns.aircraft !== false && (
                      <td className="py-2 px-3 column-atyp">
                        <AircraftDropdown
                          value={flight.aircraft}
                          onChange={(type) =>
                            handleAircraftChange(flight.id, type)
                          }
                          size="xs"
                          showFullName={false}
                        />
                      </td>
                    )}
                    {departureColumns.wakeTurbulence !== false && (
                      <td className="py-2 px-4 column-w">
                        {flight.wtc || '-'}
                      </td>
                    )}
                    {departureColumns.flightType !== false && (
                      <td className="py-2 px-4 column-flight-type">
                        {flight.flight_type || '-'}
                      </td>
                    )}
                    {departureColumns.arrival !== false && (
                      <td className="py-2 px-3 column-ades">
                        <AirportDropdown
                          value={flight.arrival}
                          onChange={(icao) =>
                            handleArrivalChange(flight.id, icao)
                          }
                          size="xs"
                          showFullName={false}
                        />
                      </td>
                    )}
                    {departureColumns.runway !== false && (
                      <td className="py-2 px-3 column-rwy">
                        <RunwayDropdown
                          airportIcao={flight.departure || ''}
                          value={flight.runway}
                          onChange={(runway) =>
                            handleRunwayChange(flight.id, runway)
                          }
                          size="xs"
                          placeholder="-"
                        />
                      </td>
                    )}
                    {departureColumns.sid !== false && (
                      <td className="py-2 px-3 column-sid">
                        <SidDropdown
                          airportIcao={flight.departure || ''}
                          value={flight.sid}
                          onChange={(sid) => handleSidChange(flight.id, sid)}
                          size="xs"
                          placeholder="-"
                        />
                      </td>
                    )}
                    {departureColumns.rfl !== false && (
                      <td className="py-2 px-3 column-rfl">
                        <AltitudeDropdown
                          value={flight.cruisingFL}
                          onChange={(alt) =>
                            handleCruisingFLChange(flight.id, alt)
                          }
                          size="xs"
                          placeholder="-"
                        />
                      </td>
                    )}
                    {departureColumns.cfl !== false && (
                      <td className="py-2 px-3 column-cfl">
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
                    {departureColumns.route !== false && (
                      <td className="py-2 px-3 column-route">
                        <button
                          className={`px-2 py-1 rounded transition-colors ${
                            flight.route && flight.route.trim()
                              ? 'text-gray-400 hover:text-blue-500'
                              : 'text-red-500'
                          }`}
                          onClick={() => handleRouteOpen(flight)}
                          title={
                            flight.route && flight.route.trim()
                              ? 'View Route'
                              : 'No route specified'
                          }
                        >
                          <Route />
                        </button>
                      </td>
                    )}
                    {departureColumns.squawk !== false && (
                      <td className="py-2 px-4">
                        <div className="flex items-center gap-0.5 w-full">
                          <TextInput
                            value={
                              squawkValues[flight.id] ?? (flight.squawk || '')
                            }
                            onChange={(value) =>
                              debouncedHandleSquawkChange(flight.id, value)
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
                            editingAvatar={squawkEditingState?.avatar || null}
                            editingUsername={squawkEditingState?.username}
                            onFocus={() =>
                              handleFieldFocus(flight.id, 'squawk')
                            }
                            onBlur={() => handleFieldBlur(flight.id, 'squawk')}
                          />
                          <button
                            onClick={() => handleRegenerateSquawk(flight.id)}
                            className="text-gray-400 hover:text-blue-500 rounded transition-colors flex-shrink-0 ml-0.5"
                            title="Generate new squawk"
                            type="button"
                          >
                            <RefreshCw className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </td>
                    )}
                    {departureColumns.clearance !== false && (
                      <td className="py-2 px-4 column-clearance">
                        <Checkbox
                          checked={isClearanceChecked(flight.clearance)}
                          onChange={() =>
                            onToggleClearance(
                              flight.id,
                              !isClearanceChecked(flight.clearance)
                            )
                          }
                          label=""
                          checkedClass="bg-green-600 border-green-600"
                        />
                      </td>
                    )}
                    {departureColumns.status !== false && (
                      <td className="py-2 px-4 column-sts">
                        <StatusDropdown
                          value={flight.status}
                          onChange={(status) =>
                            handleStatusChange(flight.id, status)
                          }
                          size="xs"
                          placeholder="-"
                          controllerType="departure"
                        />
                      </td>
                    )}
                    {departureColumns.remark !== false && (
                      <td className="py-2 px-4 column-rmk">
                        <TextInput
                          value={
                            remarkValues[flight.id] ?? (flight.remark || '')
                          }
                          onChange={(value) =>
                            handleRemarkChange(flight.id, value)
                          }
                          className="bg-transparent border-none focus:bg-gray-800 px-1 rounded text-white"
                          placeholder="-"
                          maxLength={500}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                            }
                          }}
                          editingAvatar={remarkEditingState?.avatar || null}
                          editingUsername={remarkEditingState?.username}
                          onFocus={() => handleFieldFocus(flight.id, 'remark')}
                          onBlur={() => handleFieldBlur(flight.id, 'remark')}
                        />
                      </td>
                    )}
                    {departureColumns.pdc !== false && (
                      <td className="py-2 px-2 column-pdc">
                        <button
                          className={`text-gray-400 hover:text-blue-500 px-1 py-2 rounded transition-colors ${
                            isFlashing ? 'animate-pulse' : ''
                          }`}
                          onClick={() => handlePDCOpen(flight)}
                          title="Generate PDC"
                        >
                          <FileSpreadsheet
                            className={isFlashing ? 'text-orange-400' : ''}
                          />
                        </button>
                      </td>
                    )}
                    <td className="py-2 px-2 relative">
                      <button
                        type="button"
                        ref={(el) => {
                          if (el) {
                            buttonRefs.current[flight.id] = el;
                          }
                        }}
                        className="flex items-center justify-center w-full text-gray-400 hover:text-white transition-colors"
                        onClick={() => {
                          setOpenDropdownId(
                            openDropdownId === flight.id ? null : flight.id
                          );
                        }}
                        title="Actions"
                      >
                        <Menu className="h-6 w-6" strokeWidth={2.5} />
                      </button>
                      {openDropdownId === flight.id &&
                        createPortal(
                          <>
                            <div
                              className="fixed inset-0"
                              style={{ zIndex: 9997 }}
                              onClick={() => setOpenDropdownId(null)}
                            />
                            <div
                              className="fixed w-40 bg-gray-800 border border-blue-600 rounded-2xl shadow-lg py-1 overflow-hidden"
                              style={{
                                zIndex: 9998,
                                top: (() => {
                                  const btn = buttonRefs.current[flight.id];
                                  if (btn) {
                                    const rect = btn.getBoundingClientRect();
                                    return `${rect.bottom + 4}px`;
                                  }
                                  return '0px';
                                })(),
                                left: (() => {
                                  const btn = buttonRefs.current[flight.id];
                                  if (btn) {
                                    const rect = btn.getBoundingClientRect();
                                    return `${rect.right - 160}px`;
                                  }
                                  return '0px';
                                })(),
                              }}
                            >
                              <button
                                type="button"
                                className="w-full text-left px-3 py-2 text-sm hover:bg-blue-600 hover:text-white flex items-center gap-2"
                                onClick={() => {
                                  if (flight.hidden) {
                                    handleUnhideFlight(flight.id);
                                  } else {
                                    handleHideFlight(flight.id);
                                  }
                                  setOpenDropdownId(null);
                                }}
                              >
                                {flight.hidden ? (
                                  <Eye className="w-4 h-4" />
                                ) : (
                                  <EyeOff className="w-4 h-4" />
                                )}
                                {flight.hidden ? 'Unhide' : 'Hide'}
                              </button>
                              <button
                                type="button"
                                className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-blue-600 hover:text-white flex items-center gap-2"
                                onClick={() => {
                                  handleDeleteClick(flight.id);
                                  setOpenDropdownId(null);
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                                Delete
                              </button>
                            </div>
                          </>,
                          document.body
                        )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <PDCModal
        isOpen={pdcModalOpen}
        onClose={handlePDCClose}
        flight={selectedFlight}
        onIssuePDC={onIssuePDC}
      />

      <RouteModal
        isOpen={routeModalOpen}
        onClose={handleRouteClose}
        flight={selectedFlight}
        onFlightChange={onFlightChange}
      />

      <ConfirmationDialog
        isOpen={deleteConfirmOpen}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        title="Delete Flight Plan"
        description="This will delete the flight plan for all controllers and is not recommended if you are handing the strip off. It's recommended to hide it instead."
        confirmText="Delete Anyway"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
}
