import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  MapPin,
  Plane,
  Clock,
  Search,
  Filter,
  RefreshCw,
  TowerControl,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Map as MapIcon,
  Radio,
  PlaneLanding,
  PlaneTakeoff,
} from 'lucide-react';
import { createOverviewSocket } from '../sockets/overviewSocket';
import { createFlightsSocket } from '../sockets/flightsSocket';
import { createSectorControllerSocket } from '../sockets/sectorControllerSocket';
import { updateFlight as updateFlightAPI } from '../utils/fetch/flights';
import { useAuth } from '../hooks/auth/useAuth';
import { getChartsForAirport } from '../utils/acars';
import { createChartHandlers } from '../utils/charts';
import type { OverviewData, OverviewSession } from '../types/overview';
import type { Flight } from '../types/flight';
import Navbar from '../components/Navbar';
import WindDisplay from '../components/tools/WindDisplay';
import FrequencyDisplay from '../components/tools/FrequencyDisplay';
import ChartDrawer from '../components/tools/ChartDrawer';
import ContactAcarsSidebar from '../components/tools/ContactAcarsSidebar';
import ChatSidebar from '../components/tools/ChatSidebar';
import Button from '../components/common/Button';
import Dropdown from '../components/common/Dropdown';
import TextInput from '../components/common/TextInput';
import StatusDropdown from '../components/dropdowns/StatusDropdown';
import AirportDropdown from '../components/dropdowns/AirportDropdown';
import AircraftDropdown from '../components/dropdowns/AircraftDropdown';
import AltitudeDropdown from '../components/dropdowns/AltitudeDropdown';
import SidDropdown from '../components/dropdowns/SidDropdown';
import StarDropdown from '../components/dropdowns/StarDropdown';
import Loader from '../components/common/Loader';
import ErrorScreen from '../components/common/ErrorScreen';

interface FlightWithDetails extends Flight {
  sessionId: string;
  departureAirport: string;
}

interface EditingState {
  flightId: string | number;
  field: string;
  value: string;
  originalValue: string;
}

export default function PFATCFlights() {
  const { user } = useAuth();
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAirport, setSelectedAirport] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedFlightType, setSelectedFlightType] = useState<string>('');
  const [sortBy, setSortBy] = useState<'time' | 'callsign' | 'airport'>('time');
  const [expandedAirports, setExpandedAirports] = useState<Set<string>>(
    new Set()
  );
  const [editingState, setEditingState] = useState<EditingState | null>(null);
  const [debounceTimers, setDebounceTimers] = useState<
    Map<string, NodeJS.Timeout>
  >(new Map());
  const [optimisticUpdates, setOptimisticUpdates] = useState<
    Map<string, Partial<Flight>>
  >(new Map());
  const [flightSockets, setFlightSockets] = useState<
    Map<string, ReturnType<typeof createFlightsSocket>>
  >(new Map());
  const [updatingFlights, setUpdatingFlights] = useState<Set<string>>(
    new Set()
  );
  const [selectedStation, setSelectedStation] = useState<string>('');

  const [isChartDrawerOpen, setIsChartDrawerOpen] = useState(false);
  const [selectedChart, setSelectedChart] = useState<string | null>(null);
  const [chartLoadError, setChartLoadError] = useState(false);
  const [chartZoom, setChartZoom] = useState(1);
  const [chartPan, setChartPan] = useState({ x: 0, y: 0 });
  const [isChartDragging, setIsChartDragging] = useState(false);
  const [chartDragStart, setChartDragStart] = useState({ x: 0, y: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null!);

  const [isContactSidebarOpen, setIsContactSidebarOpen] = useState(false);
  const [activeAcarsFlights, setActiveAcarsFlights] = useState<
    Set<string | number>
  >(new Set());
  const [eventControllerViewEnabled, setEventControllerViewEnabled] =
    useState(false);

  const [chatOpen, setChatOpen] = useState(false);
  const [unreadMentions, setUnreadMentions] = useState(0);

  useEffect(() => {
    if (chatOpen) {
      setUnreadMentions(0);
    }
  }, [chatOpen]);

  useEffect(() => {
    if (!selectedStation && chatOpen) {
      setChatOpen(false);
    }
  }, [selectedStation, chatOpen]);

  const isEventController =
    user?.rolePermissions?.['event_controller'] ||
    (user as { roles?: { name: string }[] })?.roles?.some(
      (role) => role.name === 'Event Controller'
    ) ||
    user?.isAdmin;

  const chartHandlers = useMemo(
    () =>
      createChartHandlers(
        chartZoom,
        setChartZoom,
        chartPan,
        setChartPan,
        isChartDragging,
        setIsChartDragging,
        chartDragStart,
        setChartDragStart,
        containerRef,
        imageSize
      ),
    [
      chartZoom,
      chartPan,
      isChartDragging,
      chartDragStart,
      imageSize.width,
      imageSize.height,
    ]
  );

  const handleMentionReceived = useCallback(() => {
    setUnreadMentions((prev) => prev + 1);
  }, []);

  useEffect(() => {
    const socket = createOverviewSocket(
      (data) => {
        const transformedArrivalsByAirport: Record<
          string,
          (Flight & { sessionId: string; departureAirport: string })[]
        > = {};

        if (data.arrivalsByAirport && data.activeSessions) {
          for (const [icao, flights] of Object.entries(
            data.arrivalsByAirport
          )) {
            transformedArrivalsByAirport[icao] = flights.map((flight) => {
              const session = data.activeSessions.find((s) =>
                s.flights.some((f) => f.id === flight.id)
              );
              return {
                ...flight,
                sessionId: session?.sessionId || '',
                departureAirport: flight.departure || '',
              };
            });
          }
        }

        setOverviewData({
          ...data,
          arrivalsByAirport: transformedArrivalsByAirport,
        });
        setLoading(false);
        setError(null);
      },
      (error) => {
        console.error('Overview socket error:', error);
        setError(error.error || 'Failed to connect to overview data');
        setLoading(false);
      }
    );

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!isEventController || !overviewData?.activeSessions) return;

    const realSessions = overviewData.activeSessions.filter(
      (s) => !s.sessionId.startsWith('sector-')
    );

    const activeSessions = new Set(realSessions.map((s) => s.sessionId));

    setFlightSockets((prevSockets) => {
      const currentSockets = new Map(prevSockets);

      for (const [sessionId, socket] of currentSockets) {
        if (!activeSessions.has(sessionId)) {
          socket.socket.disconnect();
          currentSockets.delete(sessionId);
        }
      }

      for (const session of realSessions) {
        if (!currentSockets.has(session.sessionId)) {
          try {
            const socket = createFlightsSocket(
              session.sessionId,
              '',
              user?.userId || '',
              user?.username || '',
              (flight: Flight) => {
                setOverviewData((prev) => {
                  if (!prev) return prev;

                  const updatedSessions = prev.activeSessions.map((s) => {
                    if (s.sessionId === session.sessionId) {
                      return {
                        ...s,
                        flights: s.flights.map((f) =>
                          f.id === flight.id ? flight : f
                        ),
                      };
                    }
                    return s;
                  });

                  return {
                    ...prev,
                    activeSessions: updatedSessions,
                  };
                });
              },
              () => {
                console.log(
                  `Socket connected for session: ${session.sessionId}`
                );
              },
              () => {
                console.log(
                  `Socket disconnected for session: ${session.sessionId}`
                );
              },
              (error) => {
                console.error(
                  `Flight socket error for session ${session.sessionId}:`,
                  error
                );
              },
              true
            );
            currentSockets.set(session.sessionId, socket);
          } catch (error) {
            console.error(
              `Failed to create socket for session ${session.sessionId}:`,
              error
            );
          }
        }
      }

      return currentSockets;
    });

    return () => {
      setFlightSockets((sockets) => {
        for (const socket of sockets.values()) {
          socket.socket.disconnect();
        }
        return new Map();
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEventController, overviewData?.activeSessions, user?.userId]);

  useEffect(() => {
    if (!isContactSidebarOpen) return;

    const fetchActiveAcars = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SERVER_URL}/api/flights/acars/active`,
          {
            credentials: 'include',
          }
        );

        if (response.ok) {
          const flights: Flight[] = await response.json();
          setActiveAcarsFlights(new Set(flights.map((f) => f.id)));
        }
      } catch {
        // Ignore errors
      }
    };

    fetchActiveAcars();
  }, [isContactSidebarOpen]);

  const sectorSocketRef = useRef<ReturnType<
    typeof createSectorControllerSocket
  > | null>(null);

  useEffect(() => {
    if (!isEventController || !eventControllerViewEnabled || !user?.userId) {
      if (sectorSocketRef.current) {
        sectorSocketRef.current.socket.disconnect();
        sectorSocketRef.current = null;
      }
      return;
    }

    if (!sectorSocketRef.current) {
      sectorSocketRef.current = createSectorControllerSocket({
        userId: user.userId,
        username: user.username || 'Unknown',
        avatar: user.avatar || null,
      });
    }

    return () => {
      if (sectorSocketRef.current) {
        sectorSocketRef.current.socket.disconnect();
        sectorSocketRef.current = null;
      }
    };
  }, [
    isEventController,
    eventControllerViewEnabled,
    user?.userId,
    user?.username,
    user?.avatar,
  ]);

  useEffect(() => {
    if (!sectorSocketRef.current) return;

    if (selectedStation) {
      sectorSocketRef.current.selectStation(selectedStation);
    } else {
      sectorSocketRef.current.deselectStation();
    }
  }, [selectedStation]);

  const handleSendContact = async (
    flightId: string | number,
    message: string,
    station: string,
    position: string
  ) => {
    const session = overviewData?.activeSessions.find((s) =>
      s.flights.some((f) => f.id === flightId)
    );

    if (!session) {
      throw new Error('Flight session not found');
    }

    const socketData = flightSockets.get(session.sessionId);
    if (!socketData?.socket) {
      throw new Error('No flights socket for this session');
    }

    let finalStation = station;
    let finalPosition = position;

    if (station.endsWith('_CTR')) {
      finalStation = station.replace('_CTR', '');
      finalPosition = 'CTR';
    }

    socketData.socket.emit('contactMe', {
      flightId,
      message,
      station: finalStation,
      position: finalPosition,
    });
  };

  const activeAirports =
    overviewData?.activeSessions.map((session) => session.airportIcao) || [];

  const allFlights: FlightWithDetails[] = [];
  overviewData?.activeSessions.forEach((session) => {
    session.flights.forEach((flight) => {
      allFlights.push({
        ...flight,
        sessionId: session.sessionId,
        departureAirport: session.airportIcao,
      });
    });
  });

  const filteredFlights = allFlights.filter((flight) => {
    const matchesSearch =
      !searchTerm ||
      flight.callsign?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      flight.aircraft?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      flight.departure?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      flight.arrival?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesAirport =
      !selectedAirport ||
      flight.departure === selectedAirport ||
      flight.arrival === selectedAirport;

    const matchesStatus = !selectedStatus || flight.status === selectedStatus;
    const matchesFlightType =
      !selectedFlightType || flight.flight_type === selectedFlightType;

    return (
      matchesSearch && matchesAirport && matchesStatus && matchesFlightType
    );
  });

  const airportSessions =
    overviewData?.activeSessions
      .filter((session) => !session.sessionId.startsWith('sector-'))
      .reduce(
        (acc, session) => {
          if (!acc[session.airportIcao]) {
            acc[session.airportIcao] = [];
          }
          acc[session.airportIcao].push(session);
          return acc;
        },
        {} as Record<string, OverviewSession[]>
      ) || {};

  const statusOptions = [
    { label: 'All Statuses', value: '' },
    { label: 'PENDING', value: 'PENDING' },
    { label: 'STUP', value: 'STUP' },
    { label: 'PUSH', value: 'PUSH' },
    { label: 'TAXI (Departure)', value: 'TAXI_ORIG' },
    { label: 'RWY (Departure)', value: 'RWY_ORIG' },
    { label: 'DEPA', value: 'DEPA' },
    { label: 'ENROUTE', value: 'ENROUTE' },
    { label: 'APP', value: 'APP' },
    { label: 'RWY (Arrival)', value: 'RWY_ARRV' },
    { label: 'TAXI (Arrival)', value: 'TAXI_ARRV' },
    { label: 'GATE', value: 'GATE' },
  ];

  const flightTypeOptions = [
    { label: 'All Types', value: '' },
    { label: 'IFR', value: 'IFR' },
    { label: 'VFR', value: 'VFR' },
  ];

  const sortOptions = [
    { label: 'Sort by Time', value: 'time' },
    { label: 'Sort by Callsign', value: 'callsign' },
    { label: 'Sort by Airport', value: 'airport' },
  ];

  const sectorStations = [
    { label: 'Select Station', value: '', frequency: '' },
    { label: 'LECB CTR', value: 'LECB_CTR', frequency: '132.355' },
    { label: 'GCCC R6 CTR', value: 'GCCC_R6_CTR', frequency: '123.650' },
    { label: 'EGTT CTR', value: 'EGTT_CTR', frequency: '127.830' },
    { label: 'EFIN D CTR', value: 'EFIN_D_CTR', frequency: '121.300' },
    { label: 'LCCC CTR', value: 'LCCC_CTR', frequency: '128.600' },
    { label: 'MDCS CTR', value: 'MDCS_CTR', frequency: '124.300' },
  ];

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
      case 'CLEARED':
        return 'bg-green-500/20 text-green-400 border border-green-500/30';
      case 'TAXI':
        return 'bg-pink-500/20 text-pink-400 border border-pink-500/30';
      case 'DEPARTED':
        return 'bg-purple-500/20 text-purple-400 border border-purple-500/30';
      case 'STUP':
        return 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30';
      case 'PUSH':
        return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
      case 'RWY':
        return 'bg-red-500/20 text-red-400 border border-red-500/30';
      case 'DEPA':
        return 'bg-green-500/20 text-green-400 border border-green-500/30';
      case 'ENROUTE':
        return 'bg-purple-500/20 text-purple-400 border border-purple-500/30';
      default:
        return 'bg-zinc-500/20 text-zinc-400 border border-zinc-500/30';
    }
  };

  const toggleAirportExpansion = (icao: string) => {
    setExpandedAirports((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(icao)) {
        newSet.delete(icao);
      } else {
        newSet.add(icao);
      }
      return newSet;
    });
  };

  const refreshData = () => {
    setLoading(true);
    setError(null);
  };

  const handleAutoSave = useCallback(
    async (
      flightId: string | number,
      field: string,
      value: string,
      originalValue: string
    ) => {
      if (value === originalValue) return;

      const flight = allFlights.find((f) => f.id === flightId);
      if (!flight) {
        console.error('Flight not found for editing');
        return;
      }

      setUpdatingFlights((prev) => new Set(prev).add(String(flightId)));

      try {
        const updates: Partial<Flight> = { [field]: value };

        if (field === 'departure' && flight.departure !== value) {
          updates.sid = '';
        }
        if (field === 'arrival' && flight.arrival !== value) {
          updates.star = '';
        }

        // Use websocket for real-time updates
        const socketData = flightSockets.get(flight.sessionId);
        if (socketData?.socket?.connected) {
          socketData.updateFlight(flightId, updates);

          // Remove optimistic update once we get confirmation
          setOptimisticUpdates((prev) => {
            const next = new Map(prev);
            const key = `${flightId}-${field}`;
            next.delete(key);
            return next;
          });
        } else {
          console.warn('Websocket not connected');
          // Remove optimistic update and revert to original
          setOptimisticUpdates((prev) => {
            const next = new Map(prev);
            const key = `${flightId}-${field}`;
            next.delete(key);
            return next;
          });
        }
      } catch (error) {
        console.error('Failed to update flight:', error);
        // Remove optimistic update on error
        setOptimisticUpdates((prev) => {
          const next = new Map(prev);
          const key = `${flightId}-${field}`;
          next.delete(key);
          return next;
        });
      } finally {
        setUpdatingFlights((prev) => {
          const next = new Set(prev);
          next.delete(String(flightId));
          return next;
        });
      }
    },
    [allFlights, flightSockets]
  );

  const handleFieldChange = useCallback(
    (
      flightId: string | number,
      field: string,
      value: string,
      originalValue: string
    ) => {
      // Optimistically update the UI immediately
      const key = `${flightId}-${field}`;
      setOptimisticUpdates((prev) => {
        const next = new Map(prev);
        next.set(key, { [field]: value });
        return next;
      });

      const timerKey = `${flightId}-${field}`;

      // Clear existing timer
      const existingTimer = debounceTimers.get(timerKey);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Set new timer
      const newTimer = setTimeout(() => {
        handleAutoSave(flightId, field, value, originalValue);
        setDebounceTimers((prev) => {
          const next = new Map(prev);
          next.delete(timerKey);
          return next;
        });
      }, 500);

      setDebounceTimers((prev) => {
        const next = new Map(prev);
        next.set(timerKey, newTimer);
        return next;
      });
    },
    [debounceTimers, handleAutoSave]
  );

  // Helper function to get current value with optimistic updates
  const getCurrentValue = useCallback(
    (flight: FlightWithDetails, field: string) => {
      const key = `${flight.id}-${field}`;
      const optimisticUpdate = optimisticUpdates.get(key);
      if (optimisticUpdate && field in optimisticUpdate) {
        return String(optimisticUpdate[field] || '');
      }
      return String((flight as any)[field] || '');
    },
    [optimisticUpdates]
  );

  const renderEditableCell = (
    flight: FlightWithDetails,
    field: string,
    cellType:
      | 'text'
      | 'status'
      | 'airport'
      | 'aircraft'
      | 'altitude'
      | 'sid'
      | 'star' = 'text'
  ) => {
    const isUpdating = updatingFlights.has(String(flight.id));
    const currentValue = getCurrentValue(flight, field);
    const originalValue = String((flight as any)[field] || '');
    const isDisabled = !isEventController || !selectedStation;

    if (!isEventController) {
      return (
        <span className="font-mono text-zinc-300">{currentValue || 'N/A'}</span>
      );
    }

    if (isUpdating) {
      return (
        <div className="flex items-center space-x-1">
          <RefreshCw className="w-3 h-3 animate-spin" />
          <span className="font-mono text-zinc-300">
            {currentValue || 'N/A'}
          </span>
        </div>
      );
    }

    if (cellType === 'status') {
      return (
        <StatusDropdown
          value={currentValue}
          onChange={(value) =>
            handleFieldChange(flight.id, field, value, originalValue)
          }
          size="xs"
          placeholder="-"
          controllerType="event"
          disabled={isDisabled}
        />
      );
    }

    if (cellType === 'airport') {
      return (
        <AirportDropdown
          value={currentValue}
          onChange={(value) =>
            handleFieldChange(flight.id, field, value, originalValue)
          }
          size="xs"
          showFullName={false}
          className="w-full"
          disabled={isDisabled}
        />
      );
    }

    if (cellType === 'aircraft') {
      return (
        <AircraftDropdown
          value={currentValue}
          onChange={(value) =>
            handleFieldChange(flight.id, field, value, originalValue)
          }
          size="xs"
          showFullName={false}
          disabled={isDisabled}
        />
      );
    }

    if (cellType === 'altitude') {
      return (
        <AltitudeDropdown
          value={currentValue}
          onChange={(value) =>
            handleFieldChange(flight.id, field, value, originalValue)
          }
          size="xs"
          placeholder="-"
          disabled={isDisabled}
        />
      );
    }

    if (cellType === 'sid') {
      return (
        <SidDropdown
          airportIcao={flight.departure || ''}
          value={currentValue}
          onChange={(value) =>
            handleFieldChange(flight.id, field, value, originalValue)
          }
          size="xs"
          placeholder="-"
          disabled={isDisabled}
        />
      );
    }

    if (cellType === 'star') {
      return (
        <StarDropdown
          airportIcao={flight.arrival || ''}
          value={currentValue}
          onChange={(value) =>
            handleFieldChange(flight.id, field, value, originalValue)
          }
          size="xs"
          placeholder="-"
          disabled={isDisabled}
        />
      );
    }

    // Text input for callsign, squawk, etc.
    return (
      <TextInput
        value={currentValue}
        onChange={(value) =>
          handleFieldChange(flight.id, field, value, originalValue)
        }
        className={`bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-white text-xs w-full ${
          isDisabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
        maxLength={field === 'callsign' ? 16 : field === 'squawk' ? 4 : 50}
        placeholder={currentValue ? '' : 'N/A'}
        disabled={isDisabled}
      />
    );
  };

  // Clean up timers and optimistic updates on unmount
  useEffect(() => {
    return () => {
      debounceTimers.forEach((timer) => clearTimeout(timer));
      setOptimisticUpdates(new Map());
    };
  }, [debounceTimers]);

  // Clean up optimistic updates when flights change from server
  useEffect(() => {
    setOptimisticUpdates((prev) => {
      const next = new Map();
      // Keep only updates for flights that still exist
      for (const [key, value] of prev.entries()) {
        const [flightId] = key.split('-');
        if (allFlights.some((f) => String(f.id) === flightId)) {
          next.set(key, value);
        }
      }
      return next;
    });
  }, [allFlights]);

  // Always sort by time (latest on top)
  const sortedFlights = [...filteredFlights].sort(
    (a, b) =>
      new Date(b.created_at || 0).getTime() -
      new Date(a.created_at || 0).getTime()
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white">
        <Navbar />
        <div className="pt-16 flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <Loader />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white">
        <Navbar />
        <div className="pt-16 p-4 sm:p-6 lg:p-8">
          <ErrorScreen
            title="Failed to load PFATC Network data"
            message={error}
            onRetry={refreshData}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />

      {/* Header */}
      <div className="bg-gradient-to-b from-zinc-800 to-zinc-900 border-b border-zinc-700/50">
        <div className="max-w-[80%] mx-auto px-4 sm:px-6 py-8 sm:py-12 pt-24 sm:pt-28">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className="p-2 sm:p-3 bg-blue-500/20 rounded-xl mr-3 sm:mr-4">
                <TowerControl className="h-6 w-6 sm:h-8 sm:w-8 text-blue-400" />
              </div>
              <div>
                <h1
                  className="text-3xl sm:text-4xl lg:text-5xl text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-600 font-extrabold mb-2"
                  style={{ lineHeight: 1.2 }}
                >
                  PFATC Network Overview
                </h1>
                <p className="text-gray-400 flex items-center gap-3">
                  <span>
                    Live view of all PFATC flights and active airports
                  </span>
                  {isEventController && (
                    <span
                      className={`text-sm px-3 py-1 rounded-full border ${
                        selectedStation
                          ? 'text-green-400 bg-green-900/30 border-green-700/50'
                          : 'text-orange-400 bg-orange-900/30 border-orange-700/50'
                      }`}
                    >
                      {selectedStation
                        ? `Event Controller - ${selectedStation}`
                        : 'Event Controller - Select Station'}
                    </span>
                  )}
                </p>
              </div>
            </div>
            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 justify-start max-w-[50%]">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <MapPin className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <div className="text-lg font-bold text-white">
                    {overviewData?.totalActiveSessions || 0}
                  </div>
                  <div className="text-zinc-400 text-sm">Active Airports</div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <Plane className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <div className="text-lg font-bold text-white">
                    {overviewData?.totalFlights || 0}
                  </div>
                  <div className="text-zinc-400 text-sm">Total Flights</div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="p-2 bg-orange-500/20 rounded-lg">
                  <Clock className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <div className="text-lg font-medium text-white">
                    {overviewData?.lastUpdated
                      ? new Date(overviewData.lastUpdated).toLocaleTimeString()
                      : 'Never'}
                  </div>
                  <div className="text-zinc-400 text-sm">Last Updated</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[80%] mx-auto p-4 sm:p-6 lg:p-8">
        {/* Event Controller Panel - Always shown for event controllers */}
        {isEventController && (
          <div className="mb-6 sm:mb-8">
            <div className="flex flex-wrap items-center gap-3 bg-zinc-900 border-2 border-zinc-700/50 rounded-2xl p-4">
              <Dropdown
                options={sectorStations.map((s) => ({
                  label: s.label,
                  value: s.value,
                }))}
                value={selectedStation}
                onChange={setSelectedStation}
                placeholder="Select Station to Enable Controls"
                className="min-w-[200px]"
                size="sm"
              />

              {selectedStation && (
                <FrequencyDisplay
                  airportIcao={selectedStation}
                  showExpandedTable={false}
                />
              )}

              <div className="flex-1" />

              <Button
                className="flex items-center gap-2 px-4 py-2"
                aria-label="Contact"
                size="sm"
                onClick={() => {
                  setChatOpen(false);
                  setIsChartDrawerOpen(false);
                  setIsContactSidebarOpen((prev) => !prev);
                }}
                disabled={!selectedStation}
              >
                <Radio className="w-5 h-5" />
                <span className="hidden sm:inline font-medium">Contact</span>
              </Button>

              <Button
                className="flex items-center gap-2 px-4 py-2 relative"
                aria-label="Chat"
                size="sm"
                onClick={() => {
                  setIsContactSidebarOpen(false);
                  setIsChartDrawerOpen(false);
                  setChatOpen((prev) => !prev);
                }}
                disabled={!selectedStation}
              >
                <MessageSquare className="w-5 h-5" />
                <span className="hidden sm:inline font-medium">Chat</span>
                {unreadMentions > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {unreadMentions}
                  </span>
                )}
              </Button>

              <Button
                className="flex items-center gap-2 px-4 py-2"
                aria-label="Charts"
                size="sm"
                onClick={() => {
                  setIsContactSidebarOpen(false);
                  setChatOpen(false);
                  setIsChartDrawerOpen((prev) => !prev);
                }}
                disabled={!selectedStation}
              >
                <MapIcon className="w-5 h-5" />
                <span className="hidden sm:inline font-medium">Charts</span>
              </Button>
            </div>
          </div>
        )}

        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col lg:flex-row gap-4 mb-6">
            <div className="flex-1 relative group">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-zinc-400 group-focus-within:text-blue-500 transition-colors" />
              <input
                type="text"
                placeholder="Search by callsign, aircraft, departure, or arrival..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-zinc-900/50 border-2 border-zinc-700 rounded-full text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 hover:border-zinc-600"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <div className="relative w-full sm:w-48">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400 z-10 ml-3 pointer-events-none" />
                <Dropdown
                  options={[
                    { label: 'All Airports', value: '' },
                    ...activeAirports.map((icao) => ({
                      label: icao,
                      value: icao,
                    })),
                  ]}
                  value={selectedAirport}
                  onChange={setSelectedAirport}
                  placeholder="Filter by airport..."
                  className="pl-10"
                />
              </div>

              <Dropdown
                options={statusOptions}
                value={selectedStatus}
                onChange={setSelectedStatus}
                placeholder="All Statuses"
                size="md"
              />

              <Dropdown
                options={flightTypeOptions}
                value={selectedFlightType}
                onChange={setSelectedFlightType}
                placeholder="All Types"
                size="md"
              />
            </div>
          </div>

          {/* Flights Table */}
          <div className="bg-zinc-900 border-2 border-zinc-700/50 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1200px]">
                <thead className="bg-zinc-800">
                  <tr>
                    <th className="px-6 py-4 text-left text-zinc-400 font-medium">
                      Time
                    </th>
                    <th className="px-6 py-4 text-left text-zinc-400 font-medium">
                      Callsign
                    </th>
                    <th className="px-6 py-4 text-left text-zinc-400 font-medium">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-zinc-400 font-medium">
                      Departure
                    </th>
                    <th className="px-6 py-4 text-left text-zinc-400 font-medium">
                      Arrival
                    </th>
                    <th className="px-6 py-4 text-left text-zinc-400 font-medium">
                      Aircraft
                    </th>
                    <th className="px-6 py-4 text-left text-zinc-400 font-medium">
                      RFL
                    </th>
                    <th className="px-6 py-4 text-left text-zinc-400 font-medium">
                      CFL
                    </th>
                    <th className="px-6 py-4 text-left text-zinc-400 font-medium">
                      SID
                    </th>
                    <th className="px-6 py-4 text-left text-zinc-400 font-medium">
                      STAR
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedFlights.length === 0 ? (
                    <tr>
                      <td
                        colSpan={10}
                        className="text-center py-12 text-zinc-400"
                      >
                        {searchTerm ||
                        selectedAirport ||
                        selectedStatus ||
                        selectedFlightType
                          ? 'No flights found matching your criteria'
                          : 'No flights currently active'}
                      </td>
                    </tr>
                  ) : (
                    sortedFlights.map((flight) => (
                      <tr
                        key={`${flight.sessionId}-${flight.id}`}
                        className="border-t border-zinc-700/50 hover:bg-zinc-800/50"
                      >
                        <td className="px-6 py-4">
                          <div className="text-zinc-300 text-sm">
                            {flight.created_at
                              ? new Date(flight.created_at).toLocaleTimeString()
                              : 'N/A'}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {renderEditableCell(flight, 'callsign', 'text')}
                        </td>
                        <td className="px-6 py-4">
                          {renderEditableCell(flight, 'status', 'status')}
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-mono text-zinc-300">
                            {flight.departure || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {renderEditableCell(flight, 'arrival', 'airport')}
                        </td>
                        <td className="px-6 py-4">
                          {renderEditableCell(flight, 'aircraft', 'aircraft')}
                        </td>
                        <td className="px-6 py-4">
                          {renderEditableCell(flight, 'cruisingFL', 'altitude')}
                        </td>
                        <td className="px-6 py-4">
                          {renderEditableCell(flight, 'clearedFL', 'altitude')}
                        </td>
                        <td className="px-6 py-4">
                          {renderEditableCell(flight, 'sid', 'sid')}
                        </td>
                        <td className="px-6 py-4">
                          {renderEditableCell(flight, 'star', 'star')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="mb-6 sm:mb-8">
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6">
            Active Airports
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {Object.entries(airportSessions).map(([icao, sessions]) => {
              const totalFlights = sessions.reduce(
                (sum, session) => sum + session.flightCount,
                0
              );
              const totalUsers = sessions.reduce(
                (sum, session) => sum + session.activeUsers,
                0
              );
              const isExpanded = expandedAirports.has(icao);
              const arrivals = overviewData?.arrivalsByAirport[icao] || [];

              return (
                <div
                  key={icao}
                  className="bg-zinc-900 border-2 border-zinc-700/50 rounded-2xl overflow-hidden"
                >
                  {/* Airport Header */}
                  <div className="p-4 sm:p-6 border-b border-zinc-700/50">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-blue-500/20 rounded-lg">
                          <TowerControl className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-white">
                            {icao}
                          </h3>
                          <div className="flex items-center gap-2 text-sm">
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                            <span className="text-green-400">Active</span>
                          </div>
                        </div>
                      </div>
                      {arrivals.length > 0 && (
                        <Button
                          onClick={() => toggleAirportExpansion(icao)}
                          variant="ghost"
                          size="sm"
                          className="p-2"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </Button>
                      )}
                    </div>
                    <div className="space-y-4">
                      <WindDisplay icao={icao} size="small" />
                      {isEventController && selectedStation && (
                        <FrequencyDisplay airportIcao={icao ?? ''} />
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-4 mt-4">
                      <div className="text-center">
                        <div className="text-lg font-bold text-white">
                          {totalUsers}
                        </div>
                        <div className="text-zinc-400 text-xs">Controllers</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-white">
                          {totalFlights}
                        </div>
                        <div className="text-zinc-400 text-xs">Flights</div>
                      </div>
                      {sessions[0]?.activeRunway && (
                        <div className="text-center">
                          <div className="font-mono text-white font-medium">
                            {sessions[0].activeRunway}
                          </div>
                          <div className="text-sm text-zinc-400">Runway</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Arrivals List */}
                  {isExpanded && (
                    <div className="border-t border-zinc-700/50 bg-zinc-800/50">
                      <div className="p-4 sm:p-6 space-y-4">
                        {/* Departures Section */}
                        {sessions.some(
                          (session) => session.flights.length > 0
                        ) && (
                          <div>
                            <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                              <PlaneTakeoff className="w-4 h-4 text-blue-400" />
                              Departures ( )
                            </h4>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {sessions.map((session) =>
                                session.flights.map((flight) => (
                                  <div
                                    key={`${session.sessionId}-${flight.id}`}
                                    className="flex items-center justify-between bg-zinc-900 rounded-lg p-3 border border-zinc-600/30"
                                  >
                                    <div className="flex items-center space-x-3">
                                      <div className="text-white font-mono text-sm">
                                        {flight.callsign || 'N/A'}
                                      </div>
                                      <div className="text-zinc-400 text-xs">
                                        {flight.aircraft || 'N/A'}
                                      </div>
                                      <div className="text-zinc-500 text-xs">
                                        → {flight.arrival || 'N/A'}
                                      </div>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <span
                                        className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusClass(
                                          flight.status || 'PENDING'
                                        )}`}
                                      >
                                        {flight.status || 'PENDING'}
                                      </span>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        )}

                        {/* Arrivals Section */}
                        {arrivals.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                              <PlaneLanding className="w-4 h-4 text-green-400" />
                              Arrivals ({arrivals.length})
                            </h4>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {arrivals.map((flight) => (
                                <div
                                  key={`arrival-${flight.id}`}
                                  className="flex items-center justify-between bg-zinc-900 rounded-lg p-3 border border-zinc-600/30"
                                >
                                  <div className="flex items-center space-x-3">
                                    <div className="text-white font-mono text-sm">
                                      {flight.callsign || 'N/A'}
                                    </div>
                                    <div className="text-zinc-400 text-xs">
                                      {flight.aircraft || 'N/A'}
                                    </div>
                                    <div className="text-zinc-500 text-xs">
                                      {flight.departureAirport} →
                                    </div>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <span
                                      className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusClass(
                                        flight.status || 'ENROUTE'
                                      )}`}
                                    >
                                      {flight.status || 'ENROUTE'}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Show message if no flights */}
                        {sessions.every(
                          (session) => session.flights.length === 0
                        ) &&
                          arrivals.length === 0 && (
                            <div className="text-center text-zinc-400 py-4">
                              No active flights at this airport
                            </div>
                          )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Chart Drawer */}
      <ChartDrawer
        isOpen={isChartDrawerOpen}
        onClose={() => setIsChartDrawerOpen(false)}
        selectedChart={selectedChart}
        setSelectedChart={setSelectedChart}
        chartLoadError={chartLoadError}
        setChartLoadError={setChartLoadError}
        chartZoom={chartZoom}
        chartPan={chartPan}
        isChartDragging={isChartDragging}
        handleChartMouseDown={chartHandlers.handleChartMouseDown}
        handleChartMouseMove={chartHandlers.handleChartMouseMove}
        handleChartMouseUp={chartHandlers.handleChartMouseUp}
        handleTouchStart={chartHandlers.handleTouchStart}
        handleTouchMove={chartHandlers.handleTouchMove}
        handleTouchEnd={chartHandlers.handleTouchEnd}
        handleZoomIn={chartHandlers.handleZoomIn}
        handleZoomOut={chartHandlers.handleZoomOut}
        handleResetZoom={chartHandlers.handleResetZoom}
        getChartsForAirport={getChartsForAirport}
        containerRef={containerRef}
        setImageSize={setImageSize}
        airports={[]}
        settings={user?.settings || null}
        sectorStation={isEventController ? selectedStation : undefined}
      />

      {/* Contact ACARS Sidebar */}
      <ContactAcarsSidebar
        open={isContactSidebarOpen}
        onClose={() => setIsContactSidebarOpen(false)}
        flights={allFlights}
        onSendContact={handleSendContact}
        activeAcarsFlights={activeAcarsFlights}
        airportIcao={selectedStation}
        fallbackFrequency={
          sectorStations.find((s) => s.value === selectedStation)?.frequency
        }
      />

      <ChatSidebar
        sessionId=""
        accessId=""
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        sessionUsers={[]}
        onMentionReceived={handleMentionReceived}
        station={selectedStation}
        position={
          selectedStation ? selectedStation.split('_').slice(1).join('_') : ''
        }
        isPFATC={true}
        unreadSessionCount={0}
        unreadGlobalCount={0}
      />
    </div>
  );
}
