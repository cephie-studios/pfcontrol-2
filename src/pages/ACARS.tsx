import { useState, useRef, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Loader from '../components/common/Loader';
import Button from '../components/common/Button';
import { PanelsTopLeft, Terminal } from 'lucide-react';
import { useData } from '../hooks/data/useData';
import { useSettings } from '../hooks/settings/useSettings';
import { createFlightsSocket } from '../sockets/flightsSocket';
import {
  createOverviewSocket,
  type OverviewSession,
} from '../sockets/overviewSocket';
import { getAirportName, parseCallsign } from '../utils/callsignParser';
import { getChartsForAirport, playNotificationSound } from '../utils/acars';
import type { AcarsMessage } from '../types/acars';
import type { Flight } from '../types/flight';

import AcarsSidebar from '../components/acars/AcarsSidebar';
import AcarsTerminal from '../components/acars/AcarsTerminal';
import AcarsNotesPanel from '../components/acars/AcarsNotesPanel';
import AcarsChartsPanel from '../components/acars/AcarsChartsPanel';

export default function ACARS() {
  const { sessionId, flightId } = useParams<{
    sessionId: string;
    flightId: string;
  }>();
  const [searchParams] = useSearchParams();
  const accessId = searchParams.get('acars_token');
  const navigate = useNavigate();
  const { airports, airlines, loading: dataLoading } = useData();
  const { settings, loading: settingsLoading } = useSettings();
  const [loading, setLoading] = useState(true);
  const [flight, setFlight] = useState<Flight | null>(null);
  const [messages, setMessages] = useState<AcarsMessage[]>([]);
  const [activeSessions, setActiveSessions] = useState<OverviewSession[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isAuthError, setIsAuthError] = useState(false);
  const [pdcRequested, setPdcRequested] = useState(false);
  const [sessionAccessId, setSessionAccessId] = useState<string | null>(null);
  const [notes, setNotes] = useState<string>('');
  const [terminalWidth, setTerminalWidth] = useState(50);
  const [notesWidth, setNotesWidth] = useState(20);
  const [selectedChart, setSelectedChart] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<'terminal' | 'notes' | null>(
    null
  );
  const [chartLoadError, setChartLoadError] = useState(false);
  const [chartZoom, setChartZoom] = useState(1);
  const [chartPan, setChartPan] = useState({ x: 0, y: 0 });
  const [isChartDragging, setIsChartDragging] = useState(false);
  const [chartDragStart, setChartDragStart] = useState({ x: 0, y: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [showSidebar, setShowSidebar] = useState(() => {
    const saved = localStorage.getItem('acars-sidebar-visible');
    return saved !== null ? saved === 'true' : true;
  });
  const [mobileTab, setMobileTab] = useState<'terminal' | 'notes' | 'charts'>(
    'terminal'
  );

  const socketRef = useRef<ReturnType<typeof createFlightsSocket> | null>(null);
  const initializedRef = useRef(false);
  const notesInitializedRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (settings?.acars) {
      setTerminalWidth(settings.acars.terminalWidth);
      setNotesWidth(settings.acars.notesWidth);
    }
  }, [settings]);

  useEffect(() => {
    if (
      sessionId &&
      flightId &&
      flight &&
      !dataLoading &&
      !notesInitializedRef.current
    ) {
      const storageKey = `acars-notes-${sessionId}-${flightId}`;
      const savedNotes = localStorage.getItem(storageKey);

      if (savedNotes) {
        setNotes(savedNotes);
      } else {
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
═══════════════════════════════════════

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

═══════════════════════════════════════
NOTES:


`;
        setNotes(initialNotes);
        localStorage.setItem(storageKey, initialNotes);
      }

      notesInitializedRef.current = true;

      return () => {
        localStorage.removeItem(storageKey);
      };
    }
  }, [sessionId, flightId, flight, dataLoading, airports, airlines]);

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newNotes = e.target.value;
    setNotes(newNotes);
    if (sessionId && flightId) {
      const storageKey = `acars-notes-${sessionId}-${flightId}`;
      localStorage.setItem(storageKey, newNotes);
    }
  };

  const handleMouseDown = (divider: 'terminal' | 'notes') => {
    setIsDragging(divider);
  };

  const MIN_TERMINAL_WIDTH = 25;
  const MIN_NOTES_WIDTH = 15;
  const MIN_CHARTS_WIDTH = 15;

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const container = e.currentTarget as HTMLElement;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = (x / rect.width) * 100;

    if (isDragging === 'terminal') {
      const minChartsWidth = settings?.acars?.notesEnabled
        ? MIN_CHARTS_WIDTH
        : 10;
      const maxTerminalWidth = 100 - notesWidth - minChartsWidth;
      const newTerminalWidth = Math.max(
        MIN_TERMINAL_WIDTH,
        Math.min(percentage, maxTerminalWidth)
      );
      setTerminalWidth(newTerminalWidth);
      if (notesWidth > 100 - newTerminalWidth - minChartsWidth) {
        setNotesWidth(100 - newTerminalWidth - minChartsWidth);
      }
    } else if (isDragging === 'notes') {
      const maxNotesWidth = 100 - terminalWidth - MIN_CHARTS_WIDTH;
      const newNotesWidth = Math.max(
        MIN_NOTES_WIDTH,
        Math.min(percentage - terminalWidth, maxNotesWidth)
      );
      setNotesWidth(newNotesWidth);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(null);
  };

  useEffect(() => {
    if (isDragging) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  }, [isDragging]);

  const handleChartMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsChartDragging(true);
    setChartDragStart({
      x: e.clientX - chartPan.x,
      y: e.clientY - chartPan.y,
    });
  };

  const handleChartMouseMove = (e: React.MouseEvent) => {
    if (
      !isChartDragging ||
      !containerRef.current ||
      imageSize.width === 0 ||
      imageSize.height === 0
    )
      return;
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const containerWidth = rect.width;
    const containerHeight = rect.height;
    const scaledWidth = imageSize.width * chartZoom;
    const scaledHeight = imageSize.height * chartZoom;
    const maxPanX = Math.max(0, (scaledWidth - containerWidth) / 2);
    const maxPanY = Math.max(0, (scaledHeight - containerHeight) / 2);
    const newX = e.clientX - chartDragStart.x;
    const newY = e.clientY - chartDragStart.y;
    setChartPan({
      x: Math.max(-maxPanX, Math.min(maxPanX, newX)),
      y: Math.max(-maxPanY, Math.min(maxPanY, newY)),
    });
  };

  const handleChartMouseUp = () => {
    setIsChartDragging(false);
  };

  const handleZoomIn = () => setChartZoom((prev) => Math.min(5, prev + 0.25));
  const handleZoomOut = () =>
    setChartZoom((prev) => Math.max(0.5, prev - 0.25));
  const handleResetZoom = () => {
    setChartZoom(1);
    setChartPan({ x: 0, y: 0 });
  };

  const handleToggleSidebar = () => {
    setShowSidebar((prev) => {
      const newValue = !prev;
      localStorage.setItem('acars-sidebar-visible', String(newValue));
      return newValue;
    });
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
        const flightResponse = await fetch(
          `${import.meta.env.VITE_SERVER_URL}/api/flights/${sessionId}`,
          { credentials: 'include' }
        );
        if (!flightResponse.ok) {
          if (flightResponse.status === 401) {
            setIsAuthError(true);
            throw new Error('Authentication required');
          }
          throw new Error('Failed to load flight data');
        }
        const flights: Flight[] = await flightResponse.json();
        const currentFlight = flights.find(
          (f) => String(f.id) === String(flightId)
        );
        if (!currentFlight) throw new Error('Flight not found');
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
      () => {},
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
      (payload: { flightId: string | number; message?: string }) => {
        if (String(payload.flightId) === String(flightId)) {
          const contactMsg: AcarsMessage = {
            id: `${Date.now()}-contact`,
            timestamp: new Date().toISOString(),
            station: `${flight?.departure}_TWR`,
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
                    onClick={() =>
                      (window.location.href = `${import.meta.env.VITE_SERVER_URL}/api/auth/discord`)
                    }
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

      {/* Desktop Layout */}
      <div
        className="hidden md:flex pt-20 px-6 pb-6"
        style={{ height: 'calc(105vh - 80px)' }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          style={{ width: `${terminalWidth}%`, height: '100%' }}
          className="flex-shrink-0 flex flex-col"
        >
          {/* Terminal panel content */}
          <div className="bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden border border-zinc-800 flex flex-col h-full">
            <div className="bg-gradient-to-r from-zinc-800 to-zinc-900 px-4 py-3 border-b border-zinc-700">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleToggleSidebar}
                  className="p-1 hover:bg-zinc-700 rounded transition-colors"
                  title={showSidebar ? 'Hide sidebar' : 'Show sidebar'}
                >
                  <PanelsTopLeft className="w-4 h-4 text-zinc-400" />
                </button>
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-mono text-zinc-300">
                    {flight?.callsign
                      ? `${flight.callsign} - ACARS Terminal`
                      : 'ACARS Terminal'}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-1 min-h-0 h-full">
              {showSidebar && (
                <AcarsSidebar
                  activeSessions={activeSessions}
                  onAtisClick={handleAtisClick}
                />
              )}
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
          </div>
        </div>

        {/* Divider between terminal and notes (only if notes enabled) */}
        {settings?.acars?.notesEnabled && (
          <div
            className="w-1 bg-zinc-800 hover:bg-blue-500 cursor-col-resize transition-colors mx-2"
            onMouseDown={() => handleMouseDown('terminal')}
            style={{ height: '100%' }}
          />
        )}

        {/* Notes panel (only if notes enabled) */}
        {settings?.acars?.notesEnabled && (
          <div
            style={
              settings?.acars?.chartsEnabled
                ? { width: `${notesWidth}%`, height: '100%' }
                : { height: '100%' }
            }
            className={`flex flex-col ${settings?.acars?.chartsEnabled ? 'flex-shrink-0' : 'flex-1'}`}
          >
            <AcarsNotesPanel
              notes={notes}
              handleNotesChange={handleNotesChange}
            />
          </div>
        )}

        {/* Divider between notes and charts (only if notes and charts enabled) */}
        {settings?.acars?.notesEnabled && settings?.acars?.chartsEnabled && (
          <div
            className="w-1 bg-zinc-800 hover:bg-purple-500 cursor-col-resize transition-colors mx-2"
            onMouseDown={() => handleMouseDown('notes')}
            style={{ height: '100%' }}
          />
        )}

        {/* Divider between terminal and charts (only if notes disabled and charts enabled) */}
        {!settings?.acars?.notesEnabled && settings?.acars?.chartsEnabled && (
          <div
            className="w-1 bg-zinc-800 hover:bg-purple-500 cursor-col-resize transition-colors mx-2"
            onMouseDown={() => handleMouseDown('terminal')}
            style={{ height: '100%' }}
          />
        )}

        {/* Charts panel (only if charts enabled) */}
        {settings?.acars?.chartsEnabled && (
          <div
            className="flex-1 min-w-0 flex flex-col"
            style={{ height: '100%' }}
          >
            <AcarsChartsPanel
              flight={flight!}
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
              handleZoomIn={handleZoomIn}
              handleZoomOut={handleZoomOut}
              handleResetZoom={handleResetZoom}
              getChartsForAirport={getChartsForAirport}
              containerRef={containerRef}
              setImageSize={setImageSize}
            />
          </div>
        )}
      </div>

      {/* Mobile Layout */}
      <div className="md:hidden pt-20 px-2 pb-4">
        <div className="flex gap-2 mb-2">
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
          {settings?.acars?.notesEnabled && (
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
          )}
          {settings?.acars?.chartsEnabled && (
            <button
              className={`flex-1 py-2 rounded-lg font-mono text-xs ${
                mobileTab === 'charts'
                  ? 'bg-blue-700 text-white'
                  : 'bg-zinc-800 text-zinc-400'
              }`}
              onClick={() => setMobileTab('charts')}
            >
              Charts
            </button>
          )}
        </div>
        <div className="bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-800 overflow-hidden">
          {mobileTab === 'terminal' && (
            <AcarsTerminal
              flightCallsign={flight?.callsign}
              messages={messages}
              getMessageColor={getMessageColor}
              renderMessageText={renderMessageText}
              messagesEndRef={messagesEndRef}
              handleRequestPDC={handleRequestPDC}
              pdcRequested={pdcRequested}
            />
          )}
          {mobileTab === 'notes' && settings?.acars?.notesEnabled && (
            <AcarsNotesPanel
              notes={notes}
              handleNotesChange={handleNotesChange}
            />
          )}
          {mobileTab === 'charts' && settings?.acars?.chartsEnabled && (
            <AcarsChartsPanel
              flight={flight!}
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
              handleZoomIn={handleZoomIn}
              handleZoomOut={handleZoomOut}
              handleResetZoom={handleResetZoom}
              getChartsForAirport={getChartsForAirport}
            />
          )}
        </div>
      </div>
    </div>
  );
}
