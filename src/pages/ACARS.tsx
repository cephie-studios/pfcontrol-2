import { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Menu, Terminal } from 'lucide-react';
import Navbar from '../components/Navbar';
import Loader from '../components/common/Loader';
import Button from '../components/common/Button';
import { createFlightsSocket } from '../sockets/flightsSocket';
import { createOverviewSocket } from '../sockets/overviewSocket';
import { useData } from '../hooks/data/useData';
import { useAuth } from '../hooks/auth/useAuth';
import { useSettings } from '../hooks/settings/useSettings';
import { parseCallsign, getAirportName } from '../utils/callsignParser';
import type { Flight } from '../types/flight';
import type { OverviewSession } from '../sockets/overviewSocket';
import AcarsTerminal from '../components/acars/AcarsTerminal';
import AcarsNote from '../components/acars/AcarsNote';
import AcarsCharts from '../components/acars/AcarsCharts';
import AcarsSidebar from '../components/acars/AcarsSidebar';
import AcarsMobileDrawer from '../components/acars/AcarsMobileDrawer';
import AcarsMobileTabs from '../components/acars/AcarsMobileTabs';
import { type AcarsMessage, playNotificationSound } from '../utils/acars';

export default function ACARS() {
    const { sessionId, flightId } = useParams<{
        sessionId: string;
        flightId: string;
    }>();
    const [searchParams] = useSearchParams();
    const accessId = searchParams.get('accessId');
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
    const { user } = useAuth();
    const [notes, setNotes] = useState<string>('');
    const [terminalWidth, setTerminalWidth] = useState(50);
    const [notesWidth, setNotesWidth] = useState(20);
    const [selectedChart, setSelectedChart] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState<
        'terminal' | 'notes' | 'chartList' | null
    >(null);
    const [chartLoadError, setChartLoadError] = useState(false);
    const [chartZoom, setChartZoom] = useState(1);
    const [chartPan, setChartPan] = useState({ x: 0, y: 0 });
    const [isChartDragging, setIsChartDragging] = useState(false);
    const [chartDragStart, setChartDragStart] = useState({ x: 0, y: 0 });
    const [isChartFullscreen, setIsChartFullscreen] = useState(false);
    const [chartListWidth, setChartListWidth] = useState(256);
    const [showSidebar, setShowSidebar] = useState(() => {
        const saved = localStorage.getItem('acars-sidebar-visible');
        return saved !== null ? saved === 'true' : true;
    });
    const [mobileTab, setMobileTab] = useState<'terminal' | 'notes' | 'charts'>(
        'terminal'
    );
    const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

    const socketRef = useRef<ReturnType<typeof createFlightsSocket> | null>(
        null
    );
    const initializedRef = useRef(false);
    const notesInitializedRef = useRef(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chartContainerRef = useRef<HTMLDivElement | null>(null);
    const chartViewRef = useRef<HTMLDivElement | null>(null);

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
                const arrivalAirport = getAirportName(
                    flight.arrival || '',
                    airports
                );
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

Cruising FL: ${flight.cruisingFL || flight.cruisingFL || 'N/A'}

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

    const handleMouseDown = (divider: 'terminal' | 'notes' | 'chartList') => {
        setIsDragging(divider);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;

        if (isDragging === 'chartList') {
            return;
        }

        const container = e.currentTarget as HTMLElement;
        const rect = container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = (x / rect.width) * 100;

        if (isDragging === 'terminal') {
            const newTerminalWidth = Math.max(20, Math.min(80, percentage));
            setTerminalWidth(newTerminalWidth);
        } else if (isDragging === 'notes') {
            const newNotesWidth = Math.max(
                10,
                Math.min(50, percentage - terminalWidth)
            );
            setNotesWidth(newNotesWidth);
        }
    };

    const handleChartListMouseMove = (e: React.MouseEvent) => {
        if (isDragging !== 'chartList') return;

        const chartContainer = e.currentTarget as HTMLElement;
        const rect = chartContainer.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const newWidth = Math.max(150, Math.min(600, x));
        setChartListWidth(newWidth);
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

    type ChartPointerEvent =
        | React.MouseEvent<Element, MouseEvent>
        | React.TouchEvent<Element>;

    const handleChartMouseDown = (e: ChartPointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        let clientX: number, clientY: number;
        if ('touches' in e) {
            if (e.touches.length === 0) return;
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            if (e.button !== 0) return;
            clientX = e.clientX;
            clientY = e.clientY;
        }
        setIsChartDragging(true);
        setChartDragStart({
            x: clientX - chartPan.x,
            y: clientY - chartPan.y,
        });
    };

    const handleChartMouseMove = (e: ChartPointerEvent) => {
        if (!isChartDragging) return;
        e.preventDefault();
        e.stopPropagation();
        let clientX: number, clientY: number;
        if ('touches' in e) {
            if (e.touches.length === 0) return;
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }
        setChartPan({
            x: clientX - chartDragStart.x,
            y: clientY - chartDragStart.y,
        });
    };

    const handleChartMouseUp = (e?: ChartPointerEvent) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        setIsChartDragging(false);
    };

    const handleZoomIn = () => {
        setChartZoom((prev) => Math.min(5, prev + 0.25));
    };

    const handleZoomOut = () => {
        setChartZoom((prev) => Math.max(0.5, prev - 0.25));
    };

    const handleResetZoom = () => {
        setChartZoom(1);
        setChartPan({ x: 0, y: 0 });
    };

    const handleToggleFullscreen = () => {
        if (!chartContainerRef.current) return;

        if (!document.fullscreenElement) {
            chartContainerRef.current
                .requestFullscreen()
                .then(() => {
                    setIsChartFullscreen(true);
                })
                .catch((err) => {
                    console.error(
                        'Error attempting to enable fullscreen:',
                        err
                    );
                });
        } else {
            document.exitFullscreen().then(() => {
                setIsChartFullscreen(false);
            });
        }
    };

    const handleToggleSidebar = () => {
        setShowSidebar((prev) => {
            const newValue = !prev;
            localStorage.setItem('acars-sidebar-visible', String(newValue));
            return newValue;
        });
    };

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsChartFullscreen(!!document.fullscreenElement);
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => {
            document.removeEventListener(
                'fullscreenchange',
                handleFullscreenChange
            );
        };
    }, []);

    useEffect(() => {
        setChartZoom(1);
        setChartPan({ x: 0, y: 0 });
    }, [selectedChart]);

    useEffect(() => {
        const chartView = chartViewRef.current;
        if (!chartView) return;

        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            setChartZoom((prev) => Math.max(0.5, Math.min(5, prev + delta)));
        };

        chartView.addEventListener('wheel', handleWheel, { passive: false });

        return () => {
            chartView.removeEventListener('wheel', handleWheel);
        };
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
                    `${import.meta.env.VITE_SERVER_URL}/api/flights/${sessionId}/${flightId}/validate-acars?accessId=${accessId}`,
                    { credentials: 'include' }
                );

                if (!validateResponse.ok) {
                    throw new Error('Failed to validate access');
                }

                const { valid, accessId: sessionAccess } =
                    await validateResponse.json();
                if (!valid) {
                    throw new Error('Invalid access token');
                }

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

                if (!currentFlight) {
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

        const initializeMessages = async () => {
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

            const formattedCallsign = parseCallsign(
                flight.callsign || '',
                airlines
            );
            const departureAirport = getAirportName(
                flight.departure || '',
                airports
            );
            const arrivalAirport = getAirportName(
                flight.arrival || '',
                airports
            );

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

            if (flight.callsign) {
                try {
                    const trackingResponse = await fetch(
                        `${import.meta.env.VITE_SERVER_URL}/api/logbook/check-tracking/${flight.callsign}`
                    );
                    if (trackingResponse.ok) {
                        const trackingData = await trackingResponse.json();
                        if (trackingData.isTracked && trackingData.shareToken) {
                            const logbookMsg: AcarsMessage = {
                                id: `${Date.now()}-logbook`,
                                timestamp: new Date().toISOString(),
                                station: 'PFCONTROL',
                                text: `FLIGHT TRACKING ACTIVE - VIEW LIVE TELEMETRY `,
                                type: 'pdc',
                                link: {
                                    text: 'HERE',
                                    url: `${window.location.origin}/flight/${trackingData.shareToken}`,
                                },
                            };
                            initialMessages.push(logbookMsg);
                        }
                    }
                } catch {
                    // Ignore errors
                }
            }

            setMessages(initialMessages);
            if (settings) playNotificationSound('warning', settings);
            initializedRef.current = true;
        };

        initializeMessages();
    }, [flight, dataLoading, airlines, airports, settings]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (!sessionId || loading || !sessionAccessId) {
            return;
        }

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
                const pdcText =
                    payload?.pdcText ?? payload?.updatedFlight?.pdc_remarks;
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
                        text:
                            payload.message ||
                            'CONTACT CONTROLLER ON FREQUENCY',
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
        if (settings) {
            playNotificationSound('system', settings);
        }
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
        if (settings) {
            playNotificationSound('atis', settings);
        }
    };

    const renderMessageText = (msg: AcarsMessage) => {
        return (
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
    };

    if (loading || dataLoading || settingsLoading) {
        return (
            <div className="min-h-screen bg-gray-950">
                <Navbar />
                <div className="flex items-center justify-center h-screen">
                    <Loader />
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-950 text-white">
                <Navbar />
                <div className="flex items-center justify-center h-screen">
                    <div className="text-center max-w-md px-4">
                        {isAuthError ? (
                            <>
                                <h1 className="text-3xl font-bold text-blue-500 mb-4">
                                    Sign In Required
                                </h1>
                                <p className="text-gray-300 mb-2 text-lg">
                                    To use ACARS you have to sign in!
                                </p>
                                <p className="text-green-400 mb-6 text-sm">
                                    Don't worry your flight plan was still
                                    submitted, but you will not be able to use
                                    ACARS until you sign in.
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
                                    <Button
                                        onClick={() => navigate('/')}
                                        variant="outline"
                                    >
                                        Return Home
                                    </Button>
                                </div>
                            </>
                        ) : (
                            <>
                                <h1 className="text-2xl font-bold text-red-500 mb-4">
                                    Access Denied
                                </h1>
                                <p className="text-gray-400 mb-6">{error}</p>
                                <Button onClick={() => navigate('/')}>
                                    Return Home
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-950 text-white">
            <Navbar />

            {/* Desktop Layout */}
            <div
                className="hidden md:flex pt-20 px-6 pb-6"
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
                <div
                    style={{ width: `${terminalWidth}%` }}
                    className="flex-shrink-0"
                >
                    <div className="bg-gray-900 rounded-2xl shadow-2xl overflow-hidden border border-gray-800">
                        <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-4 py-3 border-b border-gray-700">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handleToggleSidebar}
                                    className="p-1 hover:bg-gray-700 rounded transition-colors"
                                    title={
                                        showSidebar
                                            ? 'Hide sidebar'
                                            : 'Show sidebar'
                                    }
                                >
                                    {showSidebar ? (
                                        <ChevronLeft className="w-4 h-4 text-gray-400" />
                                    ) : (
                                        <ChevronRight className="w-4 h-4 text-gray-400" />
                                    )}
                                </button>
                                <div className="flex items-center gap-2">
                                    <Terminal className="w-4 h-4 text-green-500" />
                                    <span className="text-sm font-mono text-gray-300">
                                        {flight?.callsign
                                            ? `${flight.callsign} - ACARS Terminal`
                                            : 'ACARS Terminal'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div
                            className="flex"
                            style={{ height: 'calc(100vh - 200px)' }}
                        >
                            {showSidebar && user && (
                                <AcarsSidebar
                                    activeSessions={activeSessions}
                                    user={user}
                                    onAtisClick={handleAtisClick}
                                />
                            )}

                            <AcarsTerminal
                                flight={flight}
                                messages={messages}
                                messagesEndRef={messagesEndRef}
                                renderMessageText={renderMessageText}
                                onRequestPDC={handleRequestPDC}
                                pdcRequested={pdcRequested}
                                airlines={airlines}
                            />
                        </div>
                    </div>
                </div>

                {settings?.acars?.notesEnabled &&
                    settings?.acars?.chartsEnabled && (
                        <>
                            <div
                                className="w-1 bg-gray-800 hover:bg-blue-500 cursor-col-resize transition-colors mx-2"
                                onMouseDown={() => handleMouseDown('terminal')}
                            />

                            <div
                                style={{ width: `${notesWidth}%` }}
                                className="flex-shrink-0"
                            >
                                <AcarsNote
                                    notes={notes}
                                    onNotesChange={handleNotesChange}
                                />
                            </div>

                            <div
                                className="w-1 bg-gray-800 hover:bg-blue-500 cursor-col-resize transition-colors mx-2"
                                onMouseDown={() => handleMouseDown('notes')}
                            />

                            <div className="flex-1 min-w-0">
                                <AcarsCharts
                                    flight={flight}
                                    selectedChart={selectedChart}
                                    chartZoom={chartZoom}
                                    chartPan={chartPan}
                                    isChartFullscreen={isChartFullscreen}
                                    chartLoadError={chartLoadError}
                                    chartListWidth={chartListWidth}
                                    onSelectChart={setSelectedChart}
                                    onZoomIn={handleZoomIn}
                                    onZoomOut={handleZoomOut}
                                    onResetZoom={handleResetZoom}
                                    onToggleFullscreen={handleToggleFullscreen}
                                    onChartListMouseMove={handleChartListMouseMove}
                                    onMouseUp={handleMouseUp}
                                    onChartMouseDown={handleChartMouseDown}
                                    onChartMouseMove={handleChartMouseMove}
                                    onChartMouseUp={handleChartMouseUp}
                                    isChartDragging={isChartDragging}
                                    chartContainerRef={chartContainerRef}
                                    chartViewRef={chartViewRef}
                                    onMouseDown={handleMouseDown}
                                />
                            </div>
                        </>
                    )}

                {settings?.acars?.notesEnabled &&
                    !settings?.acars?.chartsEnabled && (
                        <>
                            <div
                                className="w-1 bg-gray-800 hover:bg-blue-500 cursor-col-resize transition-colors mx-2"
                                onMouseDown={() => handleMouseDown('terminal')}
                            />

                            <AcarsNote
                                notes={notes}
                                onNotesChange={handleNotesChange}
                            />
                        </>
                    )}

                {!settings?.acars?.notesEnabled &&
                    settings?.acars?.chartsEnabled && (
                        <>
                            <div
                                className="w-1 bg-gray-800 hover:bg-purple-500 cursor-col-resize transition-colors mx-2"
                                onMouseDown={() => handleMouseDown('terminal')}
                            />

                            <div className="flex-1 min-w-0">
                                <AcarsCharts
                                    flight={flight}
                                    selectedChart={selectedChart}
                                    chartZoom={chartZoom}
                                    chartPan={chartPan}
                                    isChartFullscreen={isChartFullscreen}
                                    chartLoadError={chartLoadError}
                                    chartListWidth={chartListWidth}
                                    onSelectChart={setSelectedChart}
                                    onZoomIn={handleZoomIn}
                                    onZoomOut={handleZoomOut}
                                    onResetZoom={handleResetZoom}
                                    onToggleFullscreen={handleToggleFullscreen}
                                    onChartListMouseMove={handleChartListMouseMove}
                                    onMouseUp={handleMouseUp}
                                    onChartMouseDown={handleChartMouseDown}
                                    onChartMouseMove={handleChartMouseMove}
                                    onChartMouseUp={handleChartMouseUp}
                                    isChartDragging={isChartDragging}
                                    chartContainerRef={chartContainerRef}
                                    chartViewRef={chartViewRef}
                                    onMouseDown={handleMouseDown}
                                />
                            </div>
                        </>
                    )}
            </div>

            {/* Mobile Layout */}
            <div className="md:hidden pt-20 px-4 pb-4">
                <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
                    <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-4 py-3 border-b border-gray-700">
                        <div className="flex items-center gap-2">
                            <Terminal className="w-4 h-4 text-green-500" />
                            <span className="text-sm font-mono text-gray-300">
                                {flight?.callsign || 'ACARS'}
                            </span>
                        </div>
                        <button
                            onClick={() => setIsMobileDrawerOpen(true)}
                            className="p-2 hover:bg-gray-700 rounded transition-colors"
                            title="Open Controllers/ATIS"
                        >
                            <Menu className="w-5 h-5 text-gray-400" />
                        </button>
                    </div>

                    <AcarsMobileTabs
                        mobileTab={mobileTab}
                        setMobileTab={setMobileTab}
                        flight={flight}
                        messages={messages}
                        notes={notes}
                        selectedChart={selectedChart}
                        chartZoom={chartZoom}
                        chartPan={chartPan}
                        chartLoadError={chartLoadError}
                        pdcRequested={pdcRequested}
                        onNotesChange={handleNotesChange}
                        onRequestPDC={handleRequestPDC}
                        onSelectChart={setSelectedChart}
                        onZoomIn={handleZoomIn}
                        onZoomOut={handleZoomOut}
                        onResetZoom={handleResetZoom}
                        onChartMouseDown={handleChartMouseDown}
                        onChartMouseMove={handleChartMouseMove}
                        onChartMouseUp={handleChartMouseUp}
                        messagesEndRef={messagesEndRef}
                        isChartDragging={isChartDragging}
                    />
                </div>

                <AcarsMobileDrawer
                    isOpen={isMobileDrawerOpen}
                    onClose={() => setIsMobileDrawerOpen(false)}
                    activeSessions={activeSessions}
                    onAtisClick={(session) => {
                        handleAtisClick(session);
                        setMobileTab('terminal');
                    }}
                />
            </div>
        </div>
    );
}
