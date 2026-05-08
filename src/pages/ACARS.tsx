import { useState, useRef, useEffect, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Loader from '../components/common/Loader';
import Button from '../components/common/Button';
import {
  PanelLeftClose,
  PanelLeftOpen,
  Map,
  PlaneTakeoff,
  PlusCircle,
  Camera,
} from 'lucide-react';
import { useData } from '../hooks/data/useData';
import { useSettings } from '../hooks/settings/useSettings';
import { useAuth } from '../hooks/auth/useAuth';
import { createFlightsSocket } from '../sockets/flightsSocket';
import {
  createOverviewSocket,
  type OverviewSession,
} from '../sockets/overviewSocket';
import { getAirportName, parseCallsign } from '../utils/callsignParser';
import { getChartsForAirport, playNotificationSound } from '../utils/acars';
import { createChartHandlers } from '../utils/charts';
import type { AcarsMessage } from '../types/acars';
import type { Flight } from '../types/flight';
import type { SessionInfo } from '../types/session';

import AcarsSidebar from '../components/acars/AcarsSidebar';
import AcarsTerminal from '../components/acars/AcarsTerminal';
import AcarsNotePanel from '../components/acars/AcarsNotePanel';
import ChartDrawer from '../components/tools/ChartDrawer';
import ControllerRatingPopup from '../components/tools/ControllerRatingPopup';
import Modal from '../components/common/Modal';
import { getDiscordLoginUrl } from '../utils/fetch/auth';
import { uploadSnapImage } from '../utils/fetch/flights';

export default function ACARS() {
  const { sessionId, flightId } = useParams<{
    sessionId: string;
    flightId: string;
  }>();
  const [searchParams] = useSearchParams();
  const accessId = searchParams.get('acars_token');
  const navigate = useNavigate();
  const { user } = useAuth();
  const { airports, airlines, loading: dataLoading } = useData();
  const { settings, loading: settingsLoading } = useSettings();
  const [loading, setLoading] = useState(true);
  const [flight, setFlight] = useState<Flight | null>(null);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [showRating, setShowRating] = useState(false);
  const [messages, setMessages] = useState<AcarsMessage[]>([]);
  const [activeSessions, setActiveSessions] = useState<OverviewSession[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isAuthError, setIsAuthError] = useState(false);
  const [pdcRequested, setPdcRequested] = useState(false);
  const [sessionAccessId, setSessionAccessId] = useState<string | null>(null);
  const [notes, setNotes] = useState<string>('');
  const [selectedChart, setSelectedChart] = useState<string | null>(null);
  const [chartLoadError, setChartLoadError] = useState(false);
  const [chartZoom, setChartZoom] = useState(1);
  const [chartPan, setChartPan] = useState({ x: 0, y: 0 });
  const [isChartDragging, setIsChartDragging] = useState(false);
  const [chartDragStart, setChartDragStart] = useState({ x: 0, y: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [showSidebar, setShowSidebar] = useState(true);
  const [mobileTab, setMobileTab] = useState<'terminal' | 'notes' | 'charts'>(
    'terminal'
  );
  const [showChartsDrawer, setShowChartsDrawer] = useState(false);
  const [showAccountPrompt, setShowAccountPrompt] = useState(false);

  const [snapUploading, setSnapUploading] = useState(false);
  const snapInputRef = useRef<HTMLInputElement>(null);

  const socketRef = useRef<ReturnType<typeof createFlightsSocket> | null>(null);
  const initializedRef = useRef(false);
  const notesInitializedRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
        containerRef as React.RefObject<HTMLDivElement>,
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

  const {
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    handleChartMouseDown,
    handleChartMouseMove,
    handleChartMouseUp,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  } = chartHandlers;

  const formattedCallsign = useMemo(() => {
    if (!flight?.callsign) return null;
    return parseCallsign(flight.callsign, airlines);
  }, [flight?.callsign, airlines]);

  useEffect(() => {
    if (
      sessionId &&
      flightId &&
      flight &&
      !dataLoading &&
      !notesInitializedRef.current
    ) {
      const storageKey = `acars-notes-${sessionId}-${flightId}`;
      const timestampKey = `acars-notes-timestamp-${sessionId}-${flightId}`;
      const savedNotes = localStorage.getItem(storageKey);
      const savedTimestamp = localStorage.getItem(timestampKey);
      const TWELVE_HOURS = 12 * 60 * 60 * 1000;
      const parsedTimestamp = savedTimestamp
        ? parseInt(savedTimestamp, 10)
        : null;
      const isExpired =
        parsedTimestamp &&
        !isNaN(parsedTimestamp) &&
        Date.now() - parsedTimestamp > TWELVE_HOURS;

      if (savedNotes && !isExpired) {
        setNotes(savedNotes);
      } else {
        if (isExpired) {
          localStorage.removeItem(storageKey);
          localStorage.removeItem(timestampKey);
        }

        const departureAirport = getAirportName(
          flight.departure || '',
          airports
        );
        const arrivalAirport = getAirportName(flight.arrival || '', airports);
        const formattedCallsign = parseCallsign(
          flight.callsign || '',
          airlines
        );

        const initialNotes = `FLIGHT PLAN DETAILS
════════════════════════════════════════

Callsign: ${flight.callsign} (${formattedCallsign})
Aircraft: ${flight.aircraft || 'N/A'}
Flight Type: ${flight.flight_type || 'N/A'}

Departure: ${flight.departure} - ${departureAirport}
Arrival: ${flight.arrival} - ${arrivalAirport}
${flight.alternate ? `Alternate: ${flight.alternate}` : ''}

Stand: ${flight.stand || 'N/A'}
${flight.gate ? `Gate: ${flight.gate}` : ''}
Runway: ${flight.runway || 'N/A'}

Cruising FL: ${flight.cruisingFL || 'N/A'}

Route: ${flight.route || 'N/A'}

════════════════════════════════════════
NOTES:


`;
        setNotes(initialNotes);
        localStorage.setItem(storageKey, initialNotes);
        localStorage.setItem(timestampKey, Date.now().toString());
      }

      notesInitializedRef.current = true;
    }
  }, [sessionId, flightId, flight, dataLoading, airports, airlines]);

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newNotes = e.target.value;
    setNotes(newNotes);
    if (sessionId && flightId) {
      const storageKey = `acars-notes-${sessionId}-${flightId}`;
      const timestampKey = `acars-notes-timestamp-${sessionId}-${flightId}`;
      localStorage.setItem(storageKey, newNotes);
      localStorage.setItem(timestampKey, Date.now().toString());
    }
  };

  const handleToggleSidebar = () => {
    if (showSidebar) {
      setShowSidebar(false);
    } else {
      setShowChartsDrawer(false);
      setShowSidebar(true);
    }
  };

  const handleToggleChartsDrawer = () => {
    if (showChartsDrawer) {
      setShowChartsDrawer(false);
    } else {
      setShowSidebar(false);
      setShowChartsDrawer(true);
    }
  };

  useEffect(() => {
    setChartZoom(1);
    setChartPan({ x: 0, y: 0 });
  }, [selectedChart]);

  useEffect(() => {
    if (initializedRef.current) return;
    const validateAndLoad = async () => {
      if (!sessionId || !flightId || !accessId) {
        setError('Missing required parameters');
        setLoading(false);
        return;
      }
      try {
        const validateResponse = await fetch(
          `${import.meta.env.VITE_SERVER_URL}/api/flights/${sessionId}/${flightId}/validate-acars?acars_token=${accessId}`,
          { credentials: 'include' }
        );
        if (!validateResponse.ok) throw new Error('Failed to validate access');
        const { valid, accessId: sessionAccess } =
          await validateResponse.json();
        if (!valid) throw new Error('Invalid access token');
        setSessionAccessId(sessionAccess);

        const sessionResponse = await fetch(
          `${import.meta.env.VITE_SERVER_URL}/api/sessions/${sessionId}/submit`,
          { credentials: 'include' }
        );
        if (sessionResponse.ok) {
          const sessionData = await sessionResponse.json();
          setSession(sessionData);
        }

        const flightResponse = await fetch(
          `${import.meta.env.VITE_SERVER_URL}/api/flights/${sessionId}/${flightId}/acars-flight?acars_token=${accessId}`
        );
        if (!flightResponse.ok) {
          throw new Error('Failed to load flight data');
        }
        const currentFlight: Flight = await flightResponse.json();
        if (!currentFlight || String(currentFlight.id) !== String(flightId)) {
          throw new Error('Flight not found');
        }
        setFlight(currentFlight);
        setLoading(false);
        await fetch(
          `${import.meta.env.VITE_SERVER_URL}/api/flights/acars/active`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              sessionId,
              flightId,
              acarsToken: accessId,
            }),
          }
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Access denied');
        setLoading(false);
      }
    };
    validateAndLoad();
  }, [sessionId, flightId, accessId]);

  useEffect(() => {
    if (!loading && !user && flight) {
      setShowAccountPrompt(true);
    }
  }, [loading, user, flight]);

  useEffect(() => {
    if (!sessionId || !flightId) return;
    const handleUnload = async () => {
      await fetch(
        `${import.meta.env.VITE_SERVER_URL}/api/flights/acars/active/${sessionId}/${flightId}`,
        {
          method: 'DELETE',
          credentials: 'include',
          keepalive: true,
        }
      );
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      handleUnload();
    };
  }, [sessionId, flightId]);

  useEffect(() => {
    if (!flight || dataLoading || initializedRef.current) return;
    const warningMsg: AcarsMessage = {
      id: `${Date.now()}-warning`,
      timestamp: new Date().toISOString(),
      station: 'SYSTEM',
      text: 'DO NOT CLOSE THIS WINDOW, CONTROLLERS MAY SEND PRE DEPARTURE CLEARANCES THROUGH THE ACARS TERMINAL',
      type: 'warning',
    };
    const successMsg: AcarsMessage = {
      id: `${Date.now()}-success`,
      timestamp: new Date().toISOString(),
      station: 'SYSTEM',
      text: `FLIGHT PLAN: ${flight.callsign} SUBMITTED SUCCESSFULLY`,
      type: 'Success',
    };
    const formattedCallsign = parseCallsign(flight.callsign || '', airlines);
    const departureAirport = getAirportName(flight.departure || '', airports);
    const arrivalAirport = getAirportName(flight.arrival || '', airports);
    const detailsMsg: AcarsMessage = {
      id: `${Date.now()}-details`,
      timestamp: new Date().toISOString(),
      station: 'SYSTEM',
      text: `FLIGHT PLAN DETAILS,\nCALLSIGN: ${flight.callsign} (${formattedCallsign}), \nTYPE: ${flight.aircraft},\nRULES: ${flight.flight_type},\nSTAND: ${flight.stand || 'N/A'},\nDEPARTING: ${departureAirport},\nARRIVING: ${arrivalAirport}`,
      type: 'system',
    };
    const initialMessages = [warningMsg, detailsMsg, successMsg];
    if (flight.pdc_remarks) {
      const pdcMsg: AcarsMessage = {
        id: `${Date.now()}-pdc-existing`,
        timestamp: new Date().toISOString(),
        station: `${flight.departure}_DEL`,
        text: flight.pdc_remarks,
        type: 'pdc',
      };
      initialMessages.push(pdcMsg);
    }
    setMessages(initialMessages);
    if (settings) playNotificationSound('warning', settings);
    initializedRef.current = true;
  }, [flight, dataLoading, airlines, airports, settings]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!sessionId || loading || !sessionAccessId) return;
    const socket = createFlightsSocket(
      sessionId,
      sessionAccessId,
      '',
      '',
      () => {},
      () => {},
      () => {}
    );
    socketRef.current = socket;
    socket.socket.on(
      'pdcIssued',
      (payload: {
        pdcText?: string;
        updatedFlight?: { pdc_remarks?: string };
        flightId: string | number;
      }) => {
        const pdcText = payload?.pdcText ?? payload?.updatedFlight?.pdc_remarks;
        if (pdcText && String(payload.flightId) === String(flightId)) {
          addPDCMessage(pdcText);
          if (settings) playNotificationSound('pdc', settings);
        }
      }
    );
    socket.socket.on(
      'contactMe',
      (payload: {
        flightId: string | number;
        message?: string;
        station?: string;
        position?: string;
      }) => {
        if (String(payload.flightId) === String(flightId)) {
          const station = payload.station || flight?.departure || 'UNKNOWN';
          const position = payload.position || 'TWR';
          const displayStation = station.includes('_CTR')
            ? station
            : `${station}_${position}`;

          const contactMsg: AcarsMessage = {
            id: `${Date.now()}-contact`,
            timestamp: new Date().toISOString(),
            station: displayStation,
            text: payload.message || 'CONTACT CONTROLLER ON FREQUENCY',
            type: 'contact',
          };
          setMessages((prev) => [...prev, contactMsg]);
          if (settings) playNotificationSound('contact', settings);
        }
      }
    );
    return () => {
      socket.socket.disconnect();
      socketRef.current = null;
    };
  }, [sessionId, flightId, loading, sessionAccessId, settings]);

  useEffect(() => {
    const overviewSocket = createOverviewSocket((data) => {
      setActiveSessions(data.activeSessions);
    });
    return () => {
      overviewSocket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (
      session &&
      flight &&
      user &&
      session.createdBy !== user.userId &&
      (settings?.acars?.autoRedirectToAcars ?? true)
    ) {
      setShowRating(true);
    }
  }, [session, flight, user, settings?.acars?.autoRedirectToAcars]);

  const addPDCMessage = (text: string) => {
    const message: AcarsMessage = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date().toISOString(),
      station: `${flight?.departure}_DEL`,
      text,
      type: 'pdc',
    };
    setMessages((prev) => [...prev, message]);
  };

  const handleRequestPDC = () => {
    if (!flight || !socketRef.current?.socket || pdcRequested) return;
    socketRef.current.socket.emit('requestPDC', {
      flightId: flight.id,
      callsign: flight.callsign,
      note: 'PDC requested via ACARS terminal',
    });
    const confirmMsg: AcarsMessage = {
      id: `${Date.now()}-pdc-request`,
      timestamp: new Date().toISOString(),
      station: 'SYSTEM',
      text: 'PDC REQUEST SENT TO CONTROLLERS',
      type: 'Success',
    };
    setMessages((prev) => [...prev, confirmMsg]);
    if (settings) playNotificationSound('system', settings);
    setPdcRequested(true);
  };

  const handleAtisClick = (session: OverviewSession) => {
    if (!session.atis?.text) return;
    const atisMsg: AcarsMessage = {
      id: `${Date.now()}-atis`,
      timestamp: new Date().toISOString(),
      station: `${session.airportIcao}_ATIS`,
      text: session.atis.text,
      type: 'atis',
    };
    setMessages((prev) => [...prev, atisMsg]);
    if (settings) playNotificationSound('atis', settings);
  };

  const getMessageColor = (type: AcarsMessage['type']) => {
    switch (type) {
      case 'warning':
        return 'text-red-400';
      case 'pdc':
        return 'text-cyan-400';
      case 'Success':
        return 'text-green-400';
      case 'system':
        return 'text-white';
      case 'contact':
        return 'text-orange-400';
      case 'atis':
        return 'text-blue-400';
      default:
        return 'text-white';
    }
  };

  const renderMessageText = (msg: AcarsMessage) => (
    <span className="whitespace-pre-wrap">
      {msg.text}
      {msg.link && (
        <a
          href={msg.link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyan-400 underline hover:text-cyan-300 cursor-pointer"
        >
          {msg.link.text}
        </a>
      )}
    </span>
  );

  const handleSnapUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !flightId) return;
    setSnapUploading(true);
    try {
      await uploadSnapImage(flightId, file);
      setMessages((prev) => [
        ...prev,
        {
          id: `snap-${Date.now()}`,
          timestamp: new Date().toISOString(),
          station: 'SYSTEM',
          text: '[CEPHIE SNAP] Photo uploaded successfully — ',
          type: 'Success' as AcarsMessage['type'],
          link: { text: 'View It Here', url: `/my-flights/${flightId}` },
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `snap-${Date.now()}`,
          timestamp: new Date().toISOString(),
          station: 'SYSTEM',
          text: '[CEPHIE SNAP] Upload failed — try again',
          type: 'warning' as AcarsMessage['type'],
        },
      ]);
    } finally {
      setSnapUploading(false);
      if (snapInputRef.current) snapInputRef.current.value = '';
    }
  };

  const acarsSettings = settings?.acars;

  const minSidebar = 10,
    maxSidebar = 40;
  const minTerminal = 20,
    maxTerminal = 80;
  const minNotes = 10,
    maxNotes = 60;

  let sidebarWidth = acarsSettings?.sidebarWidth ?? 30;
  let terminalWidth = acarsSettings?.terminalWidth ?? 50;
  let notesWidth = acarsSettings?.notesWidth ?? 20;
  const notesEnabled = acarsSettings?.notesEnabled ?? true;

  sidebarWidth = Math.max(minSidebar, Math.min(maxSidebar, sidebarWidth));
  if (notesEnabled) {
    notesWidth = Math.max(minNotes, Math.min(maxNotes, notesWidth));
  } else {
    notesWidth = 0;
  }

  if (!showSidebar) {
    sidebarWidth = 0;
  }

  const totalRequested = sidebarWidth + terminalWidth + notesWidth;
  if (notesEnabled) {
    if (totalRequested !== 100) {
      const remainder = 100 - sidebarWidth - terminalWidth;
      if (remainder >= minNotes) {
        notesWidth = remainder;
      } else {
        notesWidth = Math.max(minNotes, remainder);
        terminalWidth = 100 - sidebarWidth - notesWidth;
      }
    }
  } else {
    if (sidebarWidth + terminalWidth !== 100) {
      terminalWidth = 100 - sidebarWidth;
    }
  }

  terminalWidth = Math.max(minTerminal, Math.min(maxTerminal, terminalWidth));

  if (loading || dataLoading || settingsLoading) {
    return (
      <div className="min-h-screen bg-zinc-950">
        <Navbar />
        <div className="flex items-center justify-center h-screen">
          <Loader />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white">
        <Navbar />
        <div className="flex items-center justify-center h-screen">
          <div className="text-center max-w-md px-4">
            {isAuthError ? (
              <>
                <h1 className="text-3xl font-bold text-blue-500 mb-4">
                  Sign In Required
                </h1>
                <p className="text-zinc-300 mb-2 text-lg">
                  To use ACARS you have to sign in!
                </p>
                <p className="text-green-400 mb-6 text-sm">
                  Don't worry your flight plan was still submitted, but you will
                  not be able to use ACARS until you sign in.
                </p>
                <div className="flex gap-3 justify-center">
                  <Button
                    onClick={() => {
                      window.location.href = `/login?callback=${encodeURIComponent(`/acars/${sessionId}/${flightId}?acars_token=${accessId}`)}`;
                    }}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Sign In with Discord
                  </Button>
                  <Button onClick={() => navigate('/')} variant="outline">
                    Return Home
                  </Button>
                </div>
              </>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-red-500 mb-4">
                  Access Denied
                </h1>
                <p className="text-zinc-400 mb-6">{error}</p>
                <Button onClick={() => navigate('/')}>Return Home</Button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <Navbar />

      <div className="bg-gradient-to-b from-zinc-800 to-zinc-900 border-b border-zinc-700/50 py-8 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 pt-12">
          <div className="flex items-center gap-4">
            <PlaneTakeoff className="h-8 w-8 text-blue-500" />
            <h1 className="text-2xl font-bold text-white">
              {flight?.callsign
                ? formattedCallsign || flight.callsign
                : 'ACARS Terminal'}
            </h1>
            {flightId && (
              <div className="relative group ml-2">
                <input
                  ref={snapInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleSnapUpload}
                />
                <Button
                  size="sm"
                  onClick={() => snapInputRef.current?.click()}
                  disabled={snapUploading}
                  className="gap-2 bg-purple-600 hover:bg-purple-500 border-purple-500 text-white"
                >
                  {snapUploading ? (
                    <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  ) : (
                    <Camera className="w-5 h-5" />
                  )}
                  <span className="hidden sm:inline">
                    {snapUploading ? 'Uploading…' : 'Flight Photo'}
                  </span>
                </Button>
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 whitespace-nowrap">
                  <div className="relative p-px rounded-lg bg-linear-to-r from-zinc-500 to-zinc-700">
                    <div className="px-3 py-1 bg-zinc-900/90 backdrop-blur-md rounded-lg">
                      <span className="text-xs font-medium text-white">Upload a picture of your flight</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 mt-4 md:mt-0">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => navigate(`/submit/${sessionId}`)}
            >
              <PlusCircle className="w-5 h-5" />
              <span className="hidden sm:inline">New Flight</span>
            </Button>
            <Button size="sm" className="gap-2" onClick={handleToggleSidebar}>
              {showSidebar ? (
                <PanelLeftOpen className="w-5 h-5" />
              ) : (
                <PanelLeftClose className="w-5 h-5" />
              )}
              <span className="hidden sm:inline">
                {showSidebar ? 'Hide Sidebar' : 'Show Sidebar'}
              </span>
            </Button>
            <Button
              size="sm"
              className="gap-2"
              onClick={handleToggleChartsDrawer}
            >
              {showChartsDrawer ? (
                <PanelLeftClose className="w-5 h-5" />
              ) : (
                <Map className="w-5 h-5" />
              )}
              <span className="hidden sm:inline">
                {showChartsDrawer ? 'Hide Charts' : 'Show Charts'}
              </span>
            </Button>
          </div>
        </div>
      </div>

      {/* Controller Rating Popup */}
      {showRating && session?.createdBy && (
        <div className="max-w-3xl mx-auto px-4 pt-6">
          <ControllerRatingPopup
            controllerId={session.createdBy}
            flightId={flightId}
            onClose={() => setShowRating(false)}
            isInline={true}
          />
        </div>
      )}

      {/* Desktop Layout */}
      <div
        className="hidden md:flex gap-4 pt-4 px-6 pb-6"
        style={{ height: 'calc(100vh - 200px)' }}
      >
        {/* Sidebar */}
        {showSidebar && (
          <div
            style={{
              width: `${sidebarWidth}%`,
              minWidth: sidebarWidth === 0 ? 0 : 120,
            }}
            className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden transition-all duration-300"
          >
            <AcarsSidebar
              activeSessions={activeSessions}
              onAtisClick={handleAtisClick}
            />
          </div>
        )}

        {/* Terminal */}
        <div
          style={{
            width: `${terminalWidth}%`,
            minWidth: 200,
            transition: 'width 0.3s',
            flex: 'none',
          }}
          className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
        >
          <AcarsTerminal
            flightCallsign={flight?.callsign}
            messages={messages}
            getMessageColor={getMessageColor}
            renderMessageText={renderMessageText}
            messagesEndRef={messagesEndRef}
            handleRequestPDC={handleRequestPDC}
            pdcRequested={pdcRequested}
          />
        </div>

        {/* Notes */}
        {notesEnabled && (
          <div
            style={{
              width: `${notesWidth}%`,
              minWidth: 120,
              transition: 'width 0.3s',
              flex: 'none',
            }}
            className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
          >
            <AcarsNotePanel
              notes={notes}
              handleNotesChange={handleNotesChange}
            />
          </div>
        )}
      </div>

      {/* Mobile Layout */}
      <div className="md:hidden pt-4 px-2 pb-4">
        <div className="flex gap-2 mb-4">
          <button
            className={`flex-1 py-2 rounded-lg font-mono text-xs ${
              mobileTab === 'terminal'
                ? 'bg-blue-700 text-white'
                : 'bg-zinc-800 text-zinc-400'
            }`}
            onClick={() => setMobileTab('terminal')}
          >
            Terminal
          </button>
          <button
            className={`flex-1 py-2 rounded-lg font-mono text-xs ${
              mobileTab === 'notes'
                ? 'bg-blue-700 text-white'
                : 'bg-zinc-800 text-zinc-400'
            }`}
            onClick={() => setMobileTab('notes')}
          >
            Notes
          </button>
        </div>
        <div className="bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-800 overflow-hidden">
          {mobileTab === 'terminal' && (
            <AcarsTerminal
              flightCallsign={flight?.callsign}
              flightId={flightId}
              messages={messages}
              getMessageColor={getMessageColor}
              renderMessageText={renderMessageText}
              messagesEndRef={messagesEndRef}
              handleRequestPDC={handleRequestPDC}
              pdcRequested={pdcRequested}
              />
          )}
          {mobileTab === 'notes' && (
            <AcarsNotePanel
              notes={notes}
              handleNotesChange={handleNotesChange}
            />
          )}
          {mobileTab === 'charts' && (
            <ChartDrawer
              isOpen={true}
              onClose={() => {}}
              selectedChart={selectedChart}
              setSelectedChart={setSelectedChart}
              chartLoadError={chartLoadError}
              setChartLoadError={setChartLoadError}
              chartZoom={chartZoom}
              chartPan={chartPan}
              isChartDragging={isChartDragging}
              handleChartMouseDown={handleChartMouseDown}
              handleChartMouseMove={handleChartMouseMove}
              handleChartMouseUp={handleChartMouseUp}
              handleTouchStart={handleTouchStart}
              handleTouchMove={handleTouchMove}
              handleTouchEnd={handleTouchEnd}
              handleZoomIn={handleZoomIn}
              handleZoomOut={handleZoomOut}
              handleResetZoom={handleResetZoom}
              getChartsForAirport={getChartsForAirport}
              containerRef={containerRef as React.RefObject<HTMLDivElement>}
              setImageSize={setImageSize}
              airports={airports}
              settings={settings}
              departureAirport={flight?.departure}
              arrivalAirport={flight?.arrival}
            />
          )}
        </div>
      </div>

      <ChartDrawer
        isOpen={showChartsDrawer}
        onClose={() => setShowChartsDrawer(false)}
        selectedChart={selectedChart}
        setSelectedChart={setSelectedChart}
        chartLoadError={chartLoadError}
        setChartLoadError={setChartLoadError}
        chartZoom={chartZoom}
        chartPan={chartPan}
        isChartDragging={isChartDragging}
        handleChartMouseDown={handleChartMouseDown}
        handleChartMouseMove={handleChartMouseMove}
        handleChartMouseUp={handleChartMouseUp}
        handleTouchStart={handleTouchStart}
        handleTouchMove={handleTouchMove}
        handleTouchEnd={handleTouchEnd}
        handleZoomIn={handleZoomIn}
        handleZoomOut={handleZoomOut}
        handleResetZoom={handleResetZoom}
        getChartsForAirport={getChartsForAirport}
        containerRef={containerRef as React.RefObject<HTMLDivElement>}
        setImageSize={setImageSize}
        airports={airports}
        settings={settings}
        departureAirport={flight?.departure}
        arrivalAirport={flight?.arrival}
      />
      {!user && (
        <Modal
          isOpen={showAccountPrompt}
          onClose={() => setShowAccountPrompt(false)}
          title="Secure this flight to your account"
          variant="primary"
          footer={
            <>
              <Button
                onClick={() => {
                  const callback =
                    sessionId && flight?.id && accessId
                      ? `/my-flights?claimSessionId=${encodeURIComponent(sessionId)}&claimFlightId=${encodeURIComponent(String(flight.id))}&claimToken=${encodeURIComponent(accessId)}`
                      : '/my-flights';
                  window.location.href = getDiscordLoginUrl(callback);
                }}
              >
                Create Account Now
              </Button>
              <Button variant="outline" onClick={() => setShowAccountPrompt(false)}>
                Skip for now
              </Button>
            </>
          }
        >
          <p className="text-gray-300">
            Keep flying as a guest, but creating an account now will immediately
            attach this ACARS flight to your profile and unlock My Flights.
          </p>
        </Modal>
      )}
    </div>
  );
}
