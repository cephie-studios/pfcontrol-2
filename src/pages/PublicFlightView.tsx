import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Loader from '../components/common/Loader';
import {
    Plane,
    Clock,
    MapPin,
    TrendingUp,
    Gauge,
    AlertCircle,
    Share2,
} from 'lucide-react';
import { Line as ChartLine } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip as ChartTooltip,
    Legend as ChartLegend,
    Filler,
} from 'chart.js';
import Navbar from '../components/Navbar';
import Button from '../components/common/Button';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    ChartTooltip,
    ChartLegend,
    Filler
);

interface Flight {
    id: string;
    callsign: string;
    departure_icao: string;
    arrival_icao: string;
    aircraft_icao: string;
    aircraft_model: string | null;
    livery: string | null;
    route: string | null;
    flight_status: string;
    controller_status?: string | null;
    duration_minutes: number | null;
    total_distance_nm: number | null;
    max_altitude_ft: number | null;
    max_speed_kts: number | null;
    average_speed_kts: number | null;
    landing_rate_fpm: number | null;
    landing_score: number | null;
    smoothness_score: number | null;
    created_at: string;
    completed_at: string | null;
    flight_start?: string | null;
    discord_username?: string | null;
    discord_discriminator?: string | null;
    roblox_username?: string | null;
    is_active?: boolean;
    current_altitude?: number | null;
    current_speed?: number | null;
    current_heading?: number | null;
    current_phase?: string | null;
    last_update?: string | null;
    landing_detected?: boolean;
    telemetry_count?: number;
}

interface TelemetryPoint {
    timestamp: string;
    altitude_ft: number;
    speed_kts: number;
    heading: number;
    vertical_speed_fpm: number;
    flight_phase: string;
    x: number;
    y: number;
}

export default function PublicFlightView() {
    const { shareToken } = useParams<{ shareToken: string }>();
    const [flight, setFlight] = useState<Flight | null>(null);
    const [telemetry, setTelemetry] = useState<TelemetryPoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [liveDuration, setLiveDuration] = useState<number | null>(null);
    const [shareClicked, setShareClicked] = useState(false);

    useEffect(() => {
        fetchFlightDetails();
        fetchTelemetry();
    }, [shareToken]);

    useEffect(() => {
        if (!flight) return;

        const isActive =
            flight.is_active &&
            (flight.flight_status === 'active' ||
                flight.flight_status === 'pending');

        if (isActive) {
            const interval = setInterval(() => {
                fetchFlightDetails();
                fetchTelemetry();
            }, 5000);

            return () => clearInterval(interval);
        }
    }, [flight?.is_active, flight?.flight_status]);

    useEffect(() => {
        if (!flight?.is_active || !flight?.created_at) {
            setLiveDuration(null);
            return;
        }

        const updateDuration = () => {
            const now = new Date();
            const start = new Date(flight.created_at);
            const durationMs = now.getTime() - start.getTime();
            const minutes = Math.floor(durationMs / 60000);
            setLiveDuration(minutes);
        };

        updateDuration();
        const interval = setInterval(updateDuration, 1000);

        return () => clearInterval(interval);
    }, [flight?.is_active, flight?.created_at]);

    const fetchFlightDetails = async () => {
        try {
            const res = await fetch(
                `${
                    import.meta.env.VITE_SERVER_URL
                }/api/logbook/public/${shareToken}`
            );
            if (res.ok) {
                const data = await res.json();
                setFlight(data);
            } else {
                setError('Flight not found or link expired');
            }
        } catch {
            setError('Failed to load flight details');
        } finally {
            setLoading(false);
        }
    };

    const fetchTelemetry = async () => {
        try {
            const res = await fetch(
                `${
                    import.meta.env.VITE_SERVER_URL
                }/api/logbook/public/${shareToken}/telemetry`
            );
            if (res.ok) {
                const data = await res.json();

                const seen = new Map<number, TelemetryPoint>();
                const deduplicated = data.filter((point: TelemetryPoint) => {
                    const timestamp = new Date(point.timestamp).getTime();
                    const roundedTime = Math.round(timestamp / 5000) * 5000;

                    if (!seen.has(roundedTime)) {
                        seen.set(roundedTime, point);
                        return true;
                    }
                    return false;
                });

                setTelemetry(deduplicated);
            }
        } catch (err) {
            console.error('Failed to load telemetry:', err);
        }
    };

    const formatDuration = (
        minutes: number | null,
        isLive: boolean = false
    ) => {
        if (minutes === null || minutes === undefined) return 'N/A';
        if (minutes < 1 && !isLive) return 'N/A';
        if (minutes < 1) return '0m';
        const totalMinutes = Math.floor(minutes);
        const hours = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    };

    const getLandingGrade = (fpm: number | null) => {
        if (!fpm)
            return {
                text: 'N/A',
                color: 'text-gray-400',
                bg: 'bg-gradient-to-br from-gray-800/50 to-gray-900/50',
                border: 'border-gray-700',
                glow: '',
            };

        const rate = Math.abs(fpm);

        if (rate < 100)
            return {
                text: 'Butter',
                color: 'text-yellow-400',
                bg: 'bg-gradient-to-br from-yellow-900/30 to-orange-900/30',
                border: 'border-yellow-500/50',
                glow: 'shadow-lg shadow-yellow-500/20',
            };
        if (rate < 300)
            return {
                text: 'Smooth',
                color: 'text-green-400',
                bg: 'bg-gradient-to-br from-green-900/30 to-emerald-900/30',
                border: 'border-green-500/50',
                glow: 'shadow-lg shadow-green-500/20',
            };
        if (rate < 600)
            return {
                text: 'Firm',
                color: 'text-blue-400',
                bg: 'bg-gradient-to-br from-blue-900/30 to-cyan-900/30',
                border: 'border-blue-500/50',
                glow: 'shadow-lg shadow-blue-500/20',
            };
        if (rate < 1000)
            return {
                text: 'Hard',
                color: 'text-orange-400',
                bg: 'bg-gradient-to-br from-orange-900/30 to-red-900/30',
                border: 'border-orange-500/50',
                glow: 'shadow-lg shadow-orange-500/20',
            };
        return {
            text: 'Crash',
            color: 'text-red-400',
            bg: 'bg-gradient-to-br from-red-900/30 to-rose-900/30',
            border: 'border-red-500/50',
            glow: 'shadow-lg shadow-red-500/20',
        };
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <Loader />
            </div>
        );
    }

    if (error || !flight) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <div className="bg-red-900/20 border-2 border-red-500/50 rounded-xl p-6 max-w-md">
                    <div className="flex items-center gap-3 mb-4">
                        <AlertCircle className="h-6 w-6 text-red-400" />
                        <h2 className="text-xl font-bold text-red-200">
                            Error
                        </h2>
                    </div>
                    <p className="text-red-200 font-semibold">
                        {error || 'Flight not found'}
                    </p>
                </div>
            </div>
        );
    }

    const landingGrade = getLandingGrade(flight.landing_rate_fpm);
    const isActive =
        flight.is_active &&
        (flight.flight_status === 'active' ||
            flight.flight_status === 'pending');

    const getPhaseColor = (phase: string | null | undefined) => {
        const colors: Record<string, string> = {
            awaiting_clearance: 'text-cyan-400 bg-cyan-900/30',
            origin_taxi: 'text-gray-400 bg-gray-900/50',
            destination_taxi: 'text-gray-400 bg-gray-900/50',
            taxi: 'text-gray-400 bg-gray-900/50',
            origin_runway: 'text-pink-400 bg-pink-900/30',
            destination_runway: 'text-pink-400 bg-pink-900/30',
            runway: 'text-pink-400 bg-pink-900/30',
            climb: 'text-blue-400 bg-blue-900/30',
            cruise: 'text-purple-400 bg-purple-900/30',
            descent: 'text-yellow-400 bg-yellow-900/30',
            approach: 'text-orange-400 bg-orange-900/30',
            landing: 'text-red-400 bg-red-900/30',
            push: 'text-indigo-400 bg-indigo-900/30',
            parked: 'text-slate-400 bg-slate-900/30',
        };
        return colors[phase || ''] || 'text-gray-400 bg-gray-900/50';
    };

    return (
        <div className="min-h-screen bg-gray-950 text-white">
            <Navbar />

            {/* Flight Header */}
            <div className="relative w-full bg-gradient-to-br from-blue-900/40 via-purple-900/30 to-gray-900/40 border-b-2 border-blue-800/30 py-6 pt-16">
                <div className="absolute inset-0 bg-[url('/assets/app/backgrounds/mdpc_01.png')] bg-cover bg-center opacity-10"></div>
                <div className="relative container mx-auto max-w-6xl px-4 py-8">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                        {/* Flight Info */}
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-blue-500/20 rounded-xl">
                                <Plane className="h-8 w-8 text-blue-400" />
                            </div>
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white">
                                        {flight.callsign}
                                    </h1>
                                </div>
                                <p className="text-gray-300 text-lg">
                                    {flight.aircraft_model ||
                                        flight.aircraft_icao ||
                                        'Unknown Aircraft'}
                                </p>
                                {flight.discord_username && (
                                    <p className="text-blue-200 text-med mt-1">
                                        @{flight.discord_username}
                                        {flight.discord_discriminator &&
                                            flight.discord_discriminator !==
                                                '0' &&
                                            `#${flight.discord_discriminator}`}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Route */}
                        <div className="flex items-center gap-4 self-center md:self-auto">
                            <span className="px-4 py-2 bg-blue-500/20 rounded-lg font-mono font-bold text-blue-300 text-lg md:text-xl">
                                {flight.departure_icao}
                            </span>
                            <div className="flex items-center gap-2">
                                <span className="text-gray-500">→</span>
                            </div>
                            <span className="px-4 py-2 bg-purple-500/20 rounded-lg font-mono font-bold text-purple-300 text-lg md:text-xl">
                                {flight.arrival_icao}
                            </span>
                            <Button
                                onClick={() => {
                                    const flightUrl = window.location.href;
                                    navigator.clipboard.writeText(flightUrl);
                                    setShareClicked(true);
                                    setTimeout(
                                        () => setShareClicked(false),
                                        2000
                                    );
                                }}
                                className="flex items-center gap-2 ml-4"
                                variant={shareClicked ? 'success' : 'outline'}
                            >
                                <Share2 className="w-4 h-4" />
                                <span className="hidden md:inline">
                                    {shareClicked ? 'Copied!' : 'Share'}
                                </span>
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Flight Stats */}
            <div className="container mx-auto max-w-6xl px-4 py-8">
                {/* Real-Time Status for Active Flights */}
                {isActive && (
                    <div className="bg-gradient-to-br from-green-900/20 via-blue-900/20 to-purple-900/20 backdrop-blur-sm rounded-xl border-2 border-green-700/40 p-6 mb-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-green-500/20 rounded-lg">
                                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                            </div>
                            <h2 className="text-2xl font-bold text-white">
                                Live Flight Status
                            </h2>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-gradient-to-br from-gray-900/80 to-gray-900/40 rounded-xl p-4 border-2 border-gray-700/50">
                                <p className="text-xs text-gray-400 mb-2">
                                    Current Phase
                                </p>
                                <div
                                    className={`inline-block px-3 py-1.5 rounded-lg font-semibold text-sm capitalize ${getPhaseColor(
                                        flight.current_phase
                                    )}`}
                                >
                                    {flight.current_phase?.replace(/_/g, ' ') ||
                                        'Pending'}
                                </div>
                            </div>
                            <div className="bg-gradient-to-br from-gray-900/80 to-gray-900/40 rounded-xl p-4 border-2 border-gray-700/50">
                                <p className="text-xs text-gray-400 mb-2">
                                    Altitude
                                </p>
                                <p className="text-xl font-bold text-white">
                                    {flight.current_altitude !== null &&
                                    flight.current_altitude !== undefined
                                        ? `${Math.round(
                                              flight.current_altitude
                                          ).toLocaleString()}`
                                        : '---'}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">ft</p>
                            </div>
                            <div className="bg-gradient-to-br from-gray-900/80 to-gray-900/40 rounded-xl p-4 border-2 border-gray-700/50">
                                <p className="text-xs text-gray-400 mb-2">
                                    Speed
                                </p>
                                <p className="text-xl font-bold text-white">
                                    {flight.current_speed !== null &&
                                    flight.current_speed !== undefined
                                        ? `${Math.round(flight.current_speed)}`
                                        : '---'}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                    kts
                                </p>
                            </div>
                            <div className="bg-gradient-to-br from-gray-900/80 to-gray-900/40 rounded-xl p-4 border-2 border-gray-700/50">
                                <p className="text-xs text-gray-400 mb-2">
                                    Duration
                                </p>
                                <p className="text-xl font-bold text-white">
                                    {formatDuration(
                                        liveDuration ?? flight.duration_minutes,
                                        true
                                    )}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Flight Statistics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-gray-900/50 rounded-xl p-4 border-2 border-gray-800">
                        <div className="flex items-center gap-2 mb-2">
                            <Clock className="h-4 w-4 text-blue-400" />
                            <p className="text-xs text-gray-400">Duration</p>
                        </div>
                        <p className="text-2xl font-bold text-white">
                            {formatDuration(
                                liveDuration ?? flight.duration_minutes,
                                isActive
                            )}
                        </p>
                    </div>

                    <div className="bg-gray-900/50 rounded-xl p-4 border-2 border-gray-800">
                        <div className="flex items-center gap-2 mb-2">
                            <MapPin className="h-4 w-4 text-purple-400" />
                            <p className="text-xs text-gray-400">Distance</p>
                        </div>
                        <p className="text-2xl font-bold text-white">
                            {flight.total_distance_nm !== null
                                ? `${flight.total_distance_nm}`
                                : '---'}
                        </p>
                        <p className="text-xs text-gray-500">nm</p>
                    </div>

                    <div className="bg-gray-900/50 rounded-xl p-4 border-2 border-gray-800">
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="h-4 w-4 text-green-400" />
                            <p className="text-xs text-gray-400">
                                Max Altitude
                            </p>
                        </div>
                        <p className="text-2xl font-bold text-white">
                            {flight.max_altitude_ft !== null
                                ? `${flight.max_altitude_ft.toLocaleString()}`
                                : '---'}
                        </p>
                        <p className="text-xs text-gray-500">ft</p>
                    </div>

                    <div className="bg-gray-900/50 rounded-xl p-4 border-2 border-gray-800">
                        <div className="flex items-center gap-2 mb-2">
                            <Gauge className="h-4 w-4 text-yellow-400" />
                            <p className="text-xs text-gray-400">Avg Speed</p>
                        </div>
                        <p className="text-2xl font-bold text-white">
                            {flight.average_speed_kts !== null
                                ? `${flight.average_speed_kts}`
                                : '---'}
                        </p>
                        <p className="text-xs text-gray-500">kts</p>
                    </div>
                </div>

                {/* Landing Rate (for completed flights) */}
                {flight.landing_rate_fpm !== null && !isActive && (
                    <div
                        className={`${landingGrade.bg} border-2 ${landingGrade.border} rounded-xl px-8 py-5 mb-6 backdrop-blur-sm text-center ${landingGrade.glow}`}
                    >
                        <p className="text-sm text-gray-400 mb-1">
                            Landing Rate
                        </p>
                        <p
                            className={`text-4xl font-bold ${landingGrade.color} tracking-tight`}
                        >
                            {flight.landing_rate_fpm} fpm
                        </p>
                        <p
                            className={`text-lg font-semibold ${landingGrade.color} mt-2`}
                        >
                            {landingGrade.text}
                        </p>
                    </div>
                )}

                {/* Landing Rate (for active flights when controller has set destination status) */}
                {isActive &&
                    flight.landing_rate_fpm !== null &&
                    flight.controller_status &&
                    ['destination_runway', 'destination_taxi', 'gate'].includes(
                        flight.controller_status.toLowerCase()
                    ) && (
                        <div
                            className={`${landingGrade.bg} border-2 ${landingGrade.border} rounded-xl px-8 py-5 mb-6 backdrop-blur-sm text-center ${landingGrade.glow}`}
                        >
                            <p className="text-sm text-gray-400 mb-1">
                                Landing Rate
                            </p>
                            <p
                                className={`text-3xl font-bold ${landingGrade.color} tracking-tight`}
                            >
                                {flight.landing_rate_fpm} fpm
                            </p>
                            <p
                                className={`text-lg font-semibold ${landingGrade.color} mt-2`}
                            >
                                {landingGrade.text}
                            </p>
                        </div>
                    )}

                {/* Altitude & Speed Graph */}
                {telemetry.length > 0 && (
                    <div className="mb-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-orange-500/20 rounded-lg">
                                <TrendingUp className="h-5 w-5 text-orange-400" />
                            </div>
                            <h2 className="text-2xl font-bold text-white">
                                Speed & Altitude Graph
                            </h2>
                            {isActive && (
                                <span className="text-sm text-yellow-400 flex items-center gap-2 ml-auto">
                                    <Clock className="h-4 w-4" />
                                    Updates in real-time
                                </span>
                            )}
                        </div>
                        <div className="bg-gray-950 backdrop-blur-sm rounded-xl border-2 border-gray-800 p-6">
                            <div className="bg-gray-800/20 rounded-lg p-4">
                                <ChartLine
                                    data={{
                                        labels: telemetry.map(
                                            (t) =>
                                                new Date(
                                                    t.timestamp
                                                ).toLocaleTimeString('en-US', {
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                    second: '2-digit',
                                                    timeZone: 'UTC',
                                                }) + ' UTC'
                                        ),
                                        datasets: [
                                            {
                                                label: 'Altitude (ft)',
                                                data: telemetry.map(
                                                    (t) => t.altitude_ft
                                                ),
                                                borderColor: '#e8ad2c',
                                                backgroundColor:
                                                    'rgba(245, 158, 11, 0.2)',
                                                fill: true,
                                                tension: 0.7,
                                                borderWidth: 3,
                                                pointRadius: 0,
                                                pointHoverRadius: 6,
                                                pointBackgroundColor: '#e8ad2c',
                                                pointBorderColor: '#e8ad2c',
                                                pointHoverBackgroundColor:
                                                    '#FBBF24',
                                                pointHoverBorderColor:
                                                    '#e8ad2c',
                                                yAxisID: 'y',
                                            },
                                            {
                                                label: 'Speed (kts)',
                                                data: telemetry.map(
                                                    (t) => t.speed_kts
                                                ),
                                                borderColor: '#3B82F6',
                                                backgroundColor:
                                                    'rgba(59, 130, 246, 0.1)',
                                                fill: true,
                                                tension: 0.7,
                                                borderWidth: 3,
                                                pointRadius: 0,
                                                pointHoverRadius: 6,
                                                pointBackgroundColor: '#3B82F6',
                                                pointBorderColor: '#1E40AF',
                                                pointHoverBackgroundColor:
                                                    '#60A5FA',
                                                pointHoverBorderColor:
                                                    '#1E40AF',
                                                yAxisID: 'y1',
                                            },
                                        ],
                                    }}
                                    options={{
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        animation: {
                                            duration: 1500,
                                            easing: 'easeInOutQuart',
                                        },
                                        interaction: {
                                            mode: 'index' as const,
                                            intersect: false,
                                        },
                                        plugins: {
                                            legend: {
                                                position: 'bottom' as const,
                                                labels: {
                                                    color: '#F9FAFB',
                                                    font: { size: 12 },
                                                    padding: 15,
                                                    usePointStyle: true,
                                                },
                                            },
                                            tooltip: {
                                                backgroundColor:
                                                    'rgba(17, 24, 39, 0.95)',
                                                titleColor: '#F9FAFB',
                                                bodyColor: '#D1D5DB',
                                                borderColor: '#374151',
                                                borderWidth: 1,
                                                cornerRadius: 8,
                                                displayColors: true,
                                                mode: 'index' as const,
                                                intersect: false,
                                                padding: 12,
                                                caretPadding: 10,
                                                caretSize: 6,
                                                bodyFont: {
                                                    size: 13,
                                                },
                                                titleFont: {
                                                    size: 14,
                                                    weight: 'bold' as const,
                                                },
                                            },
                                        },
                                        scales: {
                                            x: {
                                                grid: {
                                                    color: 'rgba(55, 65, 81, 0.3)',
                                                },
                                                ticks: {
                                                    color: '#9CA3AF',
                                                    font: { size: 11 },
                                                    maxRotation: 0,
                                                    autoSkipPadding: 50,
                                                },
                                            },
                                            y: {
                                                type: 'linear' as const,
                                                position: 'left' as const,
                                                title: {
                                                    display: true,
                                                    text: 'Altitude (ft)',
                                                    color: '#e8ad2c',
                                                    font: {
                                                        size: 12,
                                                        weight: 'bold' as const,
                                                    },
                                                },
                                                grid: {
                                                    color: 'rgba(55, 65, 81, 0.3)',
                                                },
                                                ticks: {
                                                    color: '#e8ad2c',
                                                    font: { size: 11 },
                                                },
                                            },
                                            y1: {
                                                type: 'linear' as const,
                                                position: 'right' as const,
                                                title: {
                                                    display: true,
                                                    text: 'Speed (kts)',
                                                    color: '#3B82F6',
                                                    font: {
                                                        size: 12,
                                                        weight: 'bold' as const,
                                                    },
                                                },
                                                grid: {
                                                    drawOnChartArea: false,
                                                },
                                                ticks: {
                                                    color: '#3B82F6',
                                                    font: { size: 11 },
                                                },
                                            },
                                        },
                                        elements: {
                                            line: {
                                                borderWidth: 3,
                                            },
                                        },
                                    }}
                                    height={400}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="text-center text-gray-500 text-sm mt-8">
                    <p>Shared from PFControl Logbook</p>
                    <p className="mt-2">
                        <a
                            href="https://control.pfconnect.online/logbook"
                            className="text-blue-400 hover:text-blue-300"
                        >
                            View your own flights at PFControl
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
}
