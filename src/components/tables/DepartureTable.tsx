import { useState, useCallback, useRef, useEffect, useMemo, memo } from 'react';
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
import { fetchStars, fetchSids } from '../../utils/fetch/data';

const looksLikeProcedure = (s: string) => /^[A-Z]{2,5}\d[A-Z]?$/i.test(s);

const sidWaypoint = (sid: string) =>
  /^([A-Z]{2,5})\d[A-Z]?$/i.exec(sid)?.[1]?.toUpperCase();

/**
 * Replace the SID token in a route string with newSid, and update the
 * connecting waypoint that immediately follows it.
 *
 * @param oldSidHint - the flight's stored sid field (may differ from what
 *   was auto-inserted into the route string, e.g. NOVMA1X vs NOVM1X).
 *   Used to derive the expected connecting-waypoint prefix reliably.
 */

function updateRouteWithSid(
  route: string,
  newSid: string,
  oldSidHint: string | undefined,
  departure?: string,
  arrival?: string
): string {
  const tokens = route.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return newSid || '';
  let start = 0;
  let end = tokens.length - 1;
  if (departure && tokens[start]?.toUpperCase() === departure.toUpperCase())
    start++;
  if (
    arrival &&
    end >= start &&
    tokens[end]?.toUpperCase() === arrival.toUpperCase()
  )
    end--;

  let sidIdx = -1;
  let oldSidInRoute = '';

  if (start <= end && looksLikeProcedure(tokens[start])) {
    oldSidInRoute = tokens[start];
    sidIdx = start;
    if (newSid) tokens[start] = newSid;
    else tokens.splice(start, 1);
  } else {
    if (newSid) {
      tokens.splice(start, 0, newSid);
      sidIdx = start;
    }
  }

  if (sidIdx !== -1 && newSid) {
    const effectiveOld = oldSidHint || oldSidInRoute;
    const oldWp = effectiveOld ? sidWaypoint(effectiveOld) : undefined;
    const newWp = sidWaypoint(newSid);
    const nextIdx = sidIdx + 1;
    if (oldWp && newWp && tokens[nextIdx]) {
      const next = tokens[nextIdx].toUpperCase();
      // Match exact prefix OR route waypoint that starts with the prefix
      if (next === oldWp || next.startsWith(oldWp)) {
        tokens[nextIdx] = newWp;
      }
    }
  }

  return tokens.join(' ');
}

/**
 * When the arrival airport changes, strip the old STAR + its connecting
 * waypoint and the old arrival ICAO from the end of the route, then append
 * the new STAR's connecting waypoint + new STAR + new arrival.
 */
function updateRouteWithArrival(
  route: string,
  newArrival: string,
  oldArrival?: string,
  oldStar?: string,
  newStar?: string
): string {
  const tokens = route.trim().split(/\s+/).filter(Boolean);

  // Strip old arrival ICAO from end
  if (
    oldArrival &&
    tokens[tokens.length - 1]?.toUpperCase() === oldArrival.toUpperCase()
  ) {
    tokens.pop();
  }

  // Strip old STAR from end
  let strippedStar = false;
  if (tokens.length > 0) {
    const last = tokens[tokens.length - 1].toUpperCase();
    const oldStarUp = oldStar?.toUpperCase();
    if (
      (oldStarUp && last === oldStarUp) ||
      (!oldStarUp && looksLikeProcedure(last))
    ) {
      tokens.pop();
      strippedStar = true;
    }
  }

  // Strip old STAR's connecting waypoint from end
  if (strippedStar && tokens.length > 0 && oldStar) {
    const oldWp = sidWaypoint(oldStar);
    if (oldWp) {
      const last = tokens[tokens.length - 1].toUpperCase();
      if (last === oldWp || last.startsWith(oldWp)) {
        tokens.pop();
      }
    }
  }

  // Append new STAR's connecting waypoint + new STAR + new arrival
  if (newStar && !newStar.includes(' ')) {
    const newWp = sidWaypoint(newStar);
    if (newWp) tokens.push(newWp);
    tokens.push(newStar.toUpperCase());
  }
  tokens.push(newArrival.toUpperCase());

  return tokens.join(' ');
}

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
  activeRunway?: string | null;
}

function DepartureTable({
  flights,
  onFlightDelete,
  onFlightChange,
  backgroundStyle,
  departureColumns = {
    time: true,
    callsign: true,
    req: true,
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
  activeRunway,
}: DepartureTableProps) {
  const { airlines, loading: airlinesLoading } = useData();
  const [showHidden, setShowHidden] = useState(false);
  const [pdcModalOpen, setPdcModalOpen] = useState(false);
  const [routeModalOpen, setRouteModalOpen] = useState(false);
  const [selectedFlight, setSelectedFlight] = useState<Flight | null>(null);
  const [routeFlightId, setRouteFlightId] = useState<string | number | null>(
    null
  );
  const routeFlight =
    routeFlightId != null
      ? (flights.find((f) => f.id === routeFlightId) ?? null)
      : null;
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
  const isNarrow = useMediaQuery({ maxWidth: 1349 });
  const isTableCramped = useMediaQuery({ minWidth: 1001, maxWidth: 1200 });

  const [, setReqTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setReqTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const [reqOptimistic, setReqOptimistic] = useState<
    Map<string | number, { req_at: string | null; req_phase: string | null }>
  >(new Map());

  useEffect(() => {
    setReqOptimistic((prev) => {
      if (prev.size === 0) return prev;
      const next = new Map(prev);
      let changed = false;
      for (const [id, opt] of prev) {
        const flight = flights.find((f) => f.id === id);
        if (!flight) {
          next.delete(id);
          changed = true;
          continue;
        }
        const serverAt = flight.req_at ?? null;
        const optAt = opt.req_at ?? null;
        const synced =
          (serverAt === null && optAt === null) ||
          (serverAt !== null &&
            optAt !== null &&
            Math.abs(new Date(serverAt).getTime() - new Date(optAt).getTime()) <
              5000);
        if (synced) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [flights]);

  const getReqData = (flight: Flight) => {
    const opt = reqOptimistic.get(flight.id);
    return opt !== undefined
      ? opt
      : { req_at: flight.req_at ?? null, req_phase: flight.req_phase ?? null };
  };

  const reqPositions = useMemo(() => {
    const byPhase: Record<
      string,
      Array<{ id: string | number; req_at: string }>
    > = {};
    for (const f of flights) {
      const { req_at, req_phase } = getReqData(f);
      if (!req_at) continue;
      const phase = req_phase || 'G';
      if (!byPhase[phase]) byPhase[phase] = [];
      byPhase[phase].push({ id: f.id, req_at });
    }
    for (const phase of Object.keys(byPhase)) {
      byPhase[phase].sort((a, b) => a.req_at.localeCompare(b.req_at));
    }
    const result = new Map<string | number, { label: string; pos: number }>();
    for (const [phase, list] of Object.entries(byPhase)) {
      list.forEach(({ id }, idx) => {
        const pos = idx + 1;
        const label = phase === 'G' ? `REQ${pos}` : `R${pos}${phase}`;
        result.set(id, { label, pos });
      });
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flights, reqOptimistic]);

  const formatReqElapsed = (req_at: string) => {
    const elapsed = Math.max(
      0,
      Math.floor((Date.now() - new Date(req_at).getTime()) / 1000)
    );
    const m = Math.floor(elapsed / 60);
    const s = elapsed % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const getReqColor = (req_at: string): string => {
    const elapsed = Math.max(
      0,
      (Date.now() - new Date(req_at).getTime()) / 1000
    );
    const progress = Math.min(1, elapsed / 300);
    const hue = Math.round(48 * (1 - progress));
    return `hsl(${hue}, 90%, 58%)`;
  };

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

  const [sortColumn, setSortColumn] = useState<string>('time');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

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

  const getSortValue = useCallback(
    (flight: Flight, column: string) => {
      switch (column) {
        case 'time':
          return flight.timestamp || 0;
        case 'callsign':
          return flight.callsign || '';
        case 'stand':
          return flight.stand || '';
        case 'aircraft':
          return flight.aircraft || '';
        case 'wakeTurbulence':
          return flight.wtc || '';
        case 'flightType':
          return flight.flight_type || '';
        case 'arrival':
          return flight.arrival || '';
        case 'runway':
          return flight.runway || '';
        case 'sid':
          return flight.sid || '';
        case 'rfl':
          return flight.cruisingFL || '';
        case 'cfl':
          return flight.clearedFL || '';
        case 'route':
          return flight.route || '';
        case 'squawk':
          return flight.squawk || '';
        case 'clearance':
          return isClearanceChecked(flight.clearance) ? 1 : 0;
        case 'status':
          return flight.status || '';
        case 'remark':
          return flight.remark || '';
        case 'req':
          return getReqData(flight).req_at ?? '';
        default:
          return '';
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [reqOptimistic]
  );

  const sortedFlights = useMemo(() => {
    const flightsToSort = [...orderedFlights];
    if (sortColumn) {
      flightsToSort.sort((a, b) => {
        const aVal = getSortValue(a, sortColumn);
        const bVal = getSortValue(b, sortColumn);
        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return flightsToSort;
  }, [orderedFlights, sortColumn, sortDirection, getSortValue]);

  const handleSort = useCallback(
    (column: string) => {
      if (sortColumn === column) {
        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
      } else {
        setSortColumn(column);
        setSortDirection('asc');
      }
    },
    [sortColumn, sortDirection]
  );

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

  const handleArrivalChange = async (
    flightId: string | number,
    arrival: string
  ) => {
    if (!onFlightChange) return;
    const flight = flights.find((f) => f.id === flightId);

    const isVfr = flight?.flight_type === 'VFR';
    const isLocal =
      isVfr ||
      (!!arrival &&
        !!flight?.departure &&
        arrival.toUpperCase() === flight.departure.toUpperCase());

    let newSid = '';
    if (isLocal) {
      newSid = 'RADAR VECTORS';
    } else {
      try {
        const sids = await fetchSids(flight?.departure || '');
        newSid = sids.find((s) => s.length > 0 && !s.includes(' ')) || '';
      } catch {
        newSid = '';
      }
    }

    let newStar = '';
    if (isLocal) {
      newStar = 'RADAR VECTORS';
    } else {
      try {
        const stars = await fetchStars(arrival);
        newStar = stars.find((s) => s.length > 0 && !s.includes(' ')) || '';
      } catch {
        // fetch failed — leave star empty
      }
    }

    const sidForRoute = newSid && !newSid.includes(' ') ? newSid : '';
    let route = updateRouteWithSid(
      flight?.route || '',
      sidForRoute,
      flight?.sid,
      flight?.departure,
      flight?.arrival
    );
    route = updateRouteWithArrival(
      route,
      arrival,
      flight?.arrival,
      flight?.star,
      newStar
    );

    onFlightChange(flightId, { arrival, sid: newSid, star: newStar, route });
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
      const flight = flights.find((f) => f.id === flightId);
      const sidForRoute = looksLikeProcedure(sid) ? sid : '';
      const route = updateRouteWithSid(
        flight?.route || '',
        sidForRoute,
        flight?.sid,
        flight?.departure,
        flight?.arrival
      );
      onFlightChange(flightId, { sid, route });
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
      const flight = flights.find((f) => f.id === flightId);
      const updates: Partial<Flight> = { status };
      if (getReqData(flight!).req_at) {
        updates.req_at = null;
        updates.req_phase = null;
        setReqOptimistic((prev) =>
          new Map(prev).set(flightId, { req_at: null, req_phase: null })
        );
      }
      onFlightChange(flightId, updates);
    }
  };

  const handleToggleClearance = (
    flightId: string | number,
    checked: boolean
  ) => {
    onToggleClearance(flightId, checked);
    if (checked && onFlightChange) {
      const flight = flights.find((f) => f.id === flightId);
      if (flight && getReqData(flight).req_at) {
        setReqOptimistic((prev) =>
          new Map(prev).set(flightId, { req_at: null, req_phase: null })
        );
        onFlightChange(flightId, { req_at: null, req_phase: null });
      }
    }
  };

  const handleReqToggle = (flight: Flight) => {
    if (!onFlightChange) return;
    const current = getReqData(flight);
    if (current.req_at) {
      setReqOptimistic((prev) =>
        new Map(prev).set(flight.id, { req_at: null, req_phase: null })
      );
      onFlightChange(flight.id, { req_at: null, req_phase: null });
    } else {
      const status = (flight.status || '').toLowerCase();
      const cleared = isClearanceChecked(flight.clearance);
      let phase: string;
      if (status === 'pending' && !cleared) phase = 'C';
      else if (status === 'pending' && cleared) phase = 'P';
      else if (status === 'push') phase = 'T';
      else phase = 'G';
      const newReqAt = new Date().toISOString();
      setReqOptimistic((prev) =>
        new Map(prev).set(flight.id, { req_at: newReqAt, req_phase: phase })
      );
      onFlightChange(flight.id, { req_at: newReqAt, req_phase: phase });
    }
  };

  const visibleFlights = showHidden
    ? sortedFlights
    : sortedFlights.filter((flight) => !flight.hidden);
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
    setRouteFlightId(flight.id);
    setRouteModalOpen(true);
  };

  const handleRouteClose = () => {
    setRouteModalOpen(false);
    setRouteFlightId(null);
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
          flight={routeFlight}
          activeRunway={activeRunway}
          onFlightChange={onFlightChange}
        />
      </>
    );
  }

  return (
    <div className="mt-6 px-4">
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
                <th className="py-2.5 px-2 text-left w-8 select-none hover:bg-blue-700"></th>
                {/* Time column */}
                <th
                  className="py-2.5 px-4 text-left column-time cursor-pointer select-none hover:bg-blue-700"
                  onClick={() => handleSort('time')}
                >
                  TIME
                </th>
                {departureColumns.callsign !== false && (
                  <th
                    className="py-2.5 px-4 text-left column-callsign w cursor-pointer select-none hover:bg-blue-700"
                    onClick={() => handleSort('callsign')}
                  >
                    CALLSIGN
                  </th>
                )}
                {departureColumns.req !== false && !isNarrow && (
                  <th
                    className="py-2.5 px-2 text-left w-16 column-req cursor-pointer select-none hover:bg-blue-700"
                    onClick={() => handleSort('req')}
                  >
                    REQ
                    {sortColumn === 'req'
                      ? sortDirection === 'asc'
                        ? ' ↑'
                        : ' ↓'
                      : ''}
                  </th>
                )}
                {departureColumns.stand !== false && (
                  <th
                    className="py-2.5 px-4 text-left w-24 column-stand cursor-pointer select-none hover:bg-blue-700"
                    onClick={() => handleSort('stand')}
                  >
                    STAND
                  </th>
                )}
                {departureColumns.aircraft !== false && (
                  <th
                    className="py-2.5 px-4 text-left column-atyp cursor-pointer select-none hover:bg-blue-700"
                    onClick={() => handleSort('aircraft')}
                  >
                    ATYP
                  </th>
                )}
                {departureColumns.wakeTurbulence !== false && (
                  <th
                    className="py-2.5 px-4 text-left column-w cursor-pointer select-none hover:bg-blue-700"
                    onClick={() => handleSort('wakeTurbulence')}
                  >
                    W
                  </th>
                )}
                {departureColumns.flightType !== false && (
                  <th
                    className="py-2.5 px-4 text-left column-flight-type cursor-pointer select-none hover:bg-blue-700"
                    onClick={() => handleSort('flightType')}
                  >
                    V
                  </th>
                )}
                {departureColumns.arrival !== false && (
                  <th
                    className="py-2.5 px-4 text-left column-ades cursor-pointer select-none hover:bg-blue-700"
                    onClick={() => handleSort('arrival')}
                  >
                    ADES
                  </th>
                )}
                {departureColumns.runway !== false && (
                  <th
                    className="py-2.5 px-4 text-left column-rwy cursor-pointer select-none hover:bg-blue-700"
                    onClick={() => handleSort('runway')}
                  >
                    RWY
                  </th>
                )}
                {departureColumns.sid !== false && (
                  <th
                    className="py-2.5 px-4 text-left column-sid cursor-pointer select-none hover:bg-blue-700"
                    onClick={() => handleSort('sid')}
                  >
                    SID
                  </th>
                )}
                {departureColumns.rfl !== false && (
                  <th
                    className="py-2.5 px-4 text-left column-rfl cursor-pointer select-none hover:bg-blue-700"
                    onClick={() => handleSort('rfl')}
                  >
                    RFL
                  </th>
                )}
                {departureColumns.cfl !== false && (
                  <th
                    className="py-2.5 px-4 text-left column-cfl cursor-pointer select-none hover:bg-blue-700"
                    onClick={() => handleSort('cfl')}
                  >
                    CFL
                  </th>
                )}
                {departureColumns.route !== false && (
                  <th
                    className="py-2.5 px-4 text-left column-route cursor-pointer select-none hover:bg-blue-700"
                    onClick={() => handleSort('route')}
                  >
                    RTE
                  </th>
                )}
                {departureColumns.squawk !== false && (
                  <th
                    className="py-2.5 px-4 text-center w-28 cursor-pointer select-none hover:bg-blue-700"
                    onClick={() => handleSort('squawk')}
                  >
                    ASSR
                  </th>
                )}
                {departureColumns.clearance !== false && (
                  <th
                    className="py-2.5 px-4 text-left column-clearance cursor-pointer select-none hover:bg-blue-700"
                    onClick={() => handleSort('clearance')}
                  >
                    C
                  </th>
                )}
                {departureColumns.status !== false && (
                  <th
                    className="py-2.5 px-4 text-left column-sts cursor-pointer select-none hover:bg-blue-700"
                    onClick={() => handleSort('status')}
                  >
                    STS
                  </th>
                )}
                {departureColumns.remark !== false && (
                  <th
                    className="py-2.5 px-4 text-left w-64 column-rmk cursor-pointer select-none hover:bg-blue-700"
                    onClick={() => handleSort('remark')}
                  >
                    RMK
                  </th>
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
                        {flight.timestamp || flight.created_at
                          ? new Date(
                              flight.timestamp || flight.created_at!
                            ).toLocaleTimeString('en-GB', {
                              hour: '2-digit',
                              minute: '2-digit',
                              timeZone: 'UTC',
                            })
                          : '--'}
                      </span>
                    </td>
                    {departureColumns.callsign !== false && (
                      <td className="py-2 px-4 column-callsign">
                        <div className="relative group/callsign">
                          <TextInput
                            value={
                              callsignValues[flight.id] ??
                              (flight.callsign || '')
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
                            onBlur={() =>
                              handleFieldBlur(flight.id, 'callsign')
                            }
                          />
                          {!airlinesLoading && flight.callsign && (
                            <div className="pointer-events-none absolute bottom-full left-0 mb-1 z-50 opacity-0 group-hover/callsign:opacity-100 transition-opacity duration-0">
                              <div className="bg-zinc-800 border border-zinc-600 text-white text-xs rounded px-2 py-1 whitespace-nowrap shadow-lg">
                                {parseCallsign(flight.callsign, airlines)}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    )}
                    {departureColumns.req !== false &&
                      !isNarrow &&
                      (() => {
                        const { req_at, req_phase: _ } = getReqData(flight);
                        return (
                          <td
                            className="py-2 px-2 column-req cursor-pointer select-none"
                            onClick={() => handleReqToggle(flight)}
                            title={
                              req_at
                                ? 'Click to clear request'
                                : 'Click to mark as on-request'
                            }
                          >
                            {req_at ? (
                              <div className="flex flex-col items-center leading-tight">
                                <span
                                  className="text-xs font-bold"
                                  style={{ color: getReqColor(req_at) }}
                                >
                                  {reqPositions.get(flight.id)?.label ?? 'REQ'}
                                </span>
                                <span
                                  className="text-xs"
                                  style={{ color: getReqColor(req_at) }}
                                >
                                  {formatReqElapsed(req_at)}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center opacity-40 hover:opacity-70 transition-opacity">
                                <span className="text-xs text-zinc-300">
                                  REQ
                                </span>
                              </div>
                            )}
                          </td>
                        );
                      })()}
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
                            className="text-gray-400 hover:text-blue-500 rounded transition-colors shrink-0 ml-0.5"
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
                            handleToggleClearance(
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
                              className="fixed w-44 bg-zinc-900 border border-blue-600 rounded-3xl shadow-2xl backdrop-blur-xl overflow-hidden"
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
                                    return `${rect.right - 176}px`;
                                  }
                                  return '0px';
                                })(),
                              }}
                            >
                              <div className="p-1.5">
                                {isTableCramped &&
                                  departureColumns.pdc !== false && (
                                    <button
                                      type="button"
                                      className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-2xl text-zinc-400 hover:bg-blue-800 hover:text-zinc-50 transition-colors duration-150 text-sm ${
                                        isFlashing ? 'text-orange-400' : ''
                                      }`}
                                      onClick={() => {
                                        handlePDCOpen(flight);
                                        setOpenDropdownId(null);
                                      }}
                                    >
                                      <FileSpreadsheet
                                        className={`w-4 h-4 shrink-0 ${isFlashing ? 'text-orange-400' : ''}`}
                                      />
                                      <span className="font-medium">
                                        Generate PDC
                                      </span>
                                    </button>
                                  )}
                                <button
                                  type="button"
                                  className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-2xl text-zinc-400 hover:bg-blue-800 hover:text-zinc-50 transition-colors duration-150 text-sm"
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
                                    <Eye className="w-4 h-4 shrink-0" />
                                  ) : (
                                    <EyeOff className="w-4 h-4 shrink-0" />
                                  )}
                                  <span className="font-medium">
                                    {flight.hidden ? 'Unhide' : 'Hide'}
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-2xl text-red-400 hover:bg-blue-800 hover:text-zinc-50 transition-colors duration-150 text-sm"
                                  onClick={() => {
                                    handleDeleteClick(flight.id);
                                    setOpenDropdownId(null);
                                  }}
                                >
                                  <Trash2 className="w-4 h-4 shrink-0" />
                                  <span className="font-medium">Delete</span>
                                </button>
                              </div>
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
        flight={routeFlight}
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

export default memo(DepartureTable);
