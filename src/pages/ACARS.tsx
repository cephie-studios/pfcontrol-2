import { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Terminal, User, Radio, StickyNote, Map, ZoomIn, ZoomOut, Maximize, Minimize, ChevronLeft, ChevronRight, Menu } from 'lucide-react';
import Navbar from '../components/Navbar';
import Loader from '../components/common/Loader';
import Button from '../components/common/Button';
import { createFlightsSocket } from '../sockets/flightsSocket';
import { createOverviewSocket } from '../sockets/overviewSocket';
import { useData } from '../hooks/data/useData';
import { useSettings } from '../hooks/settings/useSettings';
import { linearToLogVolume, playAudioWithGain } from '../utils/playSound';
import { parseCallsign, getAirportName } from '../utils/callsignParser';
import type { Flight } from '../types/flight';
import type { OverviewSession } from '../sockets/overviewSocket';

interface AcarsMessage {
    id: string;
    timestamp: string;
    station: string;
    text: string;
    type: 'system' | 'pdc' | 'atis' | 'contact' | 'warning' | 'Success';
    link?: {
        text: string;
        url: string;
    };
}

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
    const [notes, setNotes] = useState<string>('');
    const [terminalWidth, setTerminalWidth] = useState(50);
    const [notesWidth, setNotesWidth] = useState(20);
    const [selectedChart, setSelectedChart] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState<'terminal' | 'notes' | 'chartList' | null>(null);
    const [chartLoadError, setChartLoadError] = useState(false);
    const [chartZoom, setChartZoom] = useState(1);
    const [chartPan, setChartPan] = useState({ x: 0, y: 0 });
    const [isChartDragging, setIsChartDragging] = useState(false);
    const [chartDragStart, setChartDragStart] = useState({ x: 0, y: 0 });
    const [isChartFullscreen, setIsChartFullscreen] = useState(false);
    const [chartListWidth, setChartListWidth] = useState(256); // 256px = w-64
    const [showSidebar, setShowSidebar] = useState(() => {
        const saved = localStorage.getItem('acars-sidebar-visible');
        return saved !== null ? saved === 'true' : true;
    });
    const [mobileTab, setMobileTab] = useState<'terminal' | 'notes' | 'charts'>('terminal');
    const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

    const socketRef = useRef<ReturnType<typeof createFlightsSocket> | null>(
        null
    );
    const initializedRef = useRef(false);
    const notesInitializedRef = useRef(false);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const chartContainerRef = useRef<HTMLDivElement | null>(null);
    const chartViewRef = useRef<HTMLDivElement | null>(null);

    // Load panel widths from settings when they become available
    useEffect(() => {
        if (settings?.acars) {
            setTerminalWidth(settings.acars.terminalWidth);
            setNotesWidth(settings.acars.notesWidth);
        }
    }, [settings]);

    useEffect(() => {
        if (sessionId && flightId && flight && !dataLoading && !notesInitializedRef.current) {
            const storageKey = `acars-notes-${sessionId}-${flightId}`;
            const savedNotes = localStorage.getItem(storageKey);

            if (savedNotes) {
                setNotes(savedNotes);
            } else {
                const departureAirport = getAirportName(flight.departure || '', airports);
                const arrivalAirport = getAirportName(flight.arrival || '', airports);
                const formattedCallsign = parseCallsign(flight.callsign || '', airlines);

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
            // Handle chart list resize separately
            return;
        }

        const container = e.currentTarget as HTMLElement;
        const rect = container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = (x / rect.width) * 100;

        if (isDragging === 'terminal') {
            const newTerminalWidth = Math.max(30, Math.min(70, percentage));
            setTerminalWidth(newTerminalWidth);
        } else if (isDragging === 'notes') {
            const newNotesWidth = Math.max(15, Math.min(35, percentage - terminalWidth));
            setNotesWidth(newNotesWidth);
        }
    };

    const handleChartListMouseMove = (e: React.MouseEvent) => {
        if (isDragging !== 'chartList') return;

        const chartContainer = e.currentTarget as HTMLElement;
        const rect = chartContainer.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const newWidth = Math.max(200, Math.min(500, x));
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

    const handleChartMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return; // Only left click
        setIsChartDragging(true);
        setChartDragStart({ x: e.clientX - chartPan.x, y: e.clientY - chartPan.y });
    };

    const handleChartMouseMove = (e: React.MouseEvent) => {
        if (!isChartDragging) return;
        setChartPan({
            x: e.clientX - chartDragStart.x,
            y: e.clientY - chartDragStart.y,
        });
    };

    const handleChartMouseUp = () => {
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
            chartContainerRef.current.requestFullscreen().then(() => {
                setIsChartFullscreen(true);
            }).catch((err) => {
                console.error('Error attempting to enable fullscreen:', err);
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
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
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
    }, []);

    const getChartsForAirport = (icao: string) => {
        const charts: { name: string; path: string; type: string }[] = [];
        const baseUrl = '/assets/app/charts';

        // Mapping of available charts per airport
        const availableCharts: Record<string, { pattern: string; num: number; name: string; type: string }[]> = {
            'EGKK': [
                { pattern: 'GND', num: 1, name: 'Airport Diagram', type: 'Ground' },
                { pattern: 'GND', num: 2, name: 'Ground Movement', type: 'Ground' },
                { pattern: 'DEP', num: 1, name: 'SID Chart 1', type: 'Departure' },
                { pattern: 'DEP', num: 2, name: 'SID Chart 2', type: 'Departure' },
                { pattern: 'DEP', num: 3, name: 'SID Chart 3', type: 'Departure' },
                { pattern: 'ARR', num: 1, name: 'STAR Chart 1', type: 'Arrival' },
                { pattern: 'ARR', num: 2, name: 'STAR Chart 2', type: 'Arrival' },
            ],
            'GCLP': [
                { pattern: 'GND', num: 1, name: 'Airport Diagram', type: 'Ground' },
                { pattern: 'DEP', num: 1, name: 'SID Chart 1', type: 'Departure' },
                { pattern: 'DEP', num: 2, name: 'SID Chart 2', type: 'Departure' },
                { pattern: 'DEP', num: 3, name: 'SID Chart 3', type: 'Departure' },
                { pattern: 'ARR', num: 1, name: 'STAR Chart 1', type: 'Arrival' },
                { pattern: 'ARR', num: 2, name: 'STAR Chart 2', type: 'Arrival' },
                { pattern: 'ARR', num: 3, name: 'STAR Chart 3', type: 'Arrival' },
            ],
            'LCLK': [
                { pattern: 'GND', num: 1, name: 'Airport Diagram', type: 'Ground' },
                { pattern: 'GND', num: 2, name: 'Ground Movement', type: 'Ground' },
                { pattern: 'DEP', num: 1, name: 'SID Chart 1', type: 'Departure' },
                { pattern: 'DEP', num: 2, name: 'SID Chart 2', type: 'Departure' },
                { pattern: 'ARR', num: 1, name: 'STAR Chart', type: 'Arrival' },
            ],
            'MDPC': [
                { pattern: 'GND', num: 1, name: 'Airport Diagram', type: 'Ground' },
                { pattern: 'GND', num: 2, name: 'Ground Movement', type: 'Ground' },
                { pattern: 'DEP', num: 1, name: 'SID Chart', type: 'Departure' },
                { pattern: 'ARR', num: 1, name: 'STAR Chart', type: 'Arrival' },
            ],
        };

        const airportCharts = availableCharts[icao.toUpperCase()];
        if (airportCharts) {
            airportCharts.forEach(({ pattern, num, name, type }) => {
                const path = `${baseUrl}/${icao}/${icao}_${pattern}_${num}.png`;
                charts.push({ name, path, type });
            });
        }

        return charts;
    };

    const formatTimestamp = (isoTimestamp: string): string => {
        return (
            new Date(isoTimestamp).getUTCHours().toString().padStart(2, '0') +
            ':' +
            new Date(isoTimestamp).getUTCMinutes().toString().padStart(2, '0') +
            'Z'
        );
    };

    const playNotificationSound = (messageType: AcarsMessage['type']) => {
        if (!settings?.sounds) return;

        if (
            messageType === 'warning' ||
            messageType === 'pdc' ||
            messageType === 'contact'
        ) {
            const beepSettings = settings.sounds.acarsBeep;
            if (beepSettings?.enabled) {
                // Create a fresh audio element each time to avoid pitch issues
                const audio = new Audio('/assets/app/sounds/ACARSBeep.wav');
                const logVolume = linearToLogVolume(beepSettings.volume || 100);

                const onCanPlay = () => {
                    audio.removeEventListener('canplaythrough', onCanPlay);
                    audio.removeEventListener('error', onError);
                    playAudioWithGain(audio, logVolume);
                };

                const onError = () => {
                    audio.removeEventListener('canplaythrough', onCanPlay);
                    audio.removeEventListener('error', onError);
                };

                audio.addEventListener('canplaythrough', onCanPlay);
                audio.addEventListener('error', onError);
                audio.load();
            }
        } else if (messageType === 'system' || messageType === 'atis') {
            const chatPopSettings = settings.sounds.acarsChatPop;
            if (chatPopSettings?.enabled) {
                // Create a fresh audio element each time to avoid pitch issues
                const audio = new Audio('/assets/app/sounds/ACARSChatPop.mp3');
                const logVolume = linearToLogVolume(chatPopSettings.volume || 100);

                const onCanPlay = () => {
                    audio.removeEventListener('canplaythrough', onCanPlay);
                    audio.removeEventListener('error', onError);
                    playAudioWithGain(audio, logVolume);
                };

                const onError = () => {
                    audio.removeEventListener('canplaythrough', onCanPlay);
                    audio.removeEventListener('error', onError);
                };

                audio.addEventListener('canplaythrough', onCanPlay);
                audio.addEventListener('error', onError);
                audio.load();
            }
        }
    };

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

                const { valid, accessId: sessionAccess } = await validateResponse.json();
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
            playNotificationSound('warning');
            initializedRef.current = true;
        };

        initializeMessages();
    }, [flight, dataLoading, airlines, airports]);

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
                    playNotificationSound('pdc');
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
                    playNotificationSound('contact');
                }
            }
        );

        return () => {
            socket.socket.disconnect();
            socketRef.current = null;
        };
    }, [sessionId, flightId, loading, sessionAccessId]);

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
        playNotificationSound('system');
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
        playNotificationSound('atis');
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
                                    Don't worry your flight plan was still submitted, but you will not be able to use ACARS until you sign in.
                                </p>
                                <div className="flex gap-3 justify-center">
                                    <Button
                                        onClick={() => window.location.href = `${import.meta.env.VITE_SERVER_URL}/api/auth/discord`}
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
                <div style={{ width: `${terminalWidth}%` }} className="flex-shrink-0">
                    <div className="bg-gray-900 rounded-2xl shadow-2xl overflow-hidden border border-gray-800">
                        <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-4 py-3 border-b border-gray-700">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handleToggleSidebar}
                                    className="p-1 hover:bg-gray-700 rounded transition-colors"
                                    title={showSidebar ? 'Hide sidebar' : 'Show sidebar'}
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
                                        {flight?.callsign ? `${flight.callsign} - ACARS Terminal` : 'ACARS Terminal'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex" style={{ height: 'calc(100vh - 200px)' }}>
                            {showSidebar && (
                                <div className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
                    <div className="p-3 border-b border-gray-800">
                        <h3 className="text-xs font-semibold text-gray-400 mb-2 flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5" />
                            CONTROLLERS
                        </h3>
                        <div className="space-y-2 text-xs">
                            {activeSessions.map((session) => (
                                <div
                                    key={session.sessionId}
                                    className="text-gray-300"
                                >
                                    <div className="font-semibold text-cyan-400 text-xs">
                                        {session.airportIcao}
                                    </div>
                                    {session.controllers &&
                                    session.controllers.length > 0 ? (
                                        <div className="ml-2 mt-0.5 space-y-0.5">
                                            {session.controllers.map(
                                                (controller, idx) => (
                                                    <div
                                                        key={idx}
                                                        className="text-[10px] flex items-center gap-1"
                                                    >
                                                        <span className="text-gray-500">
                                                            •
                                                        </span>
                                                        <span className="text-gray-300">
                                                            {
                                                                controller.username
                                                            }
                                                        </span>
                                                        <span className="text-gray-600">
                                                            ({controller.role})
                                                        </span>
                                                    </div>
                                                )
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-[10px] text-gray-500 ml-2">
                                            {session.activeUsers} controller(s)
                                        </div>
                                    )}
                                </div>
                            ))}
                            {activeSessions.length === 0 && (
                                <div className="text-gray-500 text-[10px]">
                                    No active controllers
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="p-3 flex-1 overflow-y-auto">
                        <h3 className="text-xs font-semibold text-gray-400 mb-2 flex items-center gap-1.5">
                            <Radio className="w-3.5 h-3.5" />
                            ATIS
                        </h3>
                        <div className="space-y-2">
                            {activeSessions
                                .filter(
                                    (session) =>
                                        session.atis && session.atis.text
                                )
                                .map((session) => (
                                    <div
                                        key={session.sessionId}
                                        className="text-xs cursor-pointer hover:bg-gray-800 p-2 rounded-lg transition-colors border border-gray-800 hover:border-gray-700"
                                        onDoubleClick={() =>
                                            handleAtisClick(session)
                                        }
                                        title="Double-click to send to terminal"
                                    >
                                        <div className="font-bold text-blue-400 text-[11px] mb-0.5">
                                            {session.airportIcao} INFO{' '}
                                            {session.atis?.letter}
                                        </div>
                                        <div className="text-gray-500 text-[9px]">
                                            {session.atis?.timestamp &&
                                                new Date(
                                                    session.atis.timestamp
                                                ).toLocaleTimeString('en-US', {
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                    timeZone: 'UTC',
                                                    hour12: false,
                                                })}
                                            Z
                                        </div>
                                    </div>
                                ))}
                            {activeSessions.filter((s) => s.atis && s.atis.text)
                                .length === 0 && (
                                <div className="text-[10px] text-gray-500">
                                    No ATIS available
                                </div>
                            )}
                        </div>
                    </div>
                            </div>
                            )}

                            <div className="flex-1 flex flex-col bg-black">
                                <div className="bg-gray-900 border-b border-gray-800 px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <Terminal className="w-4 h-4 text-green-500" />
                                        <span className="font-mono text-sm text-gray-300">
                                            {flight?.callsign ? (
                                                <>
                                                    {flight.callsign}
                                                    <span className="text-gray-500 font-normal text-xs ml-2">
                                                        {parseCallsign(flight.callsign || '', airlines)}
                                                    </span>
                                                </>
                                            ) : (
                                                'Terminal'
                                            )}
                                        </span>
                                    </div>
                                </div>

                    <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-1.5">
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={getMessageColor(msg.type)}
                            >
                                <span className="text-gray-500">
                                    {formatTimestamp(msg.timestamp)}
                                </span>{' '}
                                <span className="font-bold">
                                    [{msg.station}]:
                                </span>{' '}
                                {renderMessageText(msg)}
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                                <div className="bg-gray-900 border-t border-gray-800 p-3">
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="text-purple-400 border-purple-400 hover:bg-purple-950"
                                            onClick={handleRequestPDC}
                                            disabled={pdcRequested}
                                        >
                                            {pdcRequested ? 'PDC REQUESTED' : 'REQUEST PDC'}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {settings?.acars?.notesEnabled && (
                    <>
                        <div
                            className="w-1 bg-gray-800 hover:bg-blue-500 cursor-col-resize transition-colors mx-2"
                            onMouseDown={() => handleMouseDown('terminal')}
                        />

                        <div style={{ width: `${notesWidth}%` }} className="flex-shrink-0">
                        <div className="bg-gray-900 rounded-2xl shadow-2xl border border-gray-800 overflow-hidden">
                            <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-4 py-3 border-b border-gray-700">
                                <div className="flex items-center gap-2">
                                    <StickyNote className="w-4 h-4 text-blue-500" />
                                    <span className="text-sm font-mono text-gray-300">
                                        Flight Notes
                                    </span>
                                </div>
                            </div>
                            <div className="p-4" style={{ height: 'calc(100vh - 200px)' }}>
                                <textarea
                                    value={notes}
                                    onChange={handleNotesChange}
                                    placeholder="Loading flight plan details..."
                                    className="w-full h-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-xs text-gray-300 font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-600"
                                />
                            </div>
                        </div>
                        </div>
                    </>
                )}

                {settings?.acars?.chartsEnabled && (
                    <>
                        <div
                            className="w-1 bg-gray-800 hover:bg-blue-500 cursor-col-resize transition-colors mx-2"
                            onMouseDown={() => handleMouseDown('notes')}
                        />

                        <div className="flex-1 min-w-0">
                    <div ref={chartContainerRef} className={`bg-gray-900 rounded-2xl shadow-2xl border border-gray-800 overflow-hidden h-full ${isChartFullscreen ? 'bg-black' : ''}`}>
                        <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-4 py-3 border-b border-gray-700">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Map className="w-4 h-4 text-purple-500" />
                                    <span className="text-sm font-mono text-gray-300">
                                        Charts
                                    </span>
                                </div>
                                {selectedChart && (
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={handleZoomOut}
                                            className="p-1 hover:bg-gray-700 rounded transition-colors"
                                            title="Zoom Out"
                                        >
                                            <ZoomOut className="w-4 h-4 text-gray-400" />
                                        </button>
                                        <button
                                            onClick={handleResetZoom}
                                            className="px-2 py-1 hover:bg-gray-700 rounded transition-colors text-[10px] text-gray-400 font-mono"
                                            title="Reset Zoom"
                                        >
                                            {Math.round(chartZoom * 100)}%
                                        </button>
                                        <button
                                            onClick={handleZoomIn}
                                            className="p-1 hover:bg-gray-700 rounded transition-colors"
                                            title="Zoom In"
                                        >
                                            <ZoomIn className="w-4 h-4 text-gray-400" />
                                        </button>
                                        <button
                                            onClick={handleToggleFullscreen}
                                            className="p-1 hover:bg-gray-700 rounded transition-colors ml-2"
                                            title="Toggle Fullscreen"
                                        >
                                            {isChartFullscreen ? (
                                                <Minimize className="w-4 h-4 text-gray-400" />
                                            ) : (
                                                <Maximize className="w-4 h-4 text-gray-400" />
                                            )}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div
                            className="flex"
                            style={{ height: isChartFullscreen ? 'calc(100vh - 60px)' : 'calc(100vh - 200px)' }}
                            onMouseMove={handleChartListMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                        >
                            <div
                                className="border-r border-gray-800 overflow-y-auto overflow-x-hidden p-3 flex-shrink-0"
                                style={{ width: `${chartListWidth}px` }}
                            >
                                {flight && (
                                    <div className="space-y-4">
                                        <div>
                                            <h4 className="text-xs font-semibold text-cyan-400 mb-2 flex items-center gap-1">
                                                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                                                {flight.departure}
                                            </h4>
                                            <div className="space-y-1">
                                                {getChartsForAirport(flight.departure || '').map((chart, idx) => (
                                                    <div
                                                        key={idx}
                                                        onClick={() => {
                                                            setSelectedChart(chart.path);
                                                            setChartLoadError(false);
                                                        }}
                                                        className={`bg-gray-950 border rounded p-2 text-[10px] transition-colors cursor-pointer ${
                                                            selectedChart === chart.path
                                                                ? 'border-cyan-500 bg-cyan-950'
                                                                : 'border-gray-800 hover:border-gray-700'
                                                        }`}
                                                    >
                                                        <div className="text-gray-300 break-words">{chart.name}</div>
                                                        <div className="text-[9px] text-gray-500 mt-0.5 break-words">{chart.type}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <h4 className="text-xs font-semibold text-green-400 mb-2 flex items-center gap-1">
                                                <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                                                {flight.arrival}
                                            </h4>
                                            <div className="space-y-1">
                                                {getChartsForAirport(flight.arrival || '').map((chart, idx) => (
                                                    <div
                                                        key={idx}
                                                        onClick={() => {
                                                            setSelectedChart(chart.path);
                                                            setChartLoadError(false);
                                                        }}
                                                        className={`bg-gray-950 border rounded p-2 text-[10px] transition-colors cursor-pointer ${
                                                            selectedChart === chart.path
                                                                ? 'border-green-500 bg-green-950'
                                                                : 'border-gray-800 hover:border-gray-700'
                                                        }`}
                                                    >
                                                        <div className="text-gray-300 break-words">{chart.name}</div>
                                                        <div className="text-[9px] text-gray-500 mt-0.5 break-words">{chart.type}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {flight.alternate && (
                                            <div>
                                                <h4 className="text-xs font-semibold text-yellow-400 mb-2 flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400"></span>
                                                    {flight.alternate}
                                                </h4>
                                                <div className="space-y-1">
                                                    {getChartsForAirport(flight.alternate).map((chart, idx) => (
                                                        <div
                                                            key={idx}
                                                            onClick={() => {
                                                                setSelectedChart(chart.path);
                                                                setChartLoadError(false);
                                                            }}
                                                            className={`bg-gray-950 border rounded p-2 text-[10px] transition-colors cursor-pointer ${
                                                                selectedChart === chart.path
                                                                    ? 'border-yellow-500 bg-yellow-950'
                                                                    : 'border-gray-800 hover:border-gray-700'
                                                            }`}
                                                        >
                                                            <div className="text-gray-300 break-words">{chart.name}</div>
                                                            <div className="text-[9px] text-gray-500 mt-0.5 break-words">{chart.type}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div
                                className="w-1 bg-gray-800 hover:bg-purple-500 cursor-col-resize transition-colors flex-shrink-0"
                                onMouseDown={() => handleMouseDown('chartList')}
                            />
                            <div
                                ref={chartViewRef}
                                className="flex-1 bg-black overflow-hidden relative"
                                onMouseDown={(e) => {
                                    // Only handle chart pan if not resizing panels
                                    if (!isDragging) {
                                        handleChartMouseDown(e);
                                    }
                                }}
                                onMouseMove={(e) => {
                                    if (isChartDragging) {
                                        handleChartMouseMove(e);
                                        e.stopPropagation();
                                    }
                                }}
                                onMouseUp={(e) => {
                                    if (isChartDragging) {
                                        handleChartMouseUp();
                                        e.stopPropagation();
                                    }
                                }}
                                onMouseLeave={handleChartMouseUp}
                                style={{ cursor: isChartDragging ? 'grabbing' : selectedChart && !chartLoadError ? 'grab' : 'default' }}
                            >
                                {selectedChart ? (
                                    chartLoadError ? (
                                        <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                                            Chart not available
                                        </div>
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center overflow-hidden">
                                            <img
                                                key={selectedChart}
                                                src={selectedChart}
                                                alt="Airport Chart"
                                                className="max-w-none max-h-full"
                                                style={{
                                                    transform: `translate(${chartPan.x}px, ${chartPan.y}px) scale(${chartZoom})`,
                                                    transformOrigin: 'center',
                                                    transition: isChartDragging ? 'none' : 'transform 0.1s ease-out',
                                                    userSelect: 'none',
                                                    pointerEvents: 'none'
                                                }}
                                                onLoad={() => setChartLoadError(false)}
                                                onError={() => setChartLoadError(true)}
                                                draggable={false}
                                            />
                                        </div>
                                    )
                                ) : (
                                    <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                                        Select a chart to view
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                        </div>
                    </>
                )}
            </div>

            {/* Mobile Layout */}
            <div className="md:hidden pt-20 px-4 pb-4">
                {/* Mobile Header with Menu Button */}
                <div className="bg-gray-900 rounded-t-2xl border border-gray-800 border-b-0">
                    <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-4 py-3 flex items-center justify-between">
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

                    {/* Tab Navigation */}
                    <div className="flex border-t border-gray-700">
                        <button
                            onClick={() => setMobileTab('terminal')}
                            className={`flex-1 px-4 py-3 text-xs font-mono transition-colors ${
                                settings?.acars?.notesEnabled || settings?.acars?.chartsEnabled ? 'border-r border-gray-700' : ''
                            } ${
                                mobileTab === 'terminal'
                                    ? 'bg-gray-800 text-green-400'
                                    : 'text-gray-400 hover:bg-gray-800/50'
                            }`}
                        >
                            <div className="flex items-center justify-center gap-2">
                                <Terminal className="w-4 h-4" />
                                <span>Terminal</span>
                            </div>
                        </button>
                        {settings?.acars?.notesEnabled && (
                            <button
                                onClick={() => setMobileTab('notes')}
                                className={`flex-1 px-4 py-3 text-xs font-mono transition-colors ${
                                    settings?.acars?.chartsEnabled ? 'border-r border-gray-700' : ''
                                } ${
                                    mobileTab === 'notes'
                                        ? 'bg-gray-800 text-blue-400'
                                        : 'text-gray-400 hover:bg-gray-800/50'
                                }`}
                            >
                                <div className="flex items-center justify-center gap-2">
                                    <StickyNote className="w-4 h-4" />
                                    <span>Notes</span>
                                </div>
                            </button>
                        )}
                        {settings?.acars?.chartsEnabled && (
                            <button
                                onClick={() => setMobileTab('charts')}
                                className={`flex-1 px-4 py-3 text-xs font-mono transition-colors ${
                                    mobileTab === 'charts'
                                        ? 'bg-gray-800 text-purple-400'
                                        : 'text-gray-400 hover:bg-gray-800/50'
                                }`}
                            >
                                <div className="flex items-center justify-center gap-2">
                                    <Map className="w-4 h-4" />
                                    <span>Charts</span>
                                </div>
                            </button>
                        )}
                    </div>
                </div>

                {/* Mobile Content Area */}
                <div className="bg-gray-900 rounded-b-2xl border border-gray-800 border-t-0 overflow-hidden" style={{ height: 'calc(100vh - 220px)' }}>
                    {/* Terminal Tab */}
                    {mobileTab === 'terminal' && (
                        <div className="h-full flex flex-col bg-black">
                            <div className="bg-gray-900 border-b border-gray-800 px-4 py-2">
                                <span className="font-mono text-xs text-gray-300">
                                    {flight?.callsign && (
                                        <>
                                            {flight.callsign}
                                            <span className="text-gray-500 font-normal text-[10px] ml-2">
                                                {parseCallsign(flight.callsign || '', airlines)}
                                            </span>
                                        </>
                                    )}
                                </span>
                            </div>

                            <div className="flex-1 overflow-y-auto p-3 font-mono text-[10px] space-y-1">
                                {messages.map((msg) => (
                                    <div key={msg.id} className={getMessageColor(msg.type)}>
                                        <span className="text-gray-500">
                                            {formatTimestamp(msg.timestamp)}
                                        </span>{' '}
                                        <span className="font-bold">[{msg.station}]:</span>{' '}
                                        {renderMessageText(msg)}
                                    </div>
                                ))}
                                <div ref={messagesEndRef} />
                            </div>

                            <div className="bg-gray-900 border-t border-gray-800 p-3">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="w-full text-purple-400 border-purple-400 hover:bg-purple-950 text-xs"
                                    onClick={handleRequestPDC}
                                    disabled={pdcRequested}
                                >
                                    {pdcRequested ? 'PDC REQUESTED' : 'REQUEST PDC'}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Notes Tab */}
                    {mobileTab === 'notes' && (
                        <div className="h-full p-3">
                            <textarea
                                value={notes}
                                onChange={handleNotesChange}
                                placeholder="Loading flight plan details..."
                                className="w-full h-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-[10px] text-gray-300 font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-600"
                            />
                        </div>
                    )}

                    {/* Charts Tab */}
                    {mobileTab === 'charts' && (
                        <div className="h-full flex flex-col">
                            {selectedChart && (
                                <div className="bg-gray-900 border-b border-gray-800 px-3 py-2 flex items-center justify-center gap-1">
                                    <button
                                        onClick={handleZoomOut}
                                        className="p-1 hover:bg-gray-700 rounded transition-colors"
                                        title="Zoom Out"
                                    >
                                        <ZoomOut className="w-4 h-4 text-gray-400" />
                                    </button>
                                    <button
                                        onClick={handleResetZoom}
                                        className="px-2 py-1 hover:bg-gray-700 rounded transition-colors text-[10px] text-gray-400 font-mono"
                                        title="Reset Zoom"
                                    >
                                        {Math.round(chartZoom * 100)}%
                                    </button>
                                    <button
                                        onClick={handleZoomIn}
                                        className="p-1 hover:bg-gray-700 rounded transition-colors"
                                        title="Zoom In"
                                    >
                                        <ZoomIn className="w-4 h-4 text-gray-400" />
                                    </button>
                                </div>
                            )}

                            <div className="flex-1 overflow-y-auto">
                                {!selectedChart ? (
                                    <div className="p-3 space-y-4">
                                        {flight && (
                                            <>
                                                <div>
                                                    <h4 className="text-xs font-semibold text-cyan-400 mb-2 flex items-center gap-1">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                                                        {flight.departure}
                                                    </h4>
                                                    <div className="space-y-1">
                                                        {getChartsForAirport(flight.departure || '').map((chart, idx) => (
                                                            <div
                                                                key={idx}
                                                                onClick={() => {
                                                                    setSelectedChart(chart.path);
                                                                    setChartLoadError(false);
                                                                }}
                                                                className="bg-gray-950 border border-gray-800 hover:border-gray-700 rounded p-2 text-[10px] transition-colors cursor-pointer"
                                                            >
                                                                <div className="text-gray-300">{chart.name}</div>
                                                                <div className="text-[9px] text-gray-500 mt-0.5">{chart.type}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div>
                                                    <h4 className="text-xs font-semibold text-green-400 mb-2 flex items-center gap-1">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                                                        {flight.arrival}
                                                    </h4>
                                                    <div className="space-y-1">
                                                        {getChartsForAirport(flight.arrival || '').map((chart, idx) => (
                                                            <div
                                                                key={idx}
                                                                onClick={() => {
                                                                    setSelectedChart(chart.path);
                                                                    setChartLoadError(false);
                                                                }}
                                                                className="bg-gray-950 border border-gray-800 hover:border-gray-700 rounded p-2 text-[10px] transition-colors cursor-pointer"
                                                            >
                                                                <div className="text-gray-300">{chart.name}</div>
                                                                <div className="text-[9px] text-gray-500 mt-0.5">{chart.type}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {flight.alternate && (
                                                    <div>
                                                        <h4 className="text-xs font-semibold text-yellow-400 mb-2 flex items-center gap-1">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400"></span>
                                                            {flight.alternate}
                                                        </h4>
                                                        <div className="space-y-1">
                                                            {getChartsForAirport(flight.alternate).map((chart, idx) => (
                                                                <div
                                                                    key={idx}
                                                                    onClick={() => {
                                                                        setSelectedChart(chart.path);
                                                                        setChartLoadError(false);
                                                                    }}
                                                                    className="bg-gray-950 border border-gray-800 hover:border-gray-700 rounded p-2 text-[10px] transition-colors cursor-pointer"
                                                                >
                                                                    <div className="text-gray-300">{chart.name}</div>
                                                                    <div className="text-[9px] text-gray-500 mt-0.5">{chart.type}</div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                ) : (
                                    <div className="relative h-full bg-black">
                                        <button
                                            onClick={() => setSelectedChart(null)}
                                            className="absolute top-2 left-2 z-10 bg-gray-900 border border-gray-700 hover:bg-gray-800 text-gray-300 px-3 py-1 rounded text-[10px] font-mono"
                                        >
                                            ← Back to List
                                        </button>
                                        {chartLoadError ? (
                                            <div className="flex items-center justify-center h-full text-gray-500 text-xs">
                                                Chart not available
                                            </div>
                                        ) : (
                                            <div
                                                className="w-full h-full flex items-center justify-center overflow-hidden"
                                                onMouseDown={handleChartMouseDown}
                                                onMouseMove={isChartDragging ? handleChartMouseMove : undefined}
                                                onMouseUp={handleChartMouseUp}
                                                onMouseLeave={handleChartMouseUp}
                                                onTouchStart={(e) => {
                                                    const touch = e.touches[0];
                                                    setIsChartDragging(true);
                                                    setChartDragStart({ x: touch.clientX - chartPan.x, y: touch.clientY - chartPan.y });
                                                }}
                                                onTouchMove={(e) => {
                                                    if (!isChartDragging) return;
                                                    const touch = e.touches[0];
                                                    setChartPan({
                                                        x: touch.clientX - chartDragStart.x,
                                                        y: touch.clientY - chartDragStart.y,
                                                    });
                                                }}
                                                onTouchEnd={() => setIsChartDragging(false)}
                                                style={{ cursor: isChartDragging ? 'grabbing' : 'grab' }}
                                            >
                                                <img
                                                    key={selectedChart}
                                                    src={selectedChart}
                                                    alt="Airport Chart"
                                                    className="max-w-none"
                                                    style={{
                                                        transform: `translate(${chartPan.x}px, ${chartPan.y}px) scale(${chartZoom})`,
                                                        transformOrigin: 'center',
                                                        transition: isChartDragging ? 'none' : 'transform 0.1s ease-out',
                                                        userSelect: 'none',
                                                        pointerEvents: 'none',
                                                        maxHeight: '100%'
                                                    }}
                                                    onLoad={() => setChartLoadError(false)}
                                                    onError={() => setChartLoadError(true)}
                                                    draggable={false}
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Mobile Drawer for Controllers/ATIS */}
                {isMobileDrawerOpen && (
                    <>
                        {/* Overlay */}
                        <div
                            className="fixed inset-0 bg-black/50 z-40"
                            onClick={() => setIsMobileDrawerOpen(false)}
                        />

                        {/* Drawer */}
                        <div className="fixed top-0 right-0 h-full w-80 max-w-[85vw] bg-gray-900 border-l border-gray-800 z-50 flex flex-col animate-slide-in">
                            {/* Drawer Header */}
                            <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-4 py-3 border-b border-gray-700 flex items-center justify-between">
                                <span className="text-sm font-mono text-gray-300">Controllers & ATIS</span>
                                <button
                                    onClick={() => setIsMobileDrawerOpen(false)}
                                    className="p-1 hover:bg-gray-700 rounded transition-colors"
                                >
                                    <ChevronRight className="w-5 h-5 text-gray-400" />
                                </button>
                            </div>

                            {/* Controllers Section */}
                            <div className="p-3 border-b border-gray-800">
                                <h3 className="text-xs font-semibold text-gray-400 mb-2 flex items-center gap-1.5">
                                    <User className="w-3.5 h-3.5" />
                                    CONTROLLERS
                                </h3>
                                <div className="space-y-2 text-xs">
                                    {activeSessions.map((session) => (
                                        <div key={session.sessionId} className="text-gray-300">
                                            <div className="font-semibold text-cyan-400 text-xs">
                                                {session.airportIcao}
                                            </div>
                                            {session.controllers && session.controllers.length > 0 ? (
                                                <div className="ml-2 mt-0.5 space-y-0.5">
                                                    {session.controllers.map((controller, idx) => (
                                                        <div key={idx} className="text-[10px] flex items-center gap-1">
                                                            <span className="text-gray-500">•</span>
                                                            <span className="text-gray-300">{controller.username}</span>
                                                            <span className="text-gray-600">({controller.role})</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-[10px] text-gray-500 ml-2">
                                                    {session.activeUsers} controller(s)
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {activeSessions.length === 0 && (
                                        <div className="text-gray-500 text-[10px]">No active controllers</div>
                                    )}
                                </div>
                            </div>

                            {/* ATIS Section */}
                            <div className="p-3 flex-1 overflow-y-auto">
                                <h3 className="text-xs font-semibold text-gray-400 mb-2 flex items-center gap-1.5">
                                    <Radio className="w-3.5 h-3.5" />
                                    ATIS
                                </h3>
                                <div className="space-y-2">
                                    {activeSessions
                                        .filter((session) => session.atis && session.atis.text)
                                        .map((session) => (
                                            <div
                                                key={session.sessionId}
                                                className="text-xs cursor-pointer hover:bg-gray-800 p-2 rounded-lg transition-colors border border-gray-800 hover:border-gray-700"
                                                onClick={() => {
                                                    handleAtisClick(session);
                                                    setIsMobileDrawerOpen(false);
                                                    setMobileTab('terminal');
                                                }}
                                                title="Tap to send to terminal"
                                            >
                                                <div className="font-bold text-blue-400 text-[11px] mb-0.5">
                                                    {session.airportIcao} INFO {session.atis?.letter}
                                                </div>
                                                <div className="text-gray-500 text-[9px]">
                                                    {session.atis?.timestamp &&
                                                        new Date(session.atis.timestamp).toLocaleTimeString('en-US', {
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                            timeZone: 'UTC',
                                                            hour12: false,
                                                        })}
                                                    Z
                                                </div>
                                            </div>
                                        ))}
                                    {activeSessions.filter((s) => s.atis && s.atis.text).length === 0 && (
                                        <div className="text-[10px] text-gray-500">No ATIS available</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
