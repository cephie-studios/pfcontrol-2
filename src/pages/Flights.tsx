import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useMediaQuery } from 'react-responsive';
import { fetchFlights } from '../utils/fetch/flights';
import { fetchSession, updateSession } from '../utils/fetch/sessions';
import { fetchBackgrounds } from '../utils/fetch/data';
import { createFlightsSocket } from '../sockets/flightsSocket';
import { createArrivalsSocket } from '../sockets/arrivalsSocket';
import { createSessionUsersSocket } from '../sockets/sessionUsersSocket';
import { useAuth } from '../hooks/auth/useAuth';
import { playSoundWithSettings } from '../utils/playSound';
import { useSettings } from '../hooks/settings/useSettings';
import { steps } from '../components/tutorial/TutorialStepsFlights';
import { updateTutorialStatus } from '../utils/fetch/auth';
import type { Flight } from '../types/flight';
import type { Position } from '../types/session';
import type {
  ArrivalsTableColumnSettings,
  DepartureTableColumnSettings,
} from '../types/settings';
import type { FieldEditingState } from '../sockets/sessionUsersSocket';
import Navbar from '../components/Navbar';
import Toolbar from '../components/tools/Toolbar';
import DepartureTable from '../components/tables/DepartureTable';
import ArrivalsTable from '../components/tables/ArrivalsTable';
import CombinedFlightsTable from '../components/tables/CombinedFlightsTable';
import AccessDenied from '../components/AccessDenied';
import AddCustomFlightModal from '../components/modals/AddCustomFlightModal';
import ContactAcarsSidebar from '../components/tools/ContactAcarsSidebar';
import Button from '../components/common/Button';
import Loader from '../components/common/Loader';
import Joyride, { type CallBackProps, STATUS } from 'react-joyride';
import CustomTooltip from '../components/tutorial/CustomToolTip';

const API_BASE_URL = import.meta.env.VITE_SERVER_URL;

interface SessionData {
  sessionId: string;
  airportIcao: string;
  activeRunway?: string;
  atis?: unknown;
  isPFATC: boolean;
}

interface AvailableImage {
  filename: string;
  path: string;
  extension: string;
}

export default function Flights() {
  const { sessionId } = useParams<{ sessionId?: string }>();
  const [searchParams] = useSearchParams();
  const accessId = searchParams.get('accessId') ?? undefined;
  const startTutorial = searchParams.get('tutorial') === 'true';
  const isMobile = useMediaQuery({ maxWidth: 1000 });

  const [accessError, setAccessError] = useState<string | null>(null);
  const [validatingAccess, setValidatingAccess] = useState(true);
  const [session, setSession] = useState<SessionData | null>(null);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [flashingPDCIds, setFlashingPDCIds] = useState<Set<string>>(new Set());
  const [flightsSocket, setFlightsSocket] = useState<ReturnType<
    typeof createFlightsSocket
  > | null>(null);
  const [arrivalsSocket, setArrivalsSocket] = useState<ReturnType<
    typeof createArrivalsSocket
  > | null>(null);
  const [lastSessionId, setLastSessionId] = useState<string | null>(null);
  const [availableImages, setAvailableImages] = useState<AvailableImage[]>([]);
  const [startupSoundPlayed, setStartupSoundPlayed] = useState(false);
  const { user } = useAuth();
  const { settings } = useSettings();
  const [currentView, setCurrentView] = useState<'departures' | 'arrivals'>(
    'departures'
  );
  const [externalArrivals, setExternalArrivals] = useState<Flight[]>([]);
  const [localHiddenFlights, setLocalHiddenFlights] = useState<
    Set<string | number>
  >(new Set());
  const [position, setPosition] = useState<Position>('ALL');
  const [fieldEditingStates, setFieldEditingStates] = useState<
    FieldEditingState[]
  >([]);
  const [sessionUsersSocket, setSessionUsersSocket] = useState<ReturnType<
    typeof createSessionUsersSocket
  > | null>(null);
  const [customDepartureFlights, setCustomDepartureFlights] = useState<
    Flight[]
  >([]);
  const [customArrivalFlights, setCustomArrivalFlights] = useState<Flight[]>(
    []
  );
  const [showAddDepartureModal, setShowAddDepartureModal] = useState(false);
  const [showAddArrivalModal, setShowAddArrivalModal] = useState(false);
  const [showContactAcarsModal, setShowContactAcarsModal] = useState(false);
  const [activeAcarsFlights, setActiveAcarsFlights] = useState<
    Set<string | number>
  >(new Set());
  const [activeAcarsFlightData, setActiveAcarsFlightData] = useState<Flight[]>(
    []
  );

  const userRef = useRef(user);
  const settingsRef = useRef(settings);
  const flightsSocketConnectedRef = useRef(false);
  const arrivalsSocketConnectedRef = useRef(false);
  const sessionUsersSocketConnectedRef = useRef(false);

  useEffect(() => {
    userRef.current = user;
    settingsRef.current = settings;
  }, [user, settings]);

  const handleMentionReceived = useCallback(() => {
    const currentUser = userRef.current;
    if (currentUser) {
      playSoundWithSettings(
        'chatNotificationSound',
        currentUser.settings,
        0.7
      ).catch((error) => {
        console.warn('Failed to play chat notification sound:', error);
      });
    }
  }, []);

  type AtisData = {
    letter?: string;
    updatedBy?: string;
    isAutoGenerated?: boolean;
  };

  const handleAtisUpdateFromSocket = (data: {
    atis?: AtisData;
    updatedBy?: string;
    isAutoGenerated?: boolean;
  }) => {
    if (data.atis?.letter) {
      console.log('ATIS updated:', data);
    }
  };

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

  useEffect(() => {
    if (!sessionId) {
      setAccessError('Session ID is required');
      setValidatingAccess(false);
      return;
    }

    if (!accessId) {
      setAccessError('Access ID is required. Please use a valid session link.');
      setValidatingAccess(false);
      return;
    }

    setValidatingAccess(false);
    setAccessError(null);
  }, [sessionId, accessId]);

  useEffect(() => {
    if (
      !sessionId ||
      sessionId === lastSessionId ||
      initialLoadComplete ||
      accessError
    )
      return;

    setLoading(true);
    setLastSessionId(sessionId);

    Promise.all([
      fetchSession(sessionId, accessId ?? '').catch((error) => {
        console.error('Error fetching session:', error);
        if (
          error.message?.includes('403') ||
          error.message?.includes('Invalid session access')
        ) {
          setAccessError('Invalid access link or session expired');
        } else if (
          error.message?.includes('404') ||
          error.message?.includes('not found')
        ) {
          setAccessError('Session not found');
        } else {
          setAccessError('Unable to access session');
        }
        return null;
      }),
      fetchFlights(sessionId).catch((error) => {
        console.error('Error fetching flights:', error);
        return [];
      }),
    ])
      .then(([sessionData, flightsData]) => {
        if (sessionData) {
          setSession(sessionData);
        }
        setFlights(flightsData);
        setInitialLoadComplete(true);
        if (!startupSoundPlayed && user && settings) {
          playSoundWithSettings('startupSound', settings, 0.7).catch(
            (error) => {
              console.warn('Failed to play session startup sound:', error);
            }
          );
          setStartupSoundPlayed(true);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [
    sessionId,
    accessId,
    lastSessionId,
    initialLoadComplete,
    startupSoundPlayed,
    user,
    settings,
    accessError,
  ]);

  useEffect(() => {
    if (!sessionId || !accessId || !initialLoadComplete || accessError) return;

    if (flightsSocketConnectedRef.current) return;

    flightsSocketConnectedRef.current = true;

    const socket = createFlightsSocket(
      sessionId,
      accessId,
      // onFlightUpdated
      (flight: Flight) => {
        setFlights((prev) =>
          prev.map((f) => (f.id === flight.id ? flight : f))
        );
      },
      // onFlightAdded
      (flight: Flight) => {
        setFlights((prev) => [...prev, flight]);
        const currentSettings = settingsRef.current;
        if (currentSettings) {
          playSoundWithSettings('newStripSound', currentSettings, 0.7).catch(
            (error) => {
              console.warn('Failed to play new strip sound:', error);
            }
          );
        }
      },
      // onFlightDeleted
      ({ flightId }) => {
        setFlights((prev) => prev.filter((flight) => flight.id !== flightId));
      },
      // onFlightError
      (error) => {
        console.error('Flight websocket error:', error);
      }
    );
    socket.socket.on('sessionUpdated', (updates) => {
      setSession((prev) => (prev ? { ...prev, ...updates } : null));
    });
    setFlightsSocket(socket);
    return () => {
      flightsSocketConnectedRef.current = false;
      socket.socket.disconnect();
    };
  }, [sessionId, accessId, initialLoadComplete]);
  const handleIssuePDC = async (flightId: string | number, pdcText: string) => {
    if (!flightsSocket?.socket) {
      console.warn('handleIssuePDC: no flights socket available');
      throw new Error('No flights socket');
    }
    flightsSocket.socket.emit('issuePDC', { flightId, pdcText });
  };

  useEffect(() => {
    if (!showContactAcarsModal) return;

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
          setActiveAcarsFlightData(flights);
          setActiveAcarsFlights(new Set(flights.map((f) => f.id)));
        }
      } catch {
        // Ignore errors
      }
    };

    fetchActiveAcars();
  }, [showContactAcarsModal]);

  const handleSendContact = async (
    flightId: string | number,
    message: string
  ) => {
    if (!flightsSocket?.socket) {
      throw new Error('No flights socket');
    }
    flightsSocket.socket.emit('contactMe', { flightId, message });
  };

  useEffect(() => {
    if (!sessionId || !accessId || !initialLoadComplete || !session?.isPFATC)
      return;

    if (arrivalsSocketConnectedRef.current) return;

    arrivalsSocketConnectedRef.current = true;

    const socket = createArrivalsSocket(
      sessionId,
      accessId,
      // onArrivalUpdated
      (flight: Flight) => {
        setExternalArrivals((prev) =>
          prev.map((f) => (f.id === flight.id ? flight : f))
        );
      },
      // onArrivalError
      (error) => {
        console.error('Arrival websocket error:', error);
      },
      // onInitialExternalArrivals
      (flights: Flight[]) => {
        console.log('Received initial external arrivals:', flights);
        setExternalArrivals(flights);
      }
    );
    setArrivalsSocket(socket);
    return () => {
      arrivalsSocketConnectedRef.current = false;
      socket.socket.disconnect();
    };
  }, [sessionId, accessId, initialLoadComplete, session?.isPFATC]);

  useEffect(() => {
    if (!sessionId || !accessId || !user) return;

    if (sessionUsersSocketConnectedRef.current) return;

    sessionUsersSocketConnectedRef.current = true;

    const userId = user.userId;
    const username = user.username;
    const avatar = user.avatar;

    const socket = createSessionUsersSocket(
      sessionId,
      accessId,
      {
        userId,
        username,
        avatar,
      },
      () => {},
      () => {},
      () => {},
      () => {},
      () => {},
      handleMentionReceived,
      (editingStates: FieldEditingState[]) =>
        setFieldEditingStates(editingStates),
      'ALL'
    );

    setSessionUsersSocket(socket);

    if (socket) {
      socket.on('atisUpdate', handleAtisUpdateFromSocket);
    }

    return () => {
      sessionUsersSocketConnectedRef.current = false;
      if (socket) {
        socket.off('atisUpdate', handleAtisUpdateFromSocket);
        socket.disconnect();
      }
    };
  }, [
    sessionId,
    accessId,
    user?.userId,
    user?.username,
    user?.avatar,
    handleMentionReceived,
  ]);

  useEffect(() => {
    if (sessionUsersSocket && sessionUsersSocket.emitPositionChange) {
      sessionUsersSocket.emitPositionChange(position);
    }
  }, [position, sessionUsersSocket]);

  useEffect(() => {
    if (!flightsSocket?.socket) return;

    const onPdcRequest = (payload: { flightId?: string | number }) => {
      const id = payload?.flightId;
      if (!id) return;
      setFlashingPDCIds((prev) => {
        const next = new Set(prev);
        next.add(String(id));
        return next;
      });
    };

    flightsSocket.socket.on('pdcRequest', onPdcRequest);
    return () => {
      flightsSocket.socket.off('pdcRequest', onPdcRequest);
    };
  }, [flightsSocket]);

  const handleToggleClearance = (
    flightId: string | number,
    checked: boolean
  ) => {
    // Persist as boolean
    handleFlightUpdate(flightId, { clearance: checked });

    // Always stop flashing once checked
    if (checked) {
      setFlashingPDCIds((prev) => {
        const next = new Set(prev);
        next.delete(String(flightId));
        return next;
      });
    }
  };

  const handleFlightUpdate = (
    flightId: string | number,
    updates: Partial<Flight>
  ) => {
    if (Object.prototype.hasOwnProperty.call(updates, 'hidden')) {
      if (updates.hidden) {
        setLocalHiddenFlights((prev) => new Set(prev).add(flightId));
      } else {
        setLocalHiddenFlights((prev) => {
          const newSet = new Set(prev);
          newSet.delete(flightId);
          return newSet;
        });
      }
      return;
    }

    // Check if it's a custom departure flight
    const isCustomDeparture = customDepartureFlights.some(
      (f) => f.id === flightId
    );
    if (isCustomDeparture) {
      setCustomDepartureFlights((prev) =>
        prev.map((f) => (f.id === flightId ? { ...f, ...updates } : f))
      );
      return;
    }

    // Check if it's a custom arrival flight
    const isCustomArrival = customArrivalFlights.some((f) => f.id === flightId);
    if (isCustomArrival) {
      setCustomArrivalFlights((prev) =>
        prev.map((f) => (f.id === flightId ? { ...f, ...updates } : f))
      );
      return;
    }

    const isExternalArrival = externalArrivals.some((f) => f.id === flightId);

    if (isExternalArrival && arrivalsSocket?.socket?.connected) {
      arrivalsSocket.updateArrival(flightId, updates);
    } else if (flightsSocket?.socket?.connected) {
      flightsSocket.updateFlight(flightId, updates);
    } else {
      console.warn('Socket not connected, updating local state only');
      setFlights((prev) =>
        prev.map((flight) =>
          flight.id === flightId ? { ...flight, ...updates } : flight
        )
      );
    }
  };

  const handleFlightDelete = (flightId: string | number) => {
    // Check if it's a custom departure flight
    const isCustomDeparture = customDepartureFlights.some(
      (f) => f.id === flightId
    );
    if (isCustomDeparture) {
      setCustomDepartureFlights((prev) =>
        prev.filter((f) => f.id !== flightId)
      );
      return;
    }

    // Check if it's a custom arrival flight
    const isCustomArrival = customArrivalFlights.some((f) => f.id === flightId);
    if (isCustomArrival) {
      setCustomArrivalFlights((prev) => prev.filter((f) => f.id !== flightId));
      return;
    }

    // Regular flight deletion via WebSocket
    if (flightsSocket?.socket?.connected) {
      flightsSocket.deleteFlight(flightId);
    } else {
      console.warn('Socket not connected, updating local state only');
      setFlights((prev) => prev.filter((flight) => flight.id !== flightId));
    }
  };

  const handleAddCustomDeparture = (flightData: Partial<Flight>) => {
    const newFlight: Flight = {
      id: `custom-dep-${Date.now()}`,
      session_id: sessionId || '',
      callsign: flightData.callsign || '',
      aircraft: flightData.aircraft || '',
      departure: session?.airportIcao || '',
      arrival: flightData.arrival || '',
      flight_type: flightData.flight_type || 'IFR',
      stand: flightData.stand,
      runway: flightData.runway,
      sid: flightData.sid,
      cruisingFL: flightData.cruisingFL,
      clearedFL: flightData.clearedFL,
      squawk: flightData.squawk,
      wtc: flightData.wtc || 'M',
      status: flightData.status || 'PENDING',
      remark: flightData.remark,
      hidden: false,
    };
    setCustomDepartureFlights((prev) => [...prev, newFlight]);
  };

  const handleAddCustomArrival = (flightData: Partial<Flight>) => {
    const newFlight: Flight = {
      id: `custom-arr-${Date.now()}`,
      session_id: sessionId || '',
      callsign: flightData.callsign || '',
      aircraft: flightData.aircraft || '',
      departure: flightData.departure || '',
      arrival: session?.airportIcao || '',
      flight_type: flightData.flight_type || 'IFR',
      gate: flightData.gate,
      runway: flightData.runway,
      star: flightData.star,
      cruisingFL: flightData.cruisingFL,
      clearedFL: flightData.clearedFL,
      squawk: flightData.squawk,
      wtc: flightData.wtc || 'M',
      status: flightData.status || 'APPR',
      remark: flightData.remark,
      hidden: false,
    };
    setCustomArrivalFlights((prev) => [...prev, newFlight]);
  };

  const handleRunwayChange = async (selectedRunway: string) => {
    if (!sessionId) return;
    try {
      await updateSession(sessionId, accessId ?? '', {
        activeRunway: selectedRunway,
      });
      setSession((prev) =>
        prev ? { ...prev, activeRunway: selectedRunway } : null
      );
      if (flightsSocket?.socket?.connected) {
        flightsSocket.updateSession({ activeRunway: selectedRunway });
      } else {
        console.warn('Socket not connected, runway updated via API only');
      }
    } catch (error) {
      console.error('Failed to update runway:', error);
    }
  };

  const handleViewChange = (view: 'departures' | 'arrivals') => {
    setCurrentView(view);
  };

  const getAllowedStatuses = (pos: Position): string[] => {
    switch (pos) {
      case 'ALL':
        return [];
      case 'DEL':
        return ['PENDING', 'STUP'];
      case 'GND':
        return ['STUP', 'PUSH', 'TAXI'];
      case 'TWR':
        return ['TAXI', 'RWY', 'DEPA'];
      case 'APP':
        return ['RWY', 'DEPA'];
      default:
        return [];
    }
  };

  const departureFlights = useMemo(() => {
    const regularDepartures = flights
      .filter(
        (flight) =>
          flight.departure?.toUpperCase() ===
          session?.airportIcao?.toUpperCase()
      )
      .map((flight) => ({
        ...flight,
        hidden: localHiddenFlights.has(flight.id),
      }));

    // Combine regular flights with custom flights
    return [...regularDepartures, ...customDepartureFlights];
  }, [
    flights,
    session?.airportIcao,
    localHiddenFlights,
    customDepartureFlights,
  ]);

  const arrivalFlights = useMemo(() => {
    const ownArrivals = flights.filter(
      (flight) =>
        flight.arrival?.toUpperCase() === session?.airportIcao?.toUpperCase()
    );

    let baseArrivals = ownArrivals;
    if (session?.isPFATC) {
      baseArrivals = [...ownArrivals, ...externalArrivals];
    }

    const mappedArrivals = baseArrivals.map((flight) => ({
      ...flight,
      hidden: localHiddenFlights.has(flight.id),
    }));

    // Combine regular arrivals with custom arrivals
    return [...mappedArrivals, ...customArrivalFlights];
  }, [
    flights,
    externalArrivals,
    session?.airportIcao,
    session?.isPFATC,
    localHiddenFlights,
    customArrivalFlights,
  ]);

  const filteredFlights = useMemo(() => {
    let baseFlights: Flight[] = [];

    if (currentView === 'arrivals') {
      const ownArrivals = flights.filter(
        (flight) =>
          flight.arrival?.toUpperCase() === session?.airportIcao?.toUpperCase()
      );

      if (session?.isPFATC) {
        baseFlights = [...ownArrivals, ...externalArrivals];
      } else {
        baseFlights = ownArrivals;
      }

      baseFlights = [...baseFlights, ...customArrivalFlights];
    } else {
      baseFlights = flights.filter(
        (flight) =>
          flight.departure?.toUpperCase() ===
          session?.airportIcao?.toUpperCase()
      );

      baseFlights = [...baseFlights, ...customDepartureFlights];
    }

    if (currentView === 'departures' && position !== 'ALL') {
      const allowedStatuses = getAllowedStatuses(position);
      baseFlights = baseFlights.filter((flight) =>
        allowedStatuses.includes(flight.status || '')
      );
    }

    return baseFlights.map((flight) => ({
      ...flight,
      hidden: localHiddenFlights.has(flight.id),
    }));
  }, [
    flights,
    externalArrivals,
    currentView,
    session?.airportIcao,
    session?.isPFATC,
    localHiddenFlights,
    position,
    customDepartureFlights,
    customArrivalFlights,
  ]);

  const backgroundImage = useMemo(() => {
    const selectedImage = settings?.backgroundImage?.selectedImage;
    let bgImage = 'url("/assets/app/backgrounds/mdpc_01.png")';

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

  const showCombinedView = !isMobile && settings?.layout?.showCombinedView;
  const flightRowOpacity = settings?.layout?.flightRowOpacity ?? 100;

  const getBackgroundStyle = (opacity: number) => {
    if (opacity === 0) {
      return { backgroundColor: 'transparent' };
    }
    const alpha = opacity / 100;
    return {
      backgroundColor: `rgba(0, 0, 0, ${alpha})`,
    };
  };

  const backgroundStyle = getBackgroundStyle(flightRowOpacity);

  const defaultDepartureColumns: DepartureTableColumnSettings = {
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
    pdc: true,
    hide: true,
    delete: true,
  };

  const defaultArrivalsColumns: ArrivalsTableColumnSettings = {
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
  };

  const departureColumns = {
    ...defaultDepartureColumns,
    ...settings?.departureTableColumns,
  };
  const arrivalsColumns = {
    ...defaultArrivalsColumns,
    ...settings?.arrivalsTableColumns,
  };

  const handleFieldEditingStart = (
    flightId: string | number,
    fieldName: string
  ) => {
    if (sessionUsersSocket?.emitFieldEditingStart) {
      sessionUsersSocket.emitFieldEditingStart(flightId, fieldName);
    }
  };

  const handleFieldEditingStop = (
    flightId: string | number,
    fieldName: string
  ) => {
    if (sessionUsersSocket?.emitFieldEditingStop) {
      sessionUsersSocket.emitFieldEditingStop(flightId, fieldName);
    }
  };

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status } = data;
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      updateTutorialStatus(true);
    }
  };

  // Early return for validation states
  if (validatingAccess) {
    return (
      <div className="min-h-screen text-white relative">
        <div className="relative z-10">
          <Navbar sessionId={sessionId} accessId={accessId} />
          <Loader />
        </div>
      </div>
    );
  }

  if (accessError) {
    return (
      <AccessDenied
        message={accessError}
        sessionId={sessionId}
        accessId={accessId}
      />
    );
  }

  return (
    <div className="min-h-screen text-white relative">
      <div
        aria-hidden
        className="absolute inset-0 z-0"
        style={{
          backgroundImage,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundAttachment: 'fixed',
          opacity: 0.2,
          pointerEvents: 'none',
        }}
      />
      <div className="relative z-10">
        <Navbar sessionId={sessionId} accessId={accessId} />
        <div className="pt-16">
          <Toolbar
            icao={session ? session.airportIcao : ''}
            sessionId={sessionId}
            accessId={accessId}
            activeRunway={session?.activeRunway}
            onRunwayChange={handleRunwayChange}
            isPFATC={session?.isPFATC}
            currentView={currentView}
            onViewChange={handleViewChange}
            showViewTabs={!showCombinedView}
            position={position}
            onPositionChange={setPosition}
            onContactAcarsClick={() => setShowContactAcarsModal(true)}
          />
          <div className="-mt-4">
            {loading ? (
              <div className="text-center py-12 text-gray-400">
                Loading {currentView}...
              </div>
            ) : showCombinedView ? (
              <>
                <CombinedFlightsTable
                  departureFlights={departureFlights}
                  arrivalFlights={arrivalFlights}
                  onFlightDelete={handleFlightDelete}
                  onFlightChange={handleFlightUpdate}
                  backgroundStyle={backgroundStyle}
                  onIssuePDC={handleIssuePDC}
                  flashFlightId={null}
                  onToggleClearance={handleToggleClearance}
                  flashingPDCIds={flashingPDCIds}
                />
                <div className="flex justify-center gap-4 mt-4 mb-6">
                  <Button
                    onClick={() => setShowAddDepartureModal(true)}
                    variant="primary"
                    size="sm"
                    className="flex items-center space-x-2"
                    id="add-departure-btn"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    <span>Add Custom Departure</span>
                  </Button>
                  <Button
                    onClick={() => setShowAddArrivalModal(true)}
                    variant="primary"
                    size="sm"
                    className="flex items-center space-x-2"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    <span>Add Custom Arrival</span>
                  </Button>
                </div>
              </>
            ) : (
              <>
                {currentView === 'departures' ? (
                  <>
                    <DepartureTable
                      flights={filteredFlights}
                      onFlightDelete={handleFlightDelete}
                      onFlightChange={handleFlightUpdate}
                      backgroundStyle={backgroundStyle}
                      departureColumns={departureColumns}
                      fieldEditingStates={fieldEditingStates}
                      onFieldEditingStart={handleFieldEditingStart}
                      onFieldEditingStop={handleFieldEditingStop}
                      flashFlightId={null}
                      onToggleClearance={handleToggleClearance}
                      flashingPDCIds={flashingPDCIds}
                      onIssuePDC={handleIssuePDC}
                      id="departure-table"
                    />
                    <div className="flex justify-center mt-4 mb-6">
                      <Button
                        onClick={() => setShowAddDepartureModal(true)}
                        variant="primary"
                        size="sm"
                        className="flex items-center space-x-2"
                        id="add-departure-btn"
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 4v16m8-8H4"
                          />
                        </svg>
                        <span>Add Custom Departure</span>
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <ArrivalsTable
                      flights={filteredFlights}
                      onFlightChange={handleFlightUpdate}
                      backgroundStyle={backgroundStyle}
                      arrivalsColumns={arrivalsColumns}
                    />
                    <div className="flex justify-center mt-4 mb-6">
                      <Button
                        onClick={() => setShowAddArrivalModal(true)}
                        variant="primary"
                        size="sm"
                        className="flex items-center space-x-2"
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 4v16m8-8H4"
                          />
                        </svg>
                        <span>Add Custom Arrival</span>
                      </Button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <AddCustomFlightModal
        isOpen={showAddDepartureModal}
        onClose={() => setShowAddDepartureModal(false)}
        onAdd={handleAddCustomDeparture}
        flightType="departure"
        airportIcao={session?.airportIcao}
      />
      <AddCustomFlightModal
        isOpen={showAddArrivalModal}
        onClose={() => setShowAddArrivalModal(false)}
        onAdd={handleAddCustomArrival}
        flightType="arrival"
        airportIcao={session?.airportIcao}
      />
      <ContactAcarsSidebar
        open={showContactAcarsModal}
        onClose={() => setShowContactAcarsModal(false)}
        flights={activeAcarsFlightData}
        onSendContact={handleSendContact}
        activeAcarsFlights={activeAcarsFlights}
        airportIcao={session?.airportIcao || ''}
      />
      <Joyride
        steps={steps}
        run={startTutorial}
        callback={handleJoyrideCallback}
        continuous
        showProgress
        showSkipButton
        disableScrolling={true}
        tooltipComponent={CustomTooltip}
        styles={{
          options: {
            primaryColor: '#3b82f6',
            textColor: '#ffffff',
            backgroundColor: '#1f2937',
            zIndex: 1000,
          },
          spotlight: {
            border: '2px solid #fbbf24',
            borderRadius: '24px',
            boxShadow: '0 0 20px rgba(251, 191, 36, 0.5)',
          },
        }}
      />
    </div>
  );
}
