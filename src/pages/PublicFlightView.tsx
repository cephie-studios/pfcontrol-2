import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import Loader from '../components/common/Loader';
import {
    Plane,
    Clock,
    MapPin,
    TrendingUp,
    Gauge,
    Share2,
    Timer,
    ArrowUp,
    ArrowDown,
    Car,
    Home,
    ArrowRight,
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
import AccessDenied from '../components/AccessDenied';
import {
    fetchFlightDetails,
    fetchTelemetry,
} from '../utils/fetch/publicFlight';
import {
    formatDuration,
    getLandingGrade,
    calculatePhases,
} from '../utils/publicFlight';
import type { Flight } from '../types/publicFlight';
import type { TelemetryPoint } from '../types/publicFlight';

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

export default function PublicFlightView() {
    const { shareToken } = useParams<{ shareToken: string }>();
    const [flight, setFlight] = useState<Flight | null>(null);
    const [telemetry, setTelemetry] = useState<TelemetryPoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [liveDuration, setLiveDuration] = useState<number | null>(null);
    const [shareClicked, setShareClicked] = useState(false);

    const phases = useMemo(() => calculatePhases(telemetry), [telemetry]);

    useEffect(() => {
        fetchFlightDetailsWrapper();
        fetchTelemetryWrapper();
    }, [shareToken]);

    useEffect(() => {
        if (!flight) return;

        const isActive =
            flight.is_active &&
            (flight.flight_status === 'active' ||
                flight.flight_status === 'pending');

        if (isActive) {
            const interval = setInterval(() => {
                fetchFlightDetailsWrapper();
                fetchTelemetryWrapper();
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

    const fetchFlightDetailsWrapper = async () => {
        try {
            const data = await fetchFlightDetails(shareToken || '');
            setFlight(data);
        } catch (err) {
            if (err && typeof err === 'object' && 'message' in err) {
                setError(
                    (err as { message: string }).message ||
                        'Failed to load flight details'
                );
            } else {
                setError('Failed to load flight details');
            }
        } finally {
            setLoading(false);
        }
    };

    const fetchTelemetryWrapper = async () => {
        try {
            const data = await fetchTelemetry(shareToken || '');
            setTelemetry(data);
        } catch (err) {
            console.error('Failed to load telemetry:', err);
        }
    };

    const landingGrade = getLandingGrade(
        flight?.landing_rate_fpm === undefined ? null : flight.landing_rate_fpm
    );
    const isActive =
        !!flight &&
        flight.is_active &&
        (flight.flight_status === 'active' ||
            flight.flight_status === 'pending');

    if (loading) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
                <Loader />
            </div>
        );
    }

    if (error || !flight) {
        return (
            <AccessDenied
                errorType="flight-not-found"
                message={error || 'Flight not found'}
            />
        );
    }

    const getPhaseColor = (phase: string | null | undefined) => {
        const colors: Record<string, string> = {
            awaiting_clearance: 'text-cyan-400 bg-cyan-900/30',
            origin_taxi: 'text-zinc-400 bg-zinc-900/50',
            destination_taxi: 'text-zinc-400 bg-zinc-900/50',
            taxi: 'text-zinc-400 bg-zinc-900/50',
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
        return colors[phase || ''] || 'text-zinc-400 bg-zinc-900/50';
    };

    return (
        <div className="min-h-screen bg-zinc-950 text-white">
            <Navbar />

            <div className="bg-gradient-to-b from-zinc-800 to-zinc-900 border-b border-zinc-700/50 py-8 md:py-12">
                <div className="pt-20 pb-4">
                    <div className="max-w-7xl mx-auto px-4">
                        <div className="flex flex-col md:flex-row md:items-center gap-6">
                            <div className="flex-1 text-center md:text-left">
                                <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
                                    {flight.callsign}
                                </h1>
                                <div className="flex flex-row gap-4">
                                    <p className="text-blue-300/80 text-base">
                                        {flight.aircraft_model ||
                                            flight.aircraft_icao ||
                                            'Unknown Aircraft'}
                                    </p>
                                    {flight.discord_username && (
                                        <div className="flex items-center gap-2 justify-center md:justify-start">
                                            <span className="text-zinc-400 text-base">
                                                Pilot:
                                            </span>
                                            <a
                                                href={`${window.location.origin}/pilots/${flight.discord_username}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-base text-blue-300 hover:underline hover:text-blue-200"
                                            >
                                                @{flight.discord_username}
                                                {flight.discord_discriminator &&
                                                    flight.discord_discriminator !==
                                                        '0' &&
                                                    `#${flight.discord_discriminator}`}
                                            </a>
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-col md:flex-row gap-2 md:gap-4 justify-center md:justify-start mt-2">
                                    <div className="flex items-center gap-2 text-zinc-400 justify-center md:justify-start">
                                        <MapPin className="h-5 w-5" />
                                        <span className="text-base md:text-lg">
                                            {flight.departure_icao} →{' '}
                                            {flight.arrival_icao}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <Button
                                onClick={() => {
                                    navigator.clipboard.writeText(
                                        window.location.href
                                    );
                                    setShareClicked(true);
                                    setTimeout(
                                        () => setShareClicked(false),
                                        2000
                                    );
                                }}
                                className="flex items-center gap-2 self-center md:self-auto"
                                variant={shareClicked ? 'success' : 'outline'}
                            >
                                <Share2 className="w-4 h-4" />
                                <span>
                                    {shareClicked ? 'Copied!' : 'Share'}
                                </span>
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-8">
                {isActive && (
                    <div className="bg-gradient-to-br from-green-800 via-zinc-900 to-zinc-950 backdrop-blur-sm rounded-xl border-2 border-green-700/70 p-6 mb-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-green-500/20 rounded-lg">
                                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                            </div>
                            <h2 className="text-2xl font-bold text-white">
                                Live Flight Status
                            </h2>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-gradient-to-br from-zinc-900/80 to-zinc-900/40 rounded-xl p-4 border-2 border-zinc-700/50">
                                <p className="text-xs text-zinc-400 mb-2">
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
                            <div className="bg-gradient-to-br from-zinc-900/80 to-zinc-900/40 rounded-xl p-4 border-2 border-zinc-700/50">
                                <p className="text-xs text-zinc-400 mb-2">
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
                                <p className="text-xs text-zinc-500 mt-1">ft</p>
                            </div>
                            <div className="bg-gradient-to-br from-zinc-900/80 to-zinc-900/40 rounded-xl p-4 border-2 border-zinc-700/50">
                                <p className="text-xs text-zinc-400 mb-2">
                                    Speed
                                </p>
                                <p className="text-xl font-bold text-white">
                                    {flight.current_speed !== null &&
                                    flight.current_speed !== undefined
                                        ? `${Math.round(flight.current_speed)}`
                                        : '---'}
                                </p>
                                <p className="text-xs text-zinc-500 mt-1">
                                    kts
                                </p>
                            </div>
                            <div className="bg-gradient-to-br from-zinc-900/80 to-zinc-900/40 rounded-xl p-4 border-2 border-zinc-700/50">
                                <p className="text-xs text-zinc-400 mb-2">
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

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-zinc-900/50 rounded-xl p-4 border-2 border-zinc-800">
                        <div className="flex items-center gap-2 mb-2">
                            <Clock className="h-4 w-4 text-blue-400" />
                            <p className="text-xs text-zinc-400">Duration</p>
                        </div>
                        <p className="text-2xl font-bold text-white">
                            {formatDuration(
                                liveDuration ?? flight.duration_minutes,
                                isActive
                            )}
                        </p>
                    </div>

                    <div className="bg-zinc-900/50 rounded-xl p-4 border-2 border-zinc-800">
                        <div className="flex items-center gap-2 mb-2">
                            <MapPin className="h-4 w-4 text-purple-400" />
                            <p className="text-xs text-zinc-400">Distance</p>
                        </div>
                        <p className="text-2xl font-bold text-white">
                            {flight.total_distance_nm !== null
                                ? `${flight.total_distance_nm}`
                                : '---'}
                        </p>
                        <p className="text-xs text-zinc-500">nm</p>
                    </div>

                    <div className="bg-zinc-900/50 rounded-xl p-4 border-2 border-zinc-800">
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="h-4 w-4 text-green-400" />
                            <p className="text-xs text-zinc-400">
                                Max Altitude
                            </p>
                        </div>
                        <p className="text-2xl font-bold text-white">
                            {flight.max_altitude_ft !== null
                                ? `${flight.max_altitude_ft.toLocaleString()}`
                                : '---'}
                        </p>
                        <p className="text-xs text-zinc-500">ft</p>
                    </div>

                    <div className="bg-zinc-900/50 rounded-xl p-4 border-2 border-zinc-800">
                        <div className="flex items-center gap-2 mb-2">
                            <Gauge className="h-4 w-4 text-yellow-400" />
                            <p className="text-xs text-zinc-400">Avg Speed</p>
                        </div>
                        <p className="text-2xl font-bold text-white">
                            {flight.average_speed_kts !== null
                                ? `${flight.average_speed_kts}`
                                : '---'}
                        </p>
                        <p className="text-xs text-zinc-500">kts</p>
                    </div>
                </div>

                {/* Landing Rate (for completed flights) */}
                {flight.landing_rate_fpm !== null && !isActive && (
                    <div
                        className={`${landingGrade.bg} border-2 ${landingGrade.border} rounded-xl px-8 py-5 mb-6 backdrop-blur-sm text-center ${landingGrade.glow}`}
                    >
                        <p className="text-sm text-zinc-400 mb-1">
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
                            <p className="text-sm text-zinc-400 mb-1">
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
                        <div className="bg-zinc-950 backdrop-blur-sm rounded-xl border-2 border-zinc-800 p-6">
                            <div className="bg-zinc-800/20 rounded-lg p-4">
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

                {/* Flight Phases Timeline */}
                {phases.length > 0 && (
                    <div className="mb-6">
                        <div className="flex items-center gap-3 mb-4 ">
                            <div className="p-2 bg-blue-500/20 rounded-lg">
                                <Timer className="h-5 w-5 text-blue-400" />
                            </div>
                            <h2 className="text-2xl font-bold text-white">
                                Flight Timeline
                            </h2>
                        </div>
                        <div className="bg-zinc-900/50 rounded-xl border-2 border-zinc-800 p-6 overflow-x-auto">
                            <div className="flex items-center">
                                {phases.map((item, index, array) => {
                                    type PhaseColor = {
                                        bg: string;
                                        text: string;
                                        baseColor: string;
                                        icon: React.ComponentType<{
                                            className?: string;
                                        }>;
                                    };
                                    const phaseColor: Record<
                                        string,
                                        PhaseColor
                                    > = {
                                        taxi: {
                                            bg: 'bg-yellow-500/10',
                                            text: 'text-yellow-300',
                                            baseColor: 'yellow-500',
                                            icon: Car,
                                        },
                                        runway: {
                                            bg: 'bg-orange-500/10',
                                            text: 'text-orange-300',
                                            baseColor: 'orange-500',
                                            icon: Plane,
                                        },
                                        takeoff: {
                                            bg: 'bg-rose-500/10',
                                            text: 'text-rose-300',
                                            baseColor: 'rose-500',
                                            icon: Plane,
                                        },
                                        climb: {
                                            bg: 'bg-blue-500/10',
                                            text: 'text-blue-300',
                                            baseColor: 'blue-500',
                                            icon: ArrowUp,
                                        },
                                        cruise: {
                                            bg: 'bg-purple-500/10',
                                            text: 'text-purple-300',
                                            baseColor: 'purple-500',
                                            icon: Plane,
                                        },
                                        descent: {
                                            bg: 'bg-yellow-500/10',
                                            text: 'text-yellow-300',
                                            baseColor: 'yellow-500',
                                            icon: ArrowDown,
                                        },
                                        approach: {
                                            bg: 'bg-orange-500/10',
                                            text: 'text-orange-300',
                                            baseColor: 'orange-500',
                                            icon: Plane,
                                        },
                                        landing: {
                                            bg: 'bg-rose-500/10',
                                            text: 'text-rose-300',
                                            baseColor: 'rose-500',
                                            icon: Plane,
                                        },
                                        gate: {
                                            bg: 'bg-green-500/10',
                                            text: 'text-green-300',
                                            baseColor: 'green-500',
                                            icon: Home,
                                        },
                                        push: {
                                            bg: 'bg-indigo-700/20',
                                            text: 'text-indigo-300',
                                            baseColor: 'indigo-500',
                                            icon: ArrowRight,
                                        },
                                    };
                                    const colors: PhaseColor = phaseColor[
                                        item.phase
                                    ] || {
                                        bg: 'bg-zinc-500/20',
                                        text: 'text-zinc-300',
                                        baseColor: 'zinc-500',
                                        icon: Plane,
                                    };
                                    const nextPhase =
                                        index < array.length - 1
                                            ? array[index + 1].phase
                                            : null;
                                    const nextColors = nextPhase
                                        ? phaseColor[nextPhase] || {
                                              baseColor: 'zinc-500',
                                          }
                                        : null;
                                    const lineGradient = nextColors
                                        ? `bg-gradient-to-r from-${colors.baseColor} to-${nextColors.baseColor}`
                                        : `bg-${colors.baseColor}`;
                                    const displayPhase = item.phase.replace(
                                        /_/g,
                                        ' '
                                    );
                                    const IconComponent = colors.icon;
                                    return (
                                        <div
                                            key={index}
                                            className="flex items-center"
                                        >
                                            <div
                                                className={`relative text-center min-w-[140px] px-4 py-3 rounded-xl ${colors.bg} border-2 border-zinc-700/50 backdrop-blur-sm`}
                                            >
                                                <IconComponent
                                                    className={`absolute inset-0 w-full h-full opacity-10 ${colors.text}`}
                                                />
                                                <div className="relative z-10">
                                                    <h3
                                                        className={`text-sm font-bold ${colors.text} capitalize mb-2`}
                                                    >
                                                        {displayPhase}
                                                    </h3>
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center justify-center gap-1 text-xs text-zinc-400">
                                                            <Clock className="w-3 h-3" />
                                                            {item.startTime.toLocaleTimeString(
                                                                'en-US',
                                                                {
                                                                    hour: '2-digit',
                                                                    minute: '2-digit',
                                                                    timeZone:
                                                                        'UTC',
                                                                }
                                                            )}
                                                        </div>
                                                        {item.phase !==
                                                            'gate' && (
                                                            <div className="text-xs font-semibold text-zinc-300">
                                                                {item.duration}{' '}
                                                                min
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            {index < array.length - 1 && (
                                                <div
                                                    className={`h-1 w-20 mx-2 ${lineGradient} rounded-full shadow-sm`}
                                                ></div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="text-center text-zinc-500 text-sm mt-8">
                    <p>Shared from PFControl Logbook</p>
                    <p className="mt-2">
                        <a
                            href="https://control.pfconnect.online/logbook"
                            className="text-blue-400 hover:text-blue-300"
                        >
                            View your own flights
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
}
