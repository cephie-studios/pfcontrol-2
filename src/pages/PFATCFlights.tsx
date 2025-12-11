import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  MapPin,
  Plane,
  Search,
  Filter,
  TowerControl,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Map as MapIcon,
  Radio,
  PlaneLanding,
  PlaneTakeoff,
  Menu,
  Eye,
  EyeOff,
  FileText,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { createOverviewSocket } from '../sockets/overviewSocket';
import { useAuth } from '../hooks/auth/useAuth';
import { useData } from '../hooks/data/useData';
import { useSettings } from '../hooks/settings/useSettings';
import { getChartsForAirport } from '../utils/acars';
import { parseCallsign } from '../utils/callsignParser';
import { createChartHandlers } from '../utils/charts';
import { createSectorControllerSocket } from '../sockets/sectorControllerSocket';
import { fetchBackgrounds } from '../utils/fetch/data';
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
import FlightDetailsModal from '../components/tools/FlightDetailModal';

const API_BASE_URL = import.meta.env.VITE_SERVER_URL;

interface AvailableImage {
  filename: string;
  path: string;
  extension: string;
}

interface FlightWithDetails extends Flight {
  sessionId: string;
  departureAirport: string;
}

export default function PFATCFlights() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const { airlines, loading: airlinesLoading } = useData();
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAirport, setSelectedAirport] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedFlightType, setSelectedFlightType] = useState<string>('');
  const [expandedAirports, setExpandedAirports] = useState<Set<string>>(
    new Set()
  );
  const [availableImages, setAvailableImages] = useState<AvailableImage[]>([]);
  const [customLoaded, setCustomLoaded] = useState(false);
  const [debounceTimers, setDebounceTimers] = useState<
    Map<string, NodeJS.Timeout>
  >(new Map());
  const [pendingUpdates, setPendingUpdates] = useState<
    Map<string, Partial<Flight>>
  >(new Map());
  const [updatingFlights, setUpdatingFlights] = useState<Set<string>>(
    new Set()
  );
  const debounceTimersRef = useRef(debounceTimers);
  const updatingFlightsRef = useRef(updatingFlights);

  const [openActionMenuId, setOpenActionMenuId] = useState<
    string | number | null
  >(null);
  const [selectedFlightForModal, setSelectedFlightForModal] =
    useState<Flight | null>(null);
  const [isFlightDetailModalOpen, setIsFlightDetailModalOpen] = useState(false);
  const actionButtonRefs = useRef<
    Record<string | number, HTMLButtonElement | null>
  >({});

  const handleOpenFlightDetails = (flight: Flight) => {
    setSelectedFlightForModal(flight);
    setIsFlightDetailModalOpen(true);
    setOpenActionMenuId(null);
  };

  const handleCloseFlightDetails = () => {
    setIsFlightDetailModalOpen(false);
    setSelectedFlightForModal(null);
  };

  useEffect(() => {
    debounceTimersRef.current = debounceTimers;
  }, [debounceTimers]);

  useEffect(() => {
    updatingFlightsRef.current = updatingFlights;
  }, [updatingFlights]);

  useEffect(() => {
    const loadImages = async () => {
      try {
        const data = await fetchBackgrounds();
        setAvailableImages(data);
      } catch (error) {
        console.error('Error loading available images:', error);
      }
    };
    loadImages();
  }, []);

  const backgroundImage = useMemo(() => {
    const selectedImage = settings?.backgroundImage?.selectedImage;
    let bgImage = 'url("/assets/images/hero.webp")';

    const getImageUrl = (filename: string | null): string | null => {
      if (!filename || filename === 'random' || filename === 'favorites') {
        return filename;
      }
      if (filename.startsWith('https://api.cephie.app/')) {
        return filename;
      }
      return `${API_BASE_URL}/assets/app/backgrounds/${filename}`;
    };

    if (selectedImage === 'random') {
      if (availableImages.length > 0) {
        const randomIndex = Math.floor(Math.random() * availableImages.length);
        bgImage = `url(${API_BASE_URL}${availableImages[randomIndex].path})`;
      }
    } else if (selectedImage === 'favorites') {
      const favorites = settings?.backgroundImage?.favorites || [];
      if (favorites.length > 0) {
        const randomFav =
          favorites[Math.floor(Math.random() * favorites.length)];
        const favImageUrl = getImageUrl(randomFav);
        if (
          favImageUrl &&
          favImageUrl !== 'random' &&
          favImageUrl !== 'favorites'
        ) {
          bgImage = `url(${favImageUrl})`;
        }
      }
    } else if (selectedImage) {
      const imageUrl = getImageUrl(selectedImage);
      if (imageUrl && imageUrl !== 'random' && imageUrl !== 'favorites') {
        bgImage = `url(${imageUrl})`;
      }
    }

    return bgImage;
  }, [
    settings?.backgroundImage?.selectedImage,
    settings?.backgroundImage?.favorites,
    availableImages,
  ]);

  useEffect(() => {
    if (backgroundImage !== 'url("/assets/images/hero.webp")') {
      setCustomLoaded(true);
    }
  }, [backgroundImage]);

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
  const [activeAcarsFlightsData, setActiveAcarsFlightsData] = useState<
    Flight[]
  >([]);
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

  const overviewSocketRef = useRef<ReturnType<
    typeof createOverviewSocket
  > | null>(null);

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
    [chartZoom, chartPan, isChartDragging, chartDragStart, imageSize]
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

        setOverviewData((prev) => {
          if (!prev) {
            return {
              ...data,
              arrivalsByAirport: transformedArrivalsByAirport,
            };
          }

          const flightsWithPendingChanges = new Set<string>();
          debounceTimersRef.current.forEach((_, timerKey) => {
            const flightId = timerKey.split('-')[0];
            flightsWithPendingChanges.add(flightId);
          });

          const preservedSessions = data.activeSessions.map((session) => ({
            ...session,
            flights: session.flights.map((flight) => {
              const flightId = String(flight.id);

              if (
                updatingFlightsRef.current.has(flightId) ||
                flightsWithPendingChanges.has(flightId)
              ) {
                const existingFlight = prev.activeSessions
                  .find((s) => s.sessionId === session.sessionId)
                  ?.flights.find((f) => f.id === flight.id);
                return existingFlight || flight;
              }

              const existingFlight = prev.activeSessions
                .find((s) => s.sessionId === session.sessionId)
                ?.flights.find((f) => f.id === flight.id);

              if (existingFlight?.updated_at && flight.updated_at) {
                const existingTime = new Date(
                  existingFlight.updated_at
                ).getTime();
                const newTime = new Date(flight.updated_at).getTime();
                if (existingTime > newTime) {
                  return existingFlight;
                }
              }

              return flight;
            }),
          }));

          const preservedArrivals = { ...transformedArrivalsByAirport };
          Object.keys(preservedArrivals).forEach((icao) => {
            preservedArrivals[icao] = preservedArrivals[icao].map((flight) => {
              const flightId = String(flight.id);
              if (
                updatingFlightsRef.current.has(flightId) ||
                flightsWithPendingChanges.has(flightId)
              ) {
                const existingFlight = prev.arrivalsByAirport[icao]?.find(
                  (f) => f.id === flight.id
                );
                return existingFlight || flight;
              }

              const existingFlight = prev.arrivalsByAirport[icao]?.find(
                (f) => f.id === flight.id
              );

              if (existingFlight?.updated_at && flight.updated_at) {
                const existingTime = new Date(
                  existingFlight.updated_at
                ).getTime();
                const newTime = new Date(flight.updated_at).getTime();
                if (existingTime > newTime) {
                  return existingFlight;
                }
              }

              return flight;
            });
          });

          return {
            ...data,
            activeSessions: preservedSessions,
            arrivalsByAirport: preservedArrivals,
          };
        });
        setLoading(false);
        setError(null);
      },
      (error) => {
        console.error('Overview socket error:', error);
        setError(error.error || 'Failed to connect to overview data');
        setLoading(false);
      },
      isEventController,
      user?.userId,
      user?.username,
      ({ sessionId, flight }) => {
        setOverviewData((prev) => {
          if (!prev) return prev;

          const updatedSessions = prev.activeSessions.map((s) => {
            if (s.sessionId === sessionId) {
              return {
                ...s,
                flights: s.flights.map((f) =>
                  f.id === flight.id ? flight : f
                ),
              };
            }
            return s;
          });

          const updatedArrivalsByAirport = { ...prev.arrivalsByAirport };
          if (flight.arrival) {
            const arrivalIcao = flight.arrival.toUpperCase();
            if (updatedArrivalsByAirport[arrivalIcao]) {
              updatedArrivalsByAirport[arrivalIcao] = updatedArrivalsByAirport[
                arrivalIcao
              ].map((f) =>
                f.id === flight.id
                  ? {
                      ...flight,
                      sessionId,
                      departureAirport: flight.departure || '',
                    }
                  : f
              );
            }
          }

          return {
            ...prev,
            activeSessions: updatedSessions,
            arrivalsByAirport: updatedArrivalsByAirport,
          };
        });

        setPendingUpdates((prev) => {
          const next = new Map(prev);
          for (const [key] of prev.entries()) {
            if (key.startsWith(`${flight.id}-`)) {
              next.delete(key);
            }
          }
          return next;
        });
      },
      ({ flightId }) => {
        setUpdatingFlights((prev) => {
          const next = new Set(prev);
          next.delete(String(flightId));
          return next;
        });
      },
      (error) => {
        console.error('Flight operation error:', error);
        if (error.flightId) {
          setPendingUpdates((prev) => {
            const next = new Map(prev);
            for (const [key] of prev.entries()) {
              if (key.startsWith(`${error.flightId}-`)) {
                next.delete(key);
              }
            }
            return next;
          });

          setUpdatingFlights((prev) => {
            const next = new Set(prev);
            next.delete(String(error.flightId));
            return next;
          });

          if (overviewSocketRef.current) {
            // The socket will automatically send new data
          }
        }
      }
    );

    overviewSocketRef.current = socket;

    return () => {
      socket.disconnect();
      overviewSocketRef.current = null;
    };
  }, [isEventController, user?.userId, user?.username]);

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
          setActiveAcarsFlightsData(flights);
        }
      } catch {
        // ignore
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

  const activeAirports = useMemo(
    () =>
      overviewData?.activeSessions.map((session) => session.airportIcao) || [],
    [overviewData?.activeSessions]
  );

  const allFlights: FlightWithDetails[] = useMemo(() => {
    const flights: FlightWithDetails[] = [];
    overviewData?.activeSessions.forEach((session) => {
      session.flights.forEach((flight) => {
        flights.push({
          ...flight,
          sessionId: session.sessionId,
          departureAirport: session.airportIcao,
        });
      });
    });
    return flights;
  }, [overviewData?.activeSessions]);

  const allPossibleFlights = useMemo(() => {
    const flightsMap = new Map<string | number, FlightWithDetails>();
    allFlights.forEach((f) => flightsMap.set(f.id, f));
    activeAcarsFlightsData.forEach((f) => {
      if (!flightsMap.has(f.id)) {
        flightsMap.set(f.id, {
          ...f,
          sessionId: f.session_id,
          departureAirport: f.departure || '',
        });
      }
    });
    return Array.from(flightsMap.values());
  }, [allFlights, activeAcarsFlightsData]);

  const handleSendContact = useCallback(
    async (
      flightId: string | number,
      message: string,
      station: string,
      position: string
    ) => {
      const flight = allPossibleFlights.find((f) => f.id === flightId);
      if (!flight) {
        throw new Error('Flight not found');
      }

      if (!overviewSocketRef.current) {
        throw new Error('Overview socket not available');
      }
      //...
      //...
      overviewSocketRef.current.sendContact(
        flight.sessionId,
        flightId,
        message,
        station,
        position
      );
    },
    [allPossibleFlights]
  );

  const [showHidden, setShowHidden] = useState(false);

  const filteredFlights = allFlights.filter((flight) => {
    if (!showHidden && flight.hidden) {
      return false;
    }

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
      case 'TAXI_ORIG':
        return 'bg-pink-500/20 text-pink-400 border border-pink-500/30';
      case 'TAXI_ARRV':
        return 'bg-pink-500/20 text-pink-400 border border-pink-500/30';
      case 'DEPARTED':
        return 'bg-purple-500/20 text-purple-400 border border-purple-500/30';
      case 'STUP':
        return 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30';
      case 'PUSH':
        return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
      case 'RWY':
        return 'bg-red-500/20 text-red-400 border border-red-500/30';
      case 'RWY_ORIG':
        return 'bg-red-500/20 text-red-400 border border-red-500/30';
      case 'RWY_ARRV':
        return 'bg-orange-500/20 text-orange-400 border border-orange-500/30';
      case 'DEPA':
        return 'bg-green-500/20 text-green-400 border border-green-500/30';
      case 'ENROUTE':
        return 'bg-purple-500/20 text-purple-400 border border-purple-500/30';
      case 'APP':
        return 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30';
      case 'GATE':
        return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
      default:
        return 'bg-zinc-500/20 text-zinc-400 border border-zinc-500/30';
    }
  };

  const getFlightTypeColor = (flightType: string) => {
    switch (flightType) {
      case 'IFR':
        return 'text-blue-400';
      case 'VFR':
        return 'text-green-400';
      default:
        return 'text-zinc-400';
    }
  };

  const getStatusBadge = (status: string) => {
    const statusClass = getStatusClass(status);
    const displayStatus =
      status === 'TAXI_ORIG'
        ? 'TAXI'
        : status === 'TAXI_ARRV'
          ? 'TAXI'
          : status === 'RWY_ORIG'
            ? 'RWY'
            : status === 'RWY_ARRV'
              ? 'RWY'
              : status;
    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-semibold ${statusClass}`}
      >
        {displayStatus}
      </span>
    );
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

      if (!overviewSocketRef.current) {
        console.error('Overview socket not available');
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

        overviewSocketRef.current.updateFlight(
          flight.sessionId,
          flightId,
          updates
        );
      } catch (error) {
        console.error('Failed to update flight:', error);
        setUpdatingFlights((prev) => {
          const next = new Set(prev);
          next.delete(String(flightId));
          return next;
        });
      }
    },
    [allFlights]
  );

  const handleToggleHidden = (flight: Flight) => {
    handleFieldChange(
      flight.id,
      'hidden',
      String(!flight.hidden),
      String(flight.hidden || false)
    );
    setOpenActionMenuId(null);
  };

  const handleFieldChange = useCallback(
    (
      flightId: string | number,
      field: string,
      value: string,
      originalValue: string
    ) => {
      if (!isEventController) {
        return;
      }

      let processedValue: string | boolean = value;
      if (field === 'clearance' || field === 'hidden') {
        processedValue = value === 'true';
      }

      setOverviewData((prev) => {
        if (!prev) return prev;

        const updatedSessions = prev.activeSessions.map((s) => ({
          ...s,
          flights: s.flights.map((f) =>
            f.id === flightId ? { ...f, [field]: processedValue } : f
          ),
        }));

        const updatedArrivalsByAirport = { ...prev.arrivalsByAirport };
        Object.keys(updatedArrivalsByAirport).forEach((icao) => {
          updatedArrivalsByAirport[icao] = updatedArrivalsByAirport[icao].map(
            (f) => (f.id === flightId ? { ...f, [field]: processedValue } : f)
          );
        });

        return {
          ...prev,
          activeSessions: updatedSessions,
          arrivalsByAirport: updatedArrivalsByAirport,
        };
      });

      const timerKey = `${flightId}-${field}`;
      const existingTimer = debounceTimers.get(timerKey);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const newTimer = setTimeout(() => {
        handleAutoSave(flightId, field, value, originalValue);
        setDebounceTimers((prev) => {
          const next = new Map(prev);
          next.delete(timerKey);
          return next;
        });
      }, 200);

      setDebounceTimers((prev) => {
        const next = new Map(prev);
        next.set(timerKey, newTimer);
        return next;
      });
    },
    [debounceTimers, handleAutoSave, isEventController, setOverviewData]
  );

  const getCurrentValue = useCallback(
    (flight: FlightWithDetails, field: string) => {
      return String(flight[field as keyof FlightWithDetails] || '');
    },
    []
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
    const getMaxLength = (fieldName: string) => {
      switch (fieldName) {
        case 'callsign':
          return 16;
        case 'remark':
          return 500;
        case 'squawk':
          return 4;
        default:
          return 50;
      }
    };

    const isUpdating = updatingFlights.has(String(flight.id));
    const currentValue = getCurrentValue(flight, field);
    const originalValue = String(
      flight[field as keyof FlightWithDetails] || ''
    );
    const isDisabled = !isEventController || !selectedStation;

    if (!isEventController) {
      return (
        <span className="font-mono text-zinc-300">{currentValue || 'N/A'}</span>
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

    if (cellType === 'text' && field === 'callsign') {
      return (
        <div
          title={
            !airlinesLoading
              ? parseCallsign(flight.callsign, airlines)
              : flight.callsign || ''
          }
        >
          <TextInput
            value={currentValue}
            onChange={(value) =>
              handleFieldChange(flight.id, field, value, originalValue)
            }
            className={`bg-zinc-900 border border-zinc-900 rounded px-2 py-1 text-white text-xs w-full ${
              isDisabled ? 'opacity-50 cursor-not-allowed' : ''
            } ${isUpdating ? 'border-blue-500' : ''}`}
            maxLength={getMaxLength(field)}
            placeholder={currentValue ? '' : 'N/A'}
            disabled={isDisabled}
          />
        </div>
      );
    }

    return (
      <TextInput
        value={currentValue}
        onChange={(value) =>
          handleFieldChange(flight.id, field, value, originalValue)
        }
        className={`bg-zinc-900 border border-zinc-900 rounded px-2 py-1 text-white text-xs w-full ${
          isDisabled ? 'opacity-50 cursor-not-allowed' : ''
        } ${isUpdating ? 'border-blue-500' : ''}`}
        maxLength={getMaxLength(field)}
        placeholder={currentValue ? '' : 'N/A'}
        disabled={isDisabled}
      />
    );
  };

  useEffect(() => {
    return () => {
      debounceTimers.forEach((timer) => clearTimeout(timer));
    };
  }, [debounceTimers]);

  const sortedFlights = [...filteredFlights].sort((a, b) => {
    const getTimestamp = (flight: FlightWithDetails) => {
      if (flight.timestamp) return new Date(flight.timestamp).getTime();
      if (flight.created_at) return new Date(flight.created_at).getTime();
      if (flight.updated_at) return new Date(flight.updated_at).getTime();
      return 0;
    };

    const timestampA = getTimestamp(a);
    const timestampB = getTimestamp(b);

    if (timestampA !== timestampB) {
      return timestampB - timestampA;
    }

    const callsignA = (a.callsign || '').toLowerCase();
    const callsignB = (b.callsign || '').toLowerCase();
    return callsignA.localeCompare(callsignB);
  });

  const flightForModal = useMemo(() => {
    if (!selectedFlightForModal) return null;
    return (
      allFlights.find((f) => f.id === selectedFlightForModal.id) ||
      selectedFlightForModal
    );
  }, [allFlights, selectedFlightForModal]);

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
    <div className="min-h-screen bg-gray-950 text-white relative">
      <Navbar />

      {/* Hero Banner */}
      <div className="relative w-full h-80 md:h-96 overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="/assets/images/hero.webp"
            alt="Banner"
            className="object-cover w-full h-full scale-110"
          />
          <div
            className="absolute inset-0"
            style={{
              backgroundImage,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              opacity: customLoaded ? 1 : 0,
              transition: 'opacity 0.5s ease-in-out',
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-gray-950/40 via-gray-950/70 to-gray-950"></div>
        </div>

        {/* Hero Content */}
        <div className="relative h-full flex flex-col items-center justify-center px-6 md:px-10">
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white tracking-tight text-center">
            PFATC OVERVIEW
          </h1>

          <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
            <div className="flex items-center gap-2 px-6 py-2 bg-blue-600/20 backdrop-blur-md border border-blue-500/30 rounded-full shadow-lg">
              <TowerControl className="h-5 w-5 text-blue-400" />
              <span className="text-blue-400 text-sm font-semibold tracking-wider">
                {overviewData?.totalActiveSessions || 0} ACTIVE SESSION
                {(overviewData?.totalActiveSessions || 0) === 1 ? '' : 'S'}
              </span>
            </div>
            <div className="flex items-center gap-2 px-6 py-2 bg-green-600/20 backdrop-blur-md border border-green-500/30 rounded-full shadow-lg">
              <Plane className="h-5 w-5 text-green-400" />
              <span className="text-green-400 text-sm font-semibold tracking-wider">
                {overviewData?.totalFlights || 0} FLIGHT
                {(overviewData?.totalFlights || 0) === 1 ? '' : 'S'}
              </span>
            </div>
            {isEventController && (
              <div className="px-6 py-1.5 bg-purple-600/20 backdrop-blur-md border border-purple-500/30 rounded-full shadow-lg">
                <span className="text-purple-400 text-sm font-semibold tracking-wider">
                  EVENT CONTROLLER
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto max-w-[85%] px-4 pb-8 -mt-24 md:-mt-8 relative z-10">
        <div className="overflow-hidden">
          <div className="p-6 space-y-6">
            {isEventController && (
              <div className="mb-6 sm:mb-8">
                <div className="flex flex-wrap items-center gap-3 bg-zinc-800/50 border border-zinc-700/50 rounded-full p-4">
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
                    <div className="z-100">
                      <FrequencyDisplay
                        airportIcao={selectedStation}
                        showExpandedTable={false}
                      />
                    </div>
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
                    <span className="hidden sm:inline font-medium">
                      Contact
                    </span>
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
                    <MessageCircle className="w-5 h-5" />
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

              {allFlights.some((f) => f.hidden) && (
                <div className="mb-4">
                  <Button
                    onClick={() => setShowHidden((s) => !s)}
                    variant="outline"
                    size="sm"
                  >
                    {showHidden ? 'Hide Hidden Flights' : 'Show Hidden Flights'}
                  </Button>
                </div>
              )}

              {/* Flights Table */}
              <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1400px]">
                    <thead className="bg-zinc-800">
                      <tr>
                        <th className="px-3 pl-6 py-4 text-left text-zinc-400 font-medium">
                          Time
                        </th>
                        <th className="px-3 py-4 text-left text-zinc-400 font-medium">
                          Callsign
                        </th>
                        <th className="px-3 py-4 text-left text-zinc-400 font-medium">
                          Status
                        </th>
                        <th className="px-3 py-4 text-left text-zinc-400 font-medium">
                          Departure
                        </th>
                        <th className="px-3 py-4 text-left text-zinc-400 font-medium">
                          Arrival
                        </th>
                        <th className="px-3 py-4 text-left text-zinc-400 font-medium">
                          Aircraft
                        </th>
                        <th className="px-3 py-4 text-left text-zinc-400 font-medium">
                          RFL
                        </th>
                        <th className="px-3 py-4 text-left text-zinc-400 font-medium">
                          CFL
                        </th>
                        <th className="px-3 py-4 text-left text-zinc-400 font-medium">
                          SID
                        </th>
                        <th className="px-3 py-4 text-left text-zinc-400 font-medium">
                          STAR
                        </th>
                        <th className="px-3 pr-6 py-4 text-left text-zinc-400 font-medium">
                          Remark
                        </th>
                        {isEventController && (
                          <th className="px-3 pr-6 py-4 text-center text-zinc-400 font-medium">
                            More
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedFlights.length === 0 ? (
                        <tr>
                          <td
                            colSpan={12}
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
                            <td className="px-3 pl-6 py-4">
                              <div className="text-zinc-300 text-sm">
                                {flight.timestamp
                                  ? new Date(
                                      flight.timestamp
                                    ).toLocaleTimeString('en-GB', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      timeZone: 'UTC',
                                    })
                                  : flight.created_at
                                    ? new Date(
                                        flight.created_at
                                      ).toLocaleTimeString('en-GB', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        timeZone: 'UTC',
                                      })
                                    : 'N/A'}
                              </div>
                            </td>
                            <td className="px-3 py-4">
                              <div className="flex items-center gap-2">
                                {flight.flight_type && (
                                  <span
                                    className={`text-xs font-bold ${getFlightTypeColor(flight.flight_type)}`}
                                  >
                                    {flight.flight_type}
                                  </span>
                                )}
                                {renderEditableCell(flight, 'callsign', 'text')}
                              </div>
                            </td>
                            <td className="px-3 py-4">
                              {isEventController
                                ? renderEditableCell(flight, 'status', 'status')
                                : getStatusBadge(flight.status || '')}
                            </td>
                            <td className="px-3 py-4">
                              <div className="flex items-center gap-1.5">
                                <PlaneTakeoff className="w-3.5 h-3.5 text-blue-400" />
                                <span className="font-mono text-blue-300 font-semibold">
                                  {flight.departure || 'N/A'}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-4">
                              {isEventController ? (
                                renderEditableCell(flight, 'arrival', 'airport')
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <PlaneLanding className="w-3.5 h-3.5 text-green-400" />
                                  <span className="font-mono text-green-300 font-semibold">
                                    {flight.arrival || 'N/A'}
                                  </span>
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-4">
                              {isEventController ? (
                                renderEditableCell(
                                  flight,
                                  'aircraft',
                                  'aircraft'
                                )
                              ) : (
                                <span className="font-mono text-purple-300 font-medium">
                                  {flight.aircraft || 'N/A'}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-4">
                              {isEventController ? (
                                renderEditableCell(
                                  flight,
                                  'cruisingFL',
                                  'altitude'
                                )
                              ) : (
                                <span className="font-mono text-cyan-300 font-medium">
                                  {flight.cruisingFL || '-'}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-4">
                              {isEventController ? (
                                renderEditableCell(
                                  flight,
                                  'clearedFL',
                                  'altitude'
                                )
                              ) : (
                                <span className="font-mono text-amber-300 font-medium">
                                  {flight.clearedFL || '-'}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-4">
                              {isEventController ? (
                                renderEditableCell(flight, 'sid', 'sid')
                              ) : (
                                <span className="font-mono text-indigo-300 text-xs">
                                  {flight.sid || '-'}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-4">
                              {isEventController ? (
                                renderEditableCell(flight, 'star', 'star')
                              ) : (
                                <span className="font-mono text-pink-300 text-xs">
                                  {flight.star || '-'}
                                </span>
                              )}
                            </td>
                            <td className="px-3 pr-6 py-4">
                              {isEventController ? (
                                renderEditableCell(flight, 'remark', 'text')
                              ) : (
                                <span className="text-zinc-400 text-xs italic">
                                  {flight.remark || '-'}
                                </span>
                              )}
                            </td>
                            {isEventController && (
                              <td className="px-3 pr-6 py-4 flex justify-center">
                                <button
                                  type="button"
                                  ref={(el) => {
                                    if (el) {
                                      actionButtonRefs.current[flight.id] = el;
                                    }
                                  }}
                                  className={`flex items-center justify-center text-gray-400 hover:text-white transition-colors ${!isEventController || !selectedStation ? 'opacity-50 cursor-not-allowed' : ''}`}
                                  onClick={() => {
                                    setOpenActionMenuId(
                                      openActionMenuId === flight.id
                                        ? null
                                        : flight.id
                                    );
                                  }}
                                  title="Actions"
                                  disabled={
                                    !isEventController || !selectedStation
                                  }
                                >
                                  <Menu className="h-6 w-6" strokeWidth={2.5} />
                                </button>
                                {openActionMenuId === flight.id &&
                                  createPortal(
                                    <>
                                      <div
                                        className="fixed inset-0"
                                        style={{ zIndex: 9997 }}
                                        onClick={() =>
                                          setOpenActionMenuId(null)
                                        }
                                      />
                                      <div
                                        className="fixed w-40 bg-gray-800 border border-blue-600 rounded-2xl shadow-lg py-1 overflow-hidden"
                                        style={{
                                          zIndex: 9998,
                                          top: (() => {
                                            const btn =
                                              actionButtonRefs.current[
                                                flight.id
                                              ];
                                            if (btn) {
                                              const rect =
                                                btn.getBoundingClientRect();
                                              return `${rect.bottom + 4}px`;
                                            }
                                            return '0px';
                                          })(),
                                          left: (() => {
                                            const btn =
                                              actionButtonRefs.current[
                                                flight.id
                                              ];
                                            if (btn) {
                                              const rect =
                                                btn.getBoundingClientRect();
                                              return `${rect.right - 160}px`;
                                            }
                                            return '0px';
                                          })(),
                                        }}
                                      >
                                        <button
                                          type="button"
                                          className="w-full text-left px-3 py-2 text-sm hover:bg-blue-600 hover:text-white flex items-center gap-2"
                                          onClick={() =>
                                            handleOpenFlightDetails(flight)
                                          }
                                        >
                                          <FileText className="w-4 h-4" />
                                          Details
                                        </button>
                                        <button
                                          type="button"
                                          className="w-full text-left px-3 py-2 text-sm hover:bg-blue-600 hover:text-white flex items-center gap-2"
                                          onClick={() =>
                                            handleToggleHidden(flight)
                                          }
                                        >
                                          {flight.hidden ? (
                                            <Eye className="w-4 h-4" />
                                          ) : (
                                            <EyeOff className="w-4 h-4" />
                                          )}
                                          {flight.hidden ? 'Unhide' : 'Hide'}
                                        </button>
                                      </div>
                                    </>,
                                    document.body
                                  )}
                              </td>
                            )}
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 items-start">
                {Object.entries(airportSessions).map(
                  ([icao, sessions], index) => {
                    const totalFlights = sessions.reduce(
                      (sum, session) => sum + session.flightCount,
                      0
                    );
                    const totalUsers = sessions.reduce(
                      (sum, session) => sum + session.activeUsers,
                      0
                    );
                    const isExpanded = expandedAirports.has(icao);
                    const arrivals =
                      overviewData?.arrivalsByAirport[icao] || [];
                    const departureFlights = sessions.flatMap(
                      (session) => session.flights
                    );

                    return (
                      <div
                        key={`${icao}-${index}`}
                        className="bg-zinc-800/50 border border-zinc-700/50 rounded-2xl overflow-visible h-fit"
                      >
                        <div className="p-4 sm:p-6">
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
                            {(arrivals.length > 0 ||
                              departureFlights.length > 0) && (
                              <Button
                                onClick={() => toggleAirportExpansion(icao)}
                                variant="ghost"
                                size="sm"
                                className="p-2 hover:bg-zinc-700/50"
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
                            <div className="z-100">
                              <FrequencyDisplay airportIcao={icao ?? ''} />
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-4 mt-4">
                            <div className="text-center">
                              <div className="text-lg font-bold text-white">
                                {totalUsers}
                              </div>
                              <div className="text-zinc-400 text-xs">
                                Controllers
                              </div>
                            </div>
                            <div className="text-center">
                              <div className="text-lg font-bold text-white">
                                {totalFlights + arrivals.length}
                              </div>
                              <div className="text-zinc-400 text-xs">
                                Flights
                              </div>
                            </div>
                            {sessions[0]?.activeRunway && (
                              <div className="text-center">
                                <div className="font-mono text-white font-medium">
                                  {sessions[0].activeRunway}
                                </div>
                                <div className="text-sm text-zinc-400">
                                  Runway
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="border-t border-zinc-700/50 bg-zinc-800/50">
                            <div className="p-4 sm:p-6 space-y-4 max-h-96 overflow-y-auto">
                              {departureFlights.length > 0 && (
                                <div>
                                  <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                                    <PlaneTakeoff className="w-4 h-4 text-blue-400" />
                                    Departures ({departureFlights.length})
                                  </h4>
                                  <div className="space-y-2">
                                    {departureFlights.map((flight) => (
                                      <div
                                        key={`departure-${flight.id}`}
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
                                    ))}
                                  </div>
                                </div>
                              )}

                              {arrivals.length > 0 && (
                                <div>
                                  <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                                    <PlaneLanding className="w-4 h-4 text-green-400" />
                                    Arrivals ({arrivals.length})
                                  </h4>
                                  <div className="space-y-2">
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

                              {departureFlights.length === 0 &&
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
                  }
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <FlightDetailsModal
        isOpen={isFlightDetailModalOpen}
        onClose={handleCloseFlightDetails}
        flight={flightForModal}
        onFlightChange={handleFieldChange}
      />

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

      <ContactAcarsSidebar
        open={isContactSidebarOpen}
        onClose={() => setIsContactSidebarOpen(false)}
        flights={activeAcarsFlightsData}
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
