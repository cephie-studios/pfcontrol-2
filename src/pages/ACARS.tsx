import { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import{Terminal, User, Radio} from "lucide-react";
import Navbar from "../components/Navbar";
import Loader from "../components/common/Loader";
import Button from "../components/common/Button";
import { createFlightsSocket } from "../sockets/flightsSocket";
import { createOverviewSocket } from "../sockets/overviewSocket";
import { useData } from "../hooks/data/useData";
import { parseCallsign, getAirportName } from "../utils/callsignParser";
import type { Flight } from "../types/flight";
import type { OverviewSession } from "../sockets/overviewSocket";

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
    const { sessionId, flightId } = useParams<{ sessionId: string; flightId: string }>();
    const [searchParams] = useSearchParams();
    const accessId = searchParams.get('accessId');
    const navigate = useNavigate();
    const { airports, airlines, loading: dataLoading } = useData();
    const [loading, setLoading] = useState(true);
    const [flight, setFlight] = useState<Flight | null>(null);
    const [messages, setMessages] = useState<AcarsMessage[]>([]);
    const [activeSessions, setActiveSessions] = useState<OverviewSession[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [pdcRequested, setPdcRequested] = useState(false);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const chatPopRef = useRef<HTMLAudioElement | null>(null);
    const socketRef = useRef<ReturnType<typeof createFlightsSocket> | null>(null);
    const initializedRef = useRef(false);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);

    const formatTimestamp = (isoTimestamp: string): string => {
        return new Date(isoTimestamp).getUTCHours().toString().padStart(2, '0') + ':' + new Date(isoTimestamp).getUTCMinutes().toString().padStart(2, '0') + 'Z';
    };

    const playNotificationSound = (messageType: AcarsMessage['type']) => {
        if (messageType === 'warning' || messageType === 'pdc' || messageType === 'contact') {
            audioRef.current?.play().catch(() => {
                console.log('Autoplay blocked');
            });
        }
        else if (messageType === 'system' || messageType === 'atis') {
            chatPopRef.current?.play().catch(() => {
                console.log('Autoplay blocked');
            });
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
                const response = await fetch(
                    `${import.meta.env.VITE_SERVER_URL}/api/flights/${sessionId}`,
                    { credentials: 'include' }
                );

                if (!response.ok) {
                    throw new Error('Failed to load flight data');
                }

                const flights: Flight[] = await response.json();
                const currentFlight = flights.find(f => String(f.id) === String(flightId));

                if (!currentFlight) {
                    throw new Error('Flight not found');
                }

                if (currentFlight.acars_token !== accessId) {
                    throw new Error('Invalid access token');
                }

                setFlight(currentFlight);
                setLoading(false);
            } catch (err) {
                console.error('ACARS validation error:', err);
                setError(err instanceof Error ? err.message : 'Access denied');
                setLoading(false);
            }
        };

        validateAndLoad();
    }, [sessionId, flightId, accessId]);

    useEffect(() => {
        if (!flight || dataLoading || initializedRef.current) return;

        const initializeMessages = async () => {
            const warningMsg: AcarsMessage = {
                id: `${Date.now()}-warning`,
                timestamp: new Date().toISOString(),
                station: 'SYSTEM',
                text: 'DO NOT CLOSE THIS WINDOW, CONTROLLERS MAY SEND PRE DEPARTURE CLEARANCES THROUGH THE ACARS TERMINAL',
                type: 'warning'
            };

            const successMsg: AcarsMessage = {
                id: `${Date.now()}-success`,
                timestamp: new Date().toISOString(),
                station: 'SYSTEM',
                text: `FLIGHT PLAN: ${flight.callsign} SUBMITTED SUCCESSFULLY`,
                type: 'Success'
            };

            const formattedCallsign = parseCallsign(flight.callsign, airlines);
            const departureAirport = getAirportName(flight.departure, airports);
            const arrivalAirport = getAirportName(flight.arrival, airports);

            const detailsMsg: AcarsMessage = {
                id: `${Date.now()}-details`,
                timestamp: new Date().toISOString(),
                station: 'SYSTEM',
                text: `FLIGHT PLAN DETAILS,\nCALLSIGN: ${flight.callsign} (${formattedCallsign}), \nTYPE: ${flight.aircraft},\nRULES: ${flight.flight_type},\nSTAND: ${flight.stand ||'N/A'},\nDEPARTING: ${departureAirport},\nARRIVING: ${arrivalAirport}`,
                type: 'system'
            };

            const initialMessages = [warningMsg, detailsMsg, successMsg];

            if (flight.pdc_remarks) {
                const pdcMsg: AcarsMessage = {
                    id: `${Date.now()}-pdc-existing`,
                    timestamp: new Date().toISOString(),
                    station: `${flight.departure}_DEL`,
                    text: flight.pdc_remarks,
                    type: 'pdc'
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
                                    url: `${window.location.origin}/flight/${trackingData.shareToken}`
                                }
                            };
                            initialMessages.push(logbookMsg);
                        }
                    }
                } catch (error) {
                    console.error('Error checking logbook tracking:', error);
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
        audioRef.current = new Audio('/assets/app/sounds/ACARSBeep.ogg');
        audioRef.current.volume = 1.0;

        chatPopRef.current = new Audio('/assets/app/sounds/ACARSChatPop.mp3');
        chatPopRef.current.volume = 1.0;
    }, []);

    useEffect(() => {
        if (!sessionId || loading) return;

        const socket = createFlightsSocket(
            sessionId,
            '',
            () => {},
            () => {},
            () => {},
            () => {}
        );

        socketRef.current = socket;

        socket.socket.on('pdcIssued', (payload: any) => {
            const pdcText = payload?.pdcText ?? payload?.updatedFlight?.pdc_remarks;
            if (pdcText && String(payload.flightId) === String(flightId)) {
                addPDCMessage(pdcText);
                playNotificationSound('pdc');
            }
        });

        socket.socket.on('contactMe', (payload: any) => {
            if (String(payload.flightId) === String(flightId)) {
                const contactMsg: AcarsMessage = {
                    id: `${Date.now()}-contact`,
                    timestamp: new Date().toISOString(),
                    station: `${flight?.departure}_TWR`,
                    text: payload.message || 'CONTACT CONTROLLER ON FREQUENCY',
                    type: 'contact'
                };
                setMessages(prev => [...prev, contactMsg]);
                playNotificationSound('contact');
            }
        });

        return () => {
            socket.socket.disconnect();
        };
    }, [sessionId, flightId, loading]);

    useEffect(() => {
        const overviewSocket = createOverviewSocket(
            (data) => {
                setActiveSessions(data.activeSessions);
            }
        );

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
            type: 'pdc'
        };
        setMessages(prev => [...prev, message]);
    };

    const handleRequestPDC = () => {
        if (!flight || !socketRef.current?.socket || pdcRequested) return;

        socketRef.current.socket.emit('requestPDC', {
            flightId: flight.id,
            callsign: flight.callsign,
            note: 'PDC requested via ACARS terminal'
        });

        const confirmMsg: AcarsMessage = {
            id: `${Date.now()}-pdc-request`,
            timestamp: new Date().toISOString(),
            station: 'SYSTEM',
            text: 'PDC REQUEST SENT TO CONTROLLERS',
            type: 'Success'
        };
        setMessages(prev => [...prev, confirmMsg]);
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
            type: 'atis'
        };
        setMessages(prev => [...prev, atisMsg]);
        playNotificationSound('atis');
    };

    const getMessageColor = (type: AcarsMessage['type']) => {
        switch (type) {
            case 'warning': return 'text-red-400';
            case 'pdc': return 'text-cyan-400';
            case 'Success': return 'text-green-400';
            case 'system': return 'text-white';
            case 'contact': return 'text-orange-400';
            case 'atis': return 'text-blue-400';
            default: return 'text-white';
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

    if (loading || dataLoading) {
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
                    <div className="text-center">
                        <h1 className="text-2xl font-bold text-red-500 mb-4">Access Denied</h1>
                        <p className="text-gray-400 mb-6">{error}</p>
                        <Button onClick={() => navigate('/')}>Return Home</Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-950 text-white flex flex-col">
            <Navbar />

            <div className="flex-1 flex overflow-hidden pt-16">
                {/*Controllers and atis*/}
                <div className="w-80 bg-gray-900 border-r border-gray-800 flex flex-col">
                    <div className="p-4 border-b border-gray-800">
                        <h3 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">    
                            <User className="w-4 h-4" />
                            ACTIVE PFATC CONTROLLERS
                        </h3>
                        <div className="space-y-3 text-sm">
                            {activeSessions.map(session => (
                                <div key={session.sessionId} className="text-gray-300">
                                    <div className="font-semibold text-cyan-400">{session.airportIcao}</div>
                                    {session.controllers && session.controllers.length > 0 ? (
                                        <div className="ml-2 mt-1 space-y-1">
                                            {session.controllers.map((controller, idx) => (
                                                <div key={idx} className="text-xs flex items-center gap-1">
                                                    <span className="text-gray-400">•</span>
                                                    <span className="text-white">{controller.username}</span>
                                                    <span className="text-gray-500">({controller.role})</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-xs text-gray-500 ml-2">
                                            {session.activeUsers} controller(s) online
                                        </div>
                                    )}
                                </div>
                            ))}
                            {activeSessions.length === 0 && (
                                <div className="text-gray-500 text-xs">No active controllers</div>
                            )}
                        </div>
                    </div>

                    <div className="p-4 flex-1 overflow-y-auto">
                        <h3 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
                            <Radio className="w-4 h-4" />
                            ATIS
                        </h3>
                        <div className="space-y-3">
                            {activeSessions
                                .filter(session => session.atis && session.atis.text)
                                .map(session => (
                                    <div
                                        key={session.sessionId}
                                        className="text-xs cursor-pointer hover:bg-gray-800 p-2 rounded transition-colors"
                                        onDoubleClick={() => handleAtisClick(session)}
                                        title="Double-click to send to terminal"
                                    >
                                        <div className="font-bold text-blue-400 mb-1">
                                            {session.airportIcao} INFO {session.atis?.letter}
                                        </div>
                                        <div className="text-gray-500 text-[10px] mt-1">
                                            {session.atis?.timestamp && new Date(session.atis.timestamp).toLocaleTimeString('en-US', {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                                timeZone: 'UTC',
                                                hour12: false
                                            })}Z
                                        </div>
                                    </div>
                                ))}
                            {activeSessions.filter(s => s.atis && s.atis.text).length === 0 && (
                                <div className="text-xs text-gray-500">
                                    No ATIS available
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/*Terminal*/}
                <div className="flex-1 flex flex-col bg-black">
                    <div className="bg-gray-900 border-b border-gray-800 p-4">
                        <div className="flex items-center justify-between">
                            <h1 className="text-xl font-bold flex items-center gap-2">
                                <Terminal className="w-5 h-5 text-green-500" />
                                {flight?.callsign ? (
                                    <>
                                        {flight.callsign}
                                        <span className="text-gray-400 font-normal text-base">
                                            - {parseCallsign(flight.callsign, airlines)}
                                        </span>
                                    </>
                                ) : 'ACARS TERMINAL'}
                            </h1>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 font-mono text-sm space-y-2">
                        {messages.map(msg => (
                            <div key={msg.id} className={getMessageColor(msg.type)}>
                                <span className="text-gray-500">{formatTimestamp(msg.timestamp)}</span>
                                {' '}
                                <span className="font-bold">[{msg.station}]:</span>
                                {' '}
                                {renderMessageText(msg)}
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    {/*Buttons*/}
                    <div className="bg-gray-900 border-t border-gray-800 p-4">
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                variant="outline"
                                className="text-purple-400 border-purple-400"
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
    );
}