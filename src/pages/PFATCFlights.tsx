import { useState, useEffect, useRef } from 'react';
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
  ExternalLink,
  Check,
  X,
  MessageSquare,
  Map as MapIcon,
  Radio,
} from 'lucide-react';
import { createOverviewSocket } from '../sockets/overviewSocket';
import { createFlightsSocket } from '../sockets/flightsSocket';
import { createSectorControllerSocket } from '../sockets/sectorControllerSocket';
import { updateFlight as updateFlightAPI } from '../utils/fetch/flights';
import { useAuth } from '../hooks/auth/useAuth';
import type { OverviewData, OverviewSession } from '../types/overview';
import type { Flight } from '../types/flight';
import Navbar from '../components/Navbar';
import WindDisplay from '../components/tools/WindDisplay';
import FrequencyDisplay from '../components/tools/FrequencyDisplay';
import ChartDrawer from '../components/tools/ChartDrawer';
import ContactAcarsSidebar from '../components/tools/ContactAcarsSidebar';
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
import { getChartsForAirport } from '../utils/acars';
import { createChartHandlers } from '../utils/charts';

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
  const [activeAcarsFlights, setActiveAcarsFlights] = useState<Set<string | number>>(new Set());
  const [eventControllerViewEnabled, setEventControllerViewEnabled] = useState(false);

  const isEventController =
    user?.rolePermissions?.['event_controller'] ||
    (user as { roles?: { name: string }[] })?.roles?.some(
      (role) => role.name === 'Event Controller'
    ) ||
    user?.isAdmin;

  const chartHandlers = createChartHandlers(
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
  );

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

    // Filter out sector sessions - they don't have flights
    const realSessions = overviewData.activeSessions.filter(
      (s) => !s.sessionId.startsWith('sector-')
    );

    const activeSessions = new Set(
      realSessions.map((s) => s.sessionId)
    );

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
            console.log(`Creating socket for session: ${session.sessionId}`);
            const socket = createFlightsSocket(
              session.sessionId,
              '',
              user?.userId || '',
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
                console.log(`Socket connected for session: ${session.sessionId}`);
              },
              () => {
                console.log(`Socket disconnected for session: ${session.sessionId}`);
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
      // Cleanup on unmount
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

  // Sector controller socket connection
  const sectorSocketRef = useRef<ReturnType<typeof createSectorControllerSocket> | null>(null);

  useEffect(() => {
    if (!isEventController || !eventControllerViewEnabled || !user?.userId) {
      // Clean up socket if view is disabled
      if (sectorSocketRef.current) {
        sectorSocketRef.current.socket.disconnect();
        sectorSocketRef.current = null;
      }
      return;
    }

    // Create socket if it doesn't exist
    if (!sectorSocketRef.current) {
      sectorSocketRef.current = createSectorControllerSocket({
        userId: user.userId,
        username: user.username || 'Unknown',
        avatar: user.avatar || null
      });
    }

    return () => {
      // Clean up on unmount
      if (sectorSocketRef.current) {
        sectorSocketRef.current.socket.disconnect();
        sectorSocketRef.current = null;
      }
    };
  }, [isEventController, eventControllerViewEnabled, user?.userId, user?.username, user?.avatar]);

  // Handle station selection changes
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
      position: finalPosition
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

  const sortedFlights = [...filteredFlights].sort((a, b) => {
    switch (sortBy) {
      case 'callsign':
        return (a.callsign || '').localeCompare(b.callsign || '');
      case 'airport':
        return (a.departure || '').localeCompare(b.departure || '');
      case 'time':
      default:
        return (
          new Date(b.created_at || 0).getTime() -
          new Date(a.created_at || 0).getTime()
        );
    }
  });

  const airportSessions =
    overviewData?.activeSessions
      .filter((session) => !session.sessionId.startsWith('sector-')) // Filter out sector controllers
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

  const startEdit = (
    flightId: string | number,
    field: string,
    currentValue: string
  ) => {
    if (!isEventController || !eventControllerViewEnabled) return;

    setEditingState({
      flightId,
      field,
      value: currentValue,
      originalValue: currentValue,
    });
  };

  const cancelEdit = () => {
    setEditingState(null);
  };

  const saveEdit = async () => {
    if (!editingState || !isEventController || !eventControllerViewEnabled) return;

    const { flightId, field, value, originalValue } = editingState;

    if (value === originalValue) {
      setEditingState(null);
      return;
    }

    const flight = allFlights.find((f) => f.id === flightId);
    if (!flight) {
      console.error('Flight not found for editing');
      setEditingState(null);
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

      await updateFlightAPI(flight.sessionId, flightId, updates);

      // Optimistically update the local state
      setOverviewData((prev) => {
        if (!prev) return prev;

        const updatedSessions = prev.activeSessions.map((session) => {
          if (session.sessionId === flight.sessionId) {
            return {
              ...session,
              flights: session.flights.map((f) =>
                f.id === flightId ? { ...f, ...updates } : f
              ),
            };
          }
          return session;
        });

        return {
          ...prev,
          activeSessions: updatedSessions,
        };
      });

      setEditingState(null);
    } catch (error) {
      console.error('Failed to update flight:', error);
      alert('Failed to update flight. Please try again.');
    } finally {
      setUpdatingFlights((prev) => {
        const next = new Set(prev);
        next.delete(String(flightId));
        return next;
      });
    }
  };

  const handleEditInputChange = (value: string) => {
    if (!editingState) return;
    setEditingState({ ...editingState, value });
  };

  const renderEditableCell = (
    flight: FlightWithDetails,
    field: string,
    currentValue: string,
    cellType: 'text' | 'status' | 'airport' | 'aircraft' | 'altitude' | 'sid' | 'star' = 'text'
  ) => {
    const isEditing =
      editingState?.flightId === flight.id && editingState?.field === field;
    const isUpdating = updatingFlights.has(String(flight.id));

    if (!isEventController || !eventControllerViewEnabled) {
      return (
        <span className="font-mono text-zinc-300">{currentValue || 'N/A'}</span>
      );
    }

    if (isEditing) {
      return (
        <div className="flex items-center space-x-2">
          <div className="flex-1">
            {cellType === 'status' ? (
              <StatusDropdown
                value={editingState.value}
                onChange={handleEditInputChange}
                size="xs"
                placeholder="-"
                controllerType="event"
              />
            ) : cellType === 'airport' ? (
              <AirportDropdown
                value={editingState.value}
                onChange={handleEditInputChange}
                size="xs"
                showFullName={false}
              />
            ) : cellType === 'aircraft' ? (
              <AircraftDropdown
                value={editingState.value}
                onChange={handleEditInputChange}
                size="xs"
                showFullName={false}
              />
            ) : cellType === 'altitude' ? (
              <AltitudeDropdown
                value={editingState.value}
                onChange={handleEditInputChange}
                size="xs"
                placeholder="-"
              />
            ) : cellType === 'sid' ? (
              <SidDropdown
                airportIcao={flight.departure || ''}
                value={editingState.value}
                onChange={handleEditInputChange}
                size="xs"
                placeholder="-"
              />
            ) : cellType === 'star' ? (
              <StarDropdown
                airportIcao={flight.arrival || ''}
                value={editingState.value}
                onChange={handleEditInputChange}
                size="xs"
                placeholder="-"
              />
            ) : (
              <TextInput
                value={editingState.value}
                onChange={handleEditInputChange}
                className="bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-white text-xs w-20"
                maxLength={
                  field === 'callsign' ? 16 : field === 'squawk' ? 4 : 50
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    saveEdit();
                  } else if (e.key === 'Escape') {
                    cancelEdit();
                  }
                }}
                autoFocus
              />
            )}
          </div>
          <div className="flex space-x-1">
            <button
              onClick={saveEdit}
              disabled={isUpdating}
              className="text-green-400 hover:text-green-300 disabled:opacity-50"
              title="Save"
            >
              <Check className="w-3 h-3" />
            </button>
            <button
              onClick={cancelEdit}
              disabled={isUpdating}
              className="text-red-400 hover:text-red-300 disabled:opacity-50"
              title="Cancel"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      );
    }

    return (
      <button
        onClick={() => startEdit(flight.id, field, currentValue)}
        className="font-mono text-zinc-300 hover:text-blue-400 hover:bg-zinc-800/50 px-1 py-0.5 rounded transition-colors text-left w-full"
        title={`Click to edit ${field}`}
        disabled={isUpdating}
      >
        {isUpdating ? (
          <div className="flex items-center space-x-1">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>{currentValue || 'N/A'}</span>
          </div>
        ) : (
          currentValue || 'N/A'
        )}
      </button>
    );
  };

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
                  <span>Live view of all PFATC flights and active airports</span>
                  {isEventController && (
                    <button
                      onClick={() => {
                        setEventControllerViewEnabled(!eventControllerViewEnabled);
                        setSelectedStation('');
                      }}
                      className={`px-3 py-1 text-xs rounded-full border transition-all ${
                        eventControllerViewEnabled
                          ? 'bg-purple-500/20 text-purple-300 border-purple-500/30 hover:bg-purple-500/30'
                          : 'bg-zinc-700/20 text-zinc-400 border-zinc-600/30 hover:bg-zinc-700/30'
                      }`}
                    >
                      {eventControllerViewEnabled ? '✓ ' : ''}Event Controller View
                    </button>
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
                  <div className="text-xl sm:text-2xl font-bold text-white">
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
                  <div className="text-xl sm:text-2xl font-bold text-white">
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
                  <div className="text-sm font-medium text-white">
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
        {/* Event Controller Panel */}
        {isEventController && eventControllerViewEnabled && (
          <div className="mb-6 sm:mb-8">
            <div className="flex flex-wrap items-center gap-3 bg-zinc-900 border-2 border-zinc-700/50 rounded-2xl p-4">
              {/* Station Selector */}
              <Dropdown
                options={sectorStations.map(s => ({ label: s.label, value: s.value }))}
                value={selectedStation}
                onChange={setSelectedStation}
                placeholder="Select Station"
                size="md"
                className="min-w-[200px]"
              />

              {/* Frequency Display */}
              {selectedStation && (
                <FrequencyDisplay
                  airportIcao={selectedStation}
                  showExpandedTable={false}
                />
              )}

              {/* Spacer */}
              <div className="flex-1" />

              {/* Action Buttons - matching Toolbar style */}
              <Button
                className="flex items-center gap-2 px-4 py-2"
                aria-label="Contact"
                size="sm"
                onClick={() => setIsContactSidebarOpen(true)}
                disabled={!selectedStation}
              >
                <Radio className="w-5 h-5" />
                <span className="hidden sm:inline font-medium">Contact</span>
              </Button>

              <Button
                className="flex items-center gap-2 px-4 py-2"
                aria-label="Chat"
                size="sm"
                onClick={() => alert('Global Chat - Coming soon!')}
                disabled={!selectedStation}
              >
                <MessageSquare className="w-5 h-5" />
                <span className="hidden sm:inline font-medium">Chat</span>
              </Button>

              <Button
                className="flex items-center gap-2 px-4 py-2"
                aria-label="Charts"
                size="sm"
                onClick={() => setIsChartDrawerOpen(true)}
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
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-zinc-400 group-focus-within:text-purple-400 transition-colors" />
              <input
                type="text"
                placeholder="Search by callsign, aircraft, departure, or arrival..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-zinc-900/50 border-2 border-zinc-700 rounded-full text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all duration-200 hover:border-zinc-600"
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

              <Dropdown
                options={sortOptions}
                value={sortBy}
                onChange={(value) =>
                  setSortBy(value as 'time' | 'callsign' | 'airport')
                }
                placeholder="Sort by..."
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
                      Route
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
                          {renderEditableCell(
                            flight,
                            'callsign',
                            flight.callsign || '',
                            'text'
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {isEventController && eventControllerViewEnabled ? (
                            renderEditableCell(
                              flight,
                              'status',
                              flight.status || '',
                              'status'
                            )
                          ) : (
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusClass(
                                flight.status || ''
                              )}`}
                            >
                              {flight.status || 'UNKNOWN'}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-2">
                            <div className="min-w-[80px]">
                              <span className="font-mono text-zinc-300">
                                {flight.departure || 'N/A'}
                              </span>
                            </div>
                            <span className="text-zinc-500">→</span>
                            <div className="min-w-[80px]">
                              {renderEditableCell(
                                flight,
                                'arrival',
                                flight.arrival || '',
                                'airport'
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {renderEditableCell(
                            flight,
                            'aircraft',
                            flight.aircraft || '',
                            'aircraft'
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {renderEditableCell(
                            flight,
                            'cruisingFL',
                            flight.cruisingFL || '',
                            'altitude'
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {renderEditableCell(
                            flight,
                            'clearedFL',
                            flight.clearedFL || '',
                            'altitude'
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {renderEditableCell(
                            flight,
                            'sid',
                            flight.sid || '',
                            'sid'
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {renderEditableCell(
                            flight,
                            'star',
                            flight.star || '',
                            'star'
                          )}
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
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 sm:mb-6">
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
                    </div>
                  <div className="space-y-4">
                    <WindDisplay icao={icao} size="small" />
                  {eventControllerViewEnabled && (
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

                  {/* Arrivals List (Collapsible) */}
                  {isExpanded && arrivals.length > 0 && (
                    <div className="border-t border-zinc-700/50">
                      <div className="p-4 bg-zinc-800/30">
                        <h4 className="text-sm font-medium text-zinc-300 mb-3">
                          Arrivals ({arrivals.length})
                        </h4>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {arrivals.map((flight) => (
                            <div
                              key={`${flight.sessionId}-${flight.id}`}
                              className="flex items-center justify-between bg-zinc-700/50 rounded-lg p-2 text-sm"
                            >
                              <div className="flex items-center space-x-3 flex-1 min-w-0">
                                <span className="font-mono text-blue-400 font-medium">
                                  {flight.callsign || 'N/A'}
                                </span>
                                <span className="text-zinc-500">from</span>
                                <span className="font-mono text-green-400">
                                  {flight.departureAirport}
                                </span>
                                <span className="text-zinc-400">
                                  {flight.aircraft || 'N/A'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="p-4">
                    <Button
                      onClick={() => {
                        const session = sessions[0];
                        if (session?.sessionId) {
                          window.open(`/submit/${session.sessionId}`, '_blank');
                        }
                      }}
                      variant="outline"
                      size="sm"
                      className="w-full flex items-center justify-center space-x-2"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Submit Flight</span>
                    </Button>
                  </div>
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
        handleZoomIn={chartHandlers.handleZoomIn}
        handleZoomOut={chartHandlers.handleZoomOut}
        handleResetZoom={chartHandlers.handleResetZoom}
        getChartsForAirport={getChartsForAirport}
        containerRef={containerRef}
        setImageSize={setImageSize}
        airports={[]}
        settings={user?.settings || null}
      />

      {/* Contact ACARS Sidebar */}
      <ContactAcarsSidebar
        open={isContactSidebarOpen}
        onClose={() => setIsContactSidebarOpen(false)}
        flights={allFlights}
        onSendContact={handleSendContact}
        activeAcarsFlights={activeAcarsFlights}
        airportIcao={selectedStation}
        fallbackFrequency={sectorStations.find(s => s.value === selectedStation)?.frequency}
      />
    </div>
  );
}
