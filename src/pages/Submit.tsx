import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import WindDisplay from '../components/tools/WindDisplay';
import Button from '../components/common/Button';
import {
    Check,
    X,
    AlertTriangle,
    PlaneTakeoff,
    PlaneLanding,
    Navigation,
    ArrowUpDown,
    Route,
    StickyNote,
    BadgeCheck,
    PlusCircle,
    ClipboardList,
    ParkingCircle,
    Loader2,
    MapPinCheck,
    Plane,
    Notebook,
} from 'lucide-react';
import { createFlightsSocket } from '../sockets/flightsSocket';
import { addFlight } from '../utils/fetch/flights';
import type { Flight } from '../types/flight';
import AirportDropdown from '../components/dropdowns/AirportDropdown';
import Dropdown from '../components/common/Dropdown';
import AircraftDropdown from '../components/dropdowns/AircraftDropdown';
import Loader from '../components/common/Loader';
import AccessDenied from '../components/AccessDenied';
import { useAuth } from '../hooks/auth/useAuth';

interface SessionData {
    sessionId: string;
    airportIcao: string;
    activeRunway?: string;
    atis?: unknown;
    isPFATC?: boolean;
}

export default function Submit() {
    const { sessionId } = useParams<{ sessionId: string }>();
    const [searchParams] = useSearchParams();
    const accessId = searchParams.get('accessId') ?? undefined;
    const { user } = useAuth();
    const navigate = useNavigate();

    const [session, setSession] = useState<SessionData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [submittedFlight, setSubmittedFlight] = useState<Flight | null>(null);
    const [logWithLogbook, setLogWithLogbook] = useState(false);
    const [testerGateEnabled, setTesterGateEnabled] = useState(false);
    const [form, setForm] = useState({
        callsign: '',
        aircraft_type: '',
        departure: '',
        arrival: '',
        route: '',
        stand: '',
        remark: '',
        flight_type: 'IFR',
        cruisingFL: '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [flightsSocket, setFlightsSocket] = useState<ReturnType<
        typeof createFlightsSocket
    > | null>(null);
    const [initialLoadComplete, setInitialLoadComplete] = useState(false);
    const [pdcReceived, setPdcReceived] = useState(false);
    const [pdcContent, setPdcContent] = useState<string | null>(null);
    const submittedFlightRef = React.useRef<Flight | null>(null);
    useEffect(() => {
        submittedFlightRef.current = submittedFlight;
    }, [submittedFlight]);

    useEffect(() => {
        if (!sessionId || !initialLoadComplete) return;

        let listenerWrapper: ReturnType<typeof createFlightsSocket> | null =
            null;
        try {
            listenerWrapper = createFlightsSocket(
                sessionId,
                '',
                () => {},
                () => {},
                () => {},
                () => {}
            );
        } catch (err) {
            console.debug('PDC listener creation failed', err);
            return;
        }

        type PdcIssuedPayload = {
            pdcText?: string;
            flightId?: string | number;
            updatedFlight?: {
                pdc_remarks?: string;
                pdc_text?: string;
                callsign?: string;
                departure?: string;
                arrival?: string;
            };
        };

        const handlePdcIssued = (payload: PdcIssuedPayload) => {
            try {
                const pdcText =
                    payload?.pdcText ??
                    payload?.updatedFlight?.pdc_remarks ??
                    payload?.updatedFlight?.pdc_text ??
                    null;
                if (!pdcText) return;

                const sf = submittedFlightRef.current;
                let matches = false;

                if (
                    sf &&
                    payload?.flightId !== undefined &&
                    payload?.flightId !== null
                ) {
                    matches = String(payload.flightId) === String(sf.id);
                }

                if (!matches && sf && payload?.updatedFlight) {
                    const uf = payload.updatedFlight;
                    if (
                        uf.callsign === sf.callsign &&
                        uf.departure === sf.departure &&
                        uf.arrival === sf.arrival
                    ) {
                        matches = true;
                    }
                }

                if (!matches && payload?.updatedFlight) {
                    const uf = payload.updatedFlight;
                    if (
                        uf.callsign === form.callsign &&
                        uf.departure === form.departure &&
                        uf.arrival === form.arrival
                    ) {
                        matches = true;
                    }
                }

                if (matches) {
                    setPdcContent(String(pdcText));
                    setPdcReceived(true);
                }
            } catch (err) {
                console.error(
                    'Error handling pdcIssued in Submit listener',
                    err
                );
            }
        };

        try {
            if (listenerWrapper && listenerWrapper.socket) {
                listenerWrapper.socket.on('pdcIssued', handlePdcIssued);
            }
        } catch (err) {
            console.debug('Could not attach pdcIssued handler', err);
        }

        return () => {
            try {
                if (listenerWrapper && listenerWrapper.socket) {
                    listenerWrapper.socket.off('pdcIssued', handlePdcIssued);
                    listenerWrapper.socket.disconnect();
                }
            } catch (e) {
                console.error('Error cleaning up pdcIssued listener', e);
            }
        };
    }, [sessionId, initialLoadComplete, form]);

    const isLogbookDisabled =
        testerGateEnabled && !user?.isTester && !user?.isAdmin;
    const hasRobloxLinked = !!user?.robloxUsername;

    useEffect(() => {
        if (!sessionId || initialLoadComplete) return;

        setLoading(true);

        Promise.all([
            fetch(
                `${
                    import.meta.env.VITE_SERVER_URL
                }/api/sessions/${sessionId}/submit`
            ).then((res) => (res.ok ? res.json() : Promise.reject(res))),
            fetch(`${import.meta.env.VITE_SERVER_URL}/api/data/settings`).then(
                (res) => (res.ok ? res.json() : Promise.reject(res))
            ),
        ])
            .then(([sessionData, settings]) => {
                setSession(sessionData);
                setTesterGateEnabled(settings.tester_gate_enabled || false);
                setForm((f) => ({
                    ...f,
                    departure: sessionData.airportIcao || '',
                }));
                setInitialLoadComplete(true);
            })
            .catch(() => setError('Session not found'))
            .finally(() => setLoading(false));
    }, [sessionId, initialLoadComplete]);

    useEffect(() => {
        if (!sessionId || !accessId || !initialLoadComplete) return;

        const socket = createFlightsSocket(
            sessionId,
            accessId,
            () => {},
            (flight: Flight) => {
                setSubmittedFlight(flight);
                if (session?.isPFATC) {
                    navigate(
                        `/acars/${sessionId}/${flight.id}?accessId=${flight.acars_token}`
                    );
                } else {
                    setSuccess(true);
                }
                setIsSubmitting(false);
            },
            () => {},
            (error) => {
                console.error('Flight error:', error);
                setError('Failed to submit flight.');
                setIsSubmitting(false);
            }
        );

        setFlightsSocket(socket);

        return () => {
            socket.socket.disconnect();
        };
    }, [sessionId, accessId, initialLoadComplete]);

    const handleChange = (name: string) => (value: string) => {
        setForm((f) => ({ ...f, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (isSubmitting) return;

        setError('');
        setSuccess(false);
        setIsSubmitting(true);

        if (!form.callsign || !form.arrival || !form.aircraft_type) {
            setError('Please fill all required fields.');
            setIsSubmitting(false);
            return;
        }

        if (logWithLogbook && hasRobloxLinked && !isLogbookDisabled) {
            try {
                await fetch(
                    `${
                        import.meta.env.VITE_SERVER_URL
                    }/api/logbook/flights/start`,
                    {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            robloxUsername: user?.robloxUsername,
                            callsign: form.callsign,
                            departureIcao: form.departure,
                            arrivalIcao: form.arrival,
                            route: form.route,
                            aircraftIcao: form.aircraft_type,
                        }),
                    }
                );
            } catch (error) {
                console.error('Failed to start logbook tracking:', error);
            }
        }

        if (flightsSocket) {
            flightsSocket.addFlight({
                ...form,
                flight_type: form.flight_type,
                cruisingFL: form.cruisingFL,
                status: 'PENDING',
            });
        } else {
            try {
                const flight = await addFlight(sessionId!, {
                    ...form,
                    flight_type: form.flight_type,
                    cruisingFL: form.cruisingFL,
                    status: 'PENDING',
                });
                setSubmittedFlight(flight);
                if (session?.isPFATC) {
                    navigate(
                        `/acars/${sessionId}/${flight.id}/?accessId=${flight.acars_token}`
                    );
                } else {
                    setSuccess(true);
                }
            } catch {
                setError('Failed to submit flight.');
            } finally {
                setIsSubmitting(false);
            }
        }
    };

    const handleCreateAnother = () => {
        setSuccess(false);
        setSubmittedFlight(null);
        setLogWithLogbook(false);
        setForm({
            callsign: '',
            aircraft_type: '',
            departure: session?.airportIcao || '',
            arrival: '',
            route: '',
            stand: '',
            remark: '',
            flight_type: 'IFR',
            cruisingFL: '',
        });
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <Navbar />
                <Loader />
            </div>
        );
    }

    if (!sessionId || !session) {
        return <AccessDenied errorType="invalid-session" />;
    }

    return (
        <div className="min-h-screen bg-gray-950 text-white">
            <Navbar />
            {/* Banner */}
            <div className="relative w-full h-56 md:h-72 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-gray-950 to-transparent">
                    <img
                        src="/assets/app/backgrounds/mdpc_01.png"
                        alt="Banner"
                        className="object-cover w-full h-full blur-xs scale-110 opacity-60"
                    />
                </div>
                <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center p-6 md:p-10">
                    {session.airportIcao ? (
                        <h2
                            className="text-3xl sm:text-5xl font-extrabold text-blue-500 mb-6"
                            style={{ lineHeight: 1.4 }}
                        >
                            <span>{session.airportIcao}</span> - SUBMIT FLIGHT
                            PLAN
                        </h2>
                    ) : (
                        'SUBMIT FLIGHT PLAN'
                    )}
                    {session.activeRunway && (
                        <div className="-mt-6 text-blue-400 text-md">
                            Departure Runway:{' '}
                            <span className="font-semibold">
                                {session.activeRunway}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            <div className="container mx-auto max-w-3xl px-4 pb-8 pt-8">
                <div className="mb-8">
                    <WindDisplay icao={session.airportIcao} />
                </div>
                {/* Success Message */}
                {success && submittedFlight && (
                    <>
                        {logWithLogbook && (
                            <div className="bg-blue-900/30 border border-blue-700 rounded-xl mb-4 overflow-hidden">
                                <div className="p-5 flex items-start justify-between">
                                    <div className="flex items-start flex-1">
                                        <div className="bg-blue-600 rounded-full p-2 mr-3 flex-shrink-0">
                                            <Notebook className="h-5 w-5 text-white" />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="text-base font-semibold text-blue-200 mb-1">
                                                Flight Tracking Active
                                            </h3>
                                            <p className="text-blue-300 text-sm mb-3">
                                                Your flight is now being tracked
                                                in your logbook. View real-time
                                                telemetry, altitude, speed, and
                                                more!
                                            </p>
                                            <a
                                                href="/logbook"
                                                className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
                                            >
                                                <Notebook className="h-4 w-4 mr-2" />
                                                View Live Flight
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="bg-green-900/30 border border-green-700 rounded-xl mb-8 overflow-hidden">
                            <div className="bg-green-900/50 p-4 border-b border-green-700 flex items-center">
                                <div className="bg-green-700 rounded-full p-2 mr-3">
                                    <Check className="h-6 w-6 text-green-200" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold text-green-200">
                                        Flight Plan Submitted Successfully!
                                    </h3>
                                    <p className="text-green-300 text-sm">
                                        Your flight plan has been submitted to
                                        ATC and is awaiting clearance.
                                    </p>
                                </div>
                                <button
                                    onClick={() => {
                                        setSuccess(false);
                                        setSubmittedFlight(null);
                                    }}
                                    className="text-green-300 hover:text-green-100 ml-4"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                            <div className="p-6">
                                <div className="flex items-center mb-4">
                                    <ClipboardList className="h-5 w-5 text-green-400 mr-2" />
                                    <h4 className="text-lg font-semibold text-green-200">
                                        Flight Plan Details
                                    </h4>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <div>
                                            <span className="text-sm font-medium text-gray-400">
                                                Callsign:
                                            </span>
                                            <p className="text-white font-semibold">
                                                {submittedFlight.callsign}
                                            </p>
                                        </div>
                                        <div>
                                            <span className="text-sm font-medium text-gray-400">
                                                Aircraft:
                                            </span>
                                            <p className="text-white">
                                                {submittedFlight.aircraft}
                                            </p>
                                        </div>
                                        <div>
                                            <span className="text-sm font-medium text-gray-400">
                                                Flight Type:
                                            </span>
                                            <p className="text-white">
                                                {submittedFlight.flight_type}
                                            </p>
                                        </div>
                                        {submittedFlight.stand && (
                                            <div>
                                                <span className="text-sm font-medium text-gray-400">
                                                    Stand:
                                                </span>
                                                <p className="text-white">
                                                    {submittedFlight.stand}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-3">
                                        <div>
                                            <span className="text-sm font-medium text-gray-400">
                                                Departure:
                                            </span>
                                            <p className="text-white">
                                                {submittedFlight.departure}
                                            </p>
                                        </div>
                                        <div>
                                            <span className="text-sm font-medium text-gray-400">
                                                Arrival:
                                            </span>
                                            <p className="text-white">
                                                {submittedFlight.arrival}
                                            </p>
                                        </div>
                                        {submittedFlight.route && (
                                            <div>
                                                <span className="text-sm font-medium text-gray-400">
                                                    Route:
                                                </span>
                                                <p className="text-white font-mono">
                                                    {submittedFlight.route}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {submittedFlight.remark && (
                                    <div className="mt-4 pt-4 border-t border-green-800">
                                        <span className="text-sm font-medium text-gray-400">
                                            Remarks:
                                        </span>
                                        <p className="text-white mt-1">
                                            {submittedFlight.remark}
                                        </p>
                                    </div>
                                )}

                                {/* NEW: lightweight PDC display for pilots (non-intrusive) */}
                                {pdcReceived && pdcContent && (
                                    <div className="mt-6 p-4 bg-blue-900/20 border border-blue-700 rounded-md">
                                        <h4 className="text-sm font-semibold text-blue-200 mb-2">
                                            Pre-Departure Clearance (PDC)
                                            received
                                        </h4>
                                        <pre className="bg-transparent text-xs text-white font-mono whitespace-pre-wrap">
                                            {pdcContent}
                                        </pre>
                                        <div className="mt-3 flex gap-2">
                                            <Button
                                                onClick={() =>
                                                    navigator.clipboard?.writeText(
                                                        pdcContent || ''
                                                    )
                                                }
                                                variant="outline"
                                                size="sm"
                                            >
                                                Copy PDC
                                            </Button>
                                            <Button
                                                onClick={() => {
                                                    setPdcReceived(false);
                                                    setPdcContent(null);
                                                }}
                                                size="sm"
                                            >
                                                Dismiss
                                            </Button>
                                        </div>
                                    </div>
                                )}
                                <div className="mt-6 pt-4 border-t border-green-800">
                                    <div className="flex gap-3">
                                        <Button
                                            onClick={handleCreateAnother}
                                            className="flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-lg transition-colors"
                                        >
                                            <PlusCircle className="h-5 w-5 mr-2" />
                                            Create Another Flight Plan
                                        </Button>

                                        {/* Open ACARS (opens ACARS page for this session; passes flightId as query) */}
                                        <Button
                                            onClick={() =>
                                                navigate(
                                                    `/acars/${sessionId}?flightId=${encodeURIComponent(
                                                        String(
                                                            submittedFlight.id
                                                        )
                                                    )}`
                                                )
                                            }
                                            variant="outline"
                                            className="flex items-center justify-center text-white py-3 px-4 rounded-lg transition-colors"
                                        >
                                            Open ACARS
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* Form */}
                {!success && (
                    <div className="bg-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-800 shadow-xl overflow-hidden">
                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            {error && (
                                <div className="p-3 bg-red-900/40 border border-red-700 rounded-md flex items-center text-sm mb-2">
                                    <AlertTriangle className="h-5 w-5 mr-2 text-red-400" />
                                    {error}
                                </div>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div>
                                        <label className="flex items-center mb-2 text-sm font-medium text-gray-300">
                                            <BadgeCheck className="h-4 w-4 mr-2 text-gray-400" />
                                            Callsign{' '}
                                            <span className="text-red-400 ml-1">
                                                *
                                            </span>
                                        </label>
                                        <input
                                            type="text"
                                            name="callsign"
                                            value={form.callsign}
                                            onChange={(e) =>
                                                handleChange('callsign')(
                                                    e.target.value
                                                )
                                            }
                                            required
                                            placeholder="e.g. DLH123"
                                            className="flex items-center w-full pl-6 p-3 bg-gray-800 border-2 border-blue-600 rounded-full text-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"
                                            maxLength={16}
                                        />
                                    </div>
                                    <div>
                                        <label className="flex items-center mb-2 text-sm font-medium text-gray-300">
                                            <Plane className="h-4 w-4 mr-2 text-gray-400" />
                                            Aircraft Type{' '}
                                            <span className="text-red-400 ml-1">
                                                *
                                            </span>
                                        </label>
                                        <AircraftDropdown
                                            value={form.aircraft_type}
                                            onChange={handleChange(
                                                'aircraft_type'
                                            )}
                                        />
                                    </div>
                                    <div>
                                        <label className="flex items-center mb-2 text-sm font-medium text-gray-300">
                                            <Navigation className="h-4 w-4 mr-2 text-gray-400" />
                                            Flight Type{' '}
                                            <span className="text-red-400 ml-1">
                                                *
                                            </span>
                                        </label>
                                        <Dropdown
                                            value={form.flight_type}
                                            onChange={handleChange(
                                                'flight_type'
                                            )}
                                            placeholder="IFR or VFR"
                                            options={[
                                                { label: 'IFR', value: 'IFR' },
                                                { label: 'VFR', value: 'VFR' },
                                            ]}
                                        />
                                    </div>
                                    <div>
                                        <label className="flex items-center mb-2 text-sm font-medium text-gray-300">
                                            <ParkingCircle className="h-4 w-4 mr-2 text-gray-400" />
                                            Stand
                                        </label>
                                        <input
                                            type="text"
                                            name="stand"
                                            value={form.stand}
                                            onChange={(e) =>
                                                handleChange('stand')(
                                                    e.target.value
                                                )
                                            }
                                            placeholder="e.g. A12"
                                            className="flex items-center w-full pl-6 p-3 bg-gray-800 border-2 border-blue-600 rounded-full text-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <label className="flex items-center mb-2 text-sm font-medium text-gray-300">
                                            <PlaneTakeoff className="h-4 w-4 mr-2 text-gray-400" />
                                            Departure Airport
                                        </label>
                                        <AirportDropdown
                                            value={form.departure}
                                            onChange={handleChange('departure')}
                                            disabled
                                        />
                                    </div>
                                    <div>
                                        <label className="flex items-center mb-2 text-sm font-medium text-gray-300">
                                            <PlaneLanding className="h-4 w-4 mr-2 text-gray-400" />
                                            Arrival Airport{' '}
                                            <span className="text-red-400 ml-1">
                                                *
                                            </span>
                                        </label>
                                        <AirportDropdown
                                            value={form.arrival}
                                            onChange={handleChange('arrival')}
                                        />
                                    </div>
                                    <div>
                                        <label className="flex items-center mb-2 text-sm font-medium text-gray-300">
                                            <ArrowUpDown className="h-4 w-4 mr-2 text-gray-400" />
                                            Cruising Flight Level{' '}
                                            <span className="text-red-400 ml-1">
                                                *
                                            </span>
                                        </label>
                                        <input
                                            type="text"
                                            name="cruisingFL"
                                            value={form.cruisingFL}
                                            onChange={(e) =>
                                                handleChange('cruisingFL')(
                                                    e.target.value
                                                )
                                            }
                                            placeholder="e.g. 350"
                                            className="flex items-center w-full pl-6 p-3 bg-gray-800 border-2 border-blue-600 rounded-full text-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="flex items-center mb-2 text-sm font-medium text-gray-300">
                                    <Route className="h-4 w-4 mr-2 text-gray-400" />
                                    Route
                                </label>
                                <input
                                    type="text"
                                    name="route"
                                    value={form.route}
                                    onChange={(e) =>
                                        handleChange('route')(e.target.value)
                                    }
                                    placeholder="e.g. HAZEL NOVMA LEDGO"
                                    className="flex items-center w-full pl-6 p-3 bg-gray-800 border-2 border-blue-600 rounded-full text-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"
                                />
                            </div>
                            <div>
                                <label className="flex items-center mb-2 text-sm font-medium text-gray-300">
                                    <StickyNote className="h-4 w-4 mr-2 text-gray-400" />
                                    Remarks
                                </label>
                                <input
                                    type="text"
                                    name="remark"
                                    value={form.remark}
                                    onChange={(e) =>
                                        handleChange('remark')(e.target.value)
                                    }
                                    placeholder="Any additional information"
                                    className="flex items-center w-full pl-6 p-3 bg-gray-800 border-2 border-blue-600 rounded-full text-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"
                                />
                            </div>

                            {/* Logbook Checkbox */}
                            <div
                                className={`bg-gray-800/50 rounded-xl border-2 border-gray-700 p-5 transition-all ${
                                    isLogbookDisabled || !hasRobloxLinked
                                        ? 'opacity-50'
                                        : 'hover:border-blue-600/50'
                                }`}
                            >
                                <label
                                    className={`flex items-start ${
                                        isLogbookDisabled || !hasRobloxLinked
                                            ? 'cursor-not-allowed'
                                            : 'cursor-pointer'
                                    }`}
                                >
                                    {/* Custom Checkbox */}
                                    <div className="relative flex-shrink-0 mt-0.5">
                                        <input
                                            type="checkbox"
                                            checked={logWithLogbook}
                                            onChange={(e) =>
                                                setLogWithLogbook(
                                                    e.target.checked
                                                )
                                            }
                                            disabled={
                                                isLogbookDisabled ||
                                                !hasRobloxLinked
                                            }
                                            className="sr-only peer"
                                        />
                                        <div
                                            className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                                                logWithLogbook
                                                    ? 'bg-blue-600 border-blue-600'
                                                    : 'bg-gray-700 border-gray-600'
                                            } ${
                                                isLogbookDisabled ||
                                                !hasRobloxLinked
                                                    ? 'cursor-not-allowed'
                                                    : 'peer-focus:ring-2 peer-focus:ring-blue-500 peer-focus:ring-offset-2 peer-focus:ring-offset-gray-900 cursor-pointer hover:border-blue-500'
                                            }`}
                                        >
                                            {logWithLogbook && (
                                                <Check
                                                    className="h-4 w-4 text-white"
                                                    strokeWidth={3}
                                                />
                                            )}
                                        </div>
                                    </div>

                                    <div className="ml-4 flex-1">
                                        <div className="flex items-center mb-1">
                                            <Notebook className="h-5 w-5 text-blue-400 mr-2" />
                                            <span className="text-base font-semibold text-white">
                                                Log with PFConnect Logbook
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-400 leading-relaxed">
                                            Automatically track your flight with
                                            detailed telemetry, landing rate,
                                            and statistics
                                        </p>
                                    </div>
                                </label>

                                {!hasRobloxLinked && (
                                    <div className="mt-3 ml-10 p-3 bg-yellow-900/20 border border-yellow-700/50 rounded-lg">
                                        <div className="flex items-start justify-between">
                                            <p className="text-xs text-yellow-400 flex items-start flex-1">
                                                <AlertTriangle className="h-3.5 w-3.5 mr-1.5 mt-0.5 flex-shrink-0" />
                                                Link your Roblox account in
                                                Settings to use the logbook
                                            </p>
                                            <a
                                                href="/settings"
                                                className="ml-3 text-xs font-semibold text-yellow-300 hover:text-yellow-200 underline whitespace-nowrap transition-colors"
                                            >
                                                Go to Settings →
                                            </a>
                                        </div>
                                    </div>
                                )}
                                {hasRobloxLinked && isLogbookDisabled && (
                                    <div className="mt-3 ml-10 p-3 bg-gray-700/30 border border-gray-600/50 rounded-lg">
                                        <p className="text-xs text-gray-400">
                                            PFControl LogBook is currently only
                                            available to testers
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="mt-8">
                                <Button
                                    type="submit"
                                    className="w-full flex justify-center items-center bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-full transition-colors disabled:opacity-50"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="animate-spin h-5 w-5 mr-2" />
                                            Submitting...
                                        </>
                                    ) : (
                                        <>
                                            <MapPinCheck className="h-5 w-5 mr-2" />
                                            Submit Flight Plan
                                        </>
                                    )}
                                </Button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
}
