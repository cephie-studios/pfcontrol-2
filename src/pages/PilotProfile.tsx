import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Loader from '../components/common/Loader';
import {
    User,
    Plane,
    Clock,
    MapPin,
    Award,
    Calendar,
    TrendingUp,
    AlertCircle,
    Shield,
    Star,
    Wrench,
    FlaskConical,
    Crown,
    Zap,
    Target,
    Heart,
    Sparkles,
    Flame,
    Trophy,
    Braces,
    Share2,
    TowerControl,
} from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import Button from '../components/common/Button';
import { useNavigate } from 'react-router-dom';
ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
);

interface Role {
    id: number;
    name: string;
    description: string | null;
    color: string;
    icon: string;
    priority: number;
}

interface PilotProfile {
    user: {
        id: string;
        username: string;
        discriminator: string;
        avatar: string | null;
        roblox_username: string | null;
        roblox_user_id?: string | null;
        vatsim_cid: string | null;
        vatsim_rating_short: string | null;
        vatsim_rating_long: string | null;
        member_since: string;
        is_admin: boolean;
        roles: Role[];
        role_name: string | null;
        role_description: string | null;
    };
    stats: {
        total_flights: number;
        total_hours: number;
        total_flight_time_minutes: number;
        total_distance_nm: number;
        favorite_aircraft: string | null;
        favorite_departure: string | null;
        best_landing_rate: number | null;
        average_landing_score: number | null;
        highest_altitude: number | null;
        longest_flight_distance: number | null;
    };
    recentFlights: Array<{
        id: number;
        callsign: string;
        aircraft_model: string | null;
        aircraft_icao: string | null;
        departure_icao: string;
        arrival_icao: string;
        duration_minutes: number | null;
        total_distance_nm: number | null;
        landing_rate_fpm: number | null;
        flight_end: string;
    }>;
    activityData: Array<{
        month: string;
        flight_count: number;
        total_minutes: number;
    }>;
}

export default function PilotProfile() {
    const { username } = useParams<{ username: string }>();
    const [profile, setProfile] = useState<PilotProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [shareClicked, setShareClicked] = useState(false);
    const navigate = useNavigate()
    useEffect(() => {
        fetchProfile();
    }, [username]);

    const handleShareProfile = () => {
        const profileUrl = `${window.location.origin}/pilots/${username}`;
        navigator.clipboard.writeText(profileUrl);
        setShareClicked(true);
        setTimeout(() => setShareClicked(false), 2000);
    };
const handleShareFlight = async (flightid: string): Promise<string> => {
    try {
        const res = await fetch(
            `${import.meta.env.VITE_SERVER_URL}/api/logbook/flights/${flightid}/share`,
            {
                method: 'POST',
                credentials: 'include',
            }
        );
        if (!res.ok) return '';
        const data = await res.json();
        if (data.shareToken) return `/flight/${data.shareToken}`;
        if (data.shareUrl) {
            try {
                const u = new URL(data.shareUrl);
                return u.pathname || data.shareUrl;
            } catch {
                return data.shareUrl;
            }
        }
    } catch (e) {
        console.error(e);
    }
    return '';
};
    const fetchProfile = async () => {
        try {
            const res = await fetch(
                `${
                    import.meta.env.VITE_SERVER_URL
                }/api/logbook/pilot/${username}`
            );
            if (res.ok) {
                const data = await res.json();
                setProfile(data);
            } else {
                setError('Pilot not found');
            }
        } catch {
            setError('Failed to load pilot profile');
        } finally {
            setLoading(false);
        }
    };

    const getDiscordAvatar = (userId: string, avatarHash: string | null) => {
        if (!avatarHash) {
            return `https://cdn.discordapp.com/embed/avatars/${
                parseInt(userId) % 5
            }.png`;
        }
        return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.png?size=256`;
    };

    const formatDuration = (minutes: number | null) => {
        if (!minutes) return 'N/A';
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    };

    const getLandingGrade = (fpm: number | null) => {
        if (!fpm) return { text: 'N/A', color: 'text-gray-400' };
        const rate = Math.abs(fpm);
        if (rate < 100) return { text: 'Butter', color: 'text-yellow-400' };
        if (rate < 300) return { text: 'Smooth', color: 'text-green-400' };
        if (rate < 600) return { text: 'Firm', color: 'text-blue-400' };
        if (rate < 1000) return { text: 'Hard', color: 'text-orange-400' };
        return { text: 'Crash', color: 'text-red-400' };
    };

    const getIconComponent = (iconName: string) => {
        const icons: Record<
            string,
            React.ComponentType<{
                className?: string;
                style?: React.CSSProperties;
            }>
        > = {
            Shield,
            Star,
            Wrench,
            Award,
            User,
            TrendingUp,
            FlaskConical,
            Crown,
            Zap,
            Target,
            TowerControl,
            Heart,
            Sparkles,
            Flame,
            Trophy,
        };
        return icons[iconName] || Star;
    };

    const getRoleBadge = (role: Role) => {
        const IconComponent = getIconComponent(role.icon);

        const hexToRgb = (hex: string) => {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(
                hex
            );
            return result
                ? {
                      r: parseInt(result[1], 16),
                      g: parseInt(result[2], 16),
                      b: parseInt(result[3], 16),
                  }
                : { r: 99, g: 102, b: 241 };
        };

        const rgb = hexToRgb(role.color);

        return {
            icon: IconComponent,
            text: role.name,
            color: role.color,
            rgb: `${rgb.r}, ${rgb.g}, ${rgb.b}`,
        };
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <Loader />
            </div>
        );
    }

    if (error || !profile) {
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
                        {error || 'Pilot not found'}
                    </p>
                </div>
            </div>
        );
    }

    const mapLongToShort = (longName: string | null): string | null => {
        if (!longName) return null;
        const key = longName.toLowerCase();
        if (key.includes('observer')) return 'OBS';
        if (key.includes('student') && key.includes('1')) return 'S1';
        if (key.includes('student') && key.includes('2')) return 'S2';
        if (key.includes('student') && key.includes('3')) return 'S3';
        if (key.startsWith('c1') || key.includes('controller 1') || key.includes('controller i')) return 'C1';
        if (key.startsWith('c2') || key.includes('controller 2')) return 'C2';
        if (key.startsWith('c3') || key.includes('controller 3')) return 'C3';
        if (key.includes('instructor') && key.includes('1')) return 'I1';
        if (key.includes('instructor') && key.includes('2')) return 'I2';
        if (key.includes('instructor') && key.includes('3')) return 'I3';
        if (key.includes('supervisor')) return 'SUP';
        if (key.includes('administrator')) return 'ADM';
        return null;
    };

    const displayVatsimRating =
        profile.user.vatsim_rating_short || mapLongToShort(profile.user.vatsim_rating_long);

    const activityChartData = {
        labels: profile.activityData
            .map((d) => {
                const date = new Date(d.month);
                return date.toLocaleDateString('en-US', {
                    month: 'short',
                    year: 'numeric',
                });
            })
            .reverse(),
        datasets: [
            {
                label: 'Flights',
                data: profile.activityData
                    .map((d) => parseInt(d.flight_count.toString()))
                    .reverse(),
                backgroundColor: 'rgba(59, 130, 246, 0.5)',
                borderColor: 'rgba(59, 130, 246, 1)',
                borderWidth: 2,
            },
            {
                label: 'Flight Hours',
                data: profile.activityData
                    .map((d) =>
                        Math.round(parseInt(d.total_minutes.toString()) / 60)
                    )
                    .reverse(),
                backgroundColor: 'rgba(168, 85, 247, 0.5)',
                borderColor: 'rgba(168, 85, 247, 1)',
                borderWidth: 2,
            },
        ],
    };

    return (
        <div className="min-h-screen bg-gray-950 text-white pb-12">
            {/* Header with branding */}
            <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border-b-2 border-blue-800/30 py-4">
                <div className="container mx-auto max-w-6xl px-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <User className="h-6 w-6 text-blue-400" />
                            <span className="text-xl font-bold text-white">
                                Pilot Profile
                            </span>
                        </div>
                        <div className="flex items-center gap-4">
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => (window.location.href = '/')}
                                className="text-blue-400 hover:text-blue-300 transition-colors text-sm"
                            >
                                Back to PFControl
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Profile Header */}
            <div className="relative w-full bg-gradient-to-br from-blue-900/40 via-purple-900/30 to-gray-900/40 border-b-2 border-blue-800/30 py-8 md:py-12">
                <div className="absolute inset-0 bg-[url('/assets/app/backgrounds/mdpc_01.png')] bg-cover bg-center opacity-10"></div>
                <div className="relative container mx-auto max-w-6xl px-4">
                    <div className="flex flex-col md:flex-row md:items-center gap-6">
                        {/* Avatar */}
                        <div className="relative self-center md:self-auto">
                            <div className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-blue-500/50 overflow-hidden bg-gray-800 shadow-xl shadow-blue-500/20">
                                <img
                                    src={getDiscordAvatar(
                                        profile.user.id,
                                        profile.user.avatar
                                    )}
                                    alt={profile.user.username}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        </div>

                        {/* User Info */}
                        <div className="flex-1 text-center md:text-left">
                            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-2">
                                {profile.user.username}
                                {profile.user.discriminator &&
                                    profile.user.discriminator !== '0' && (
                                        <span className="text-gray-400">
                                            #{profile.user.discriminator}
                                        </span>
                                    )}
                            </h1>
                            {(profile.user.is_admin ||
                                (profile.user.roles &&
                                    profile.user.roles.length > 0)) && (
                                <div className="flex flex-wrap gap-2 mb-3 justify-center md:justify-start">
                                    {profile.user.is_admin && (
                                        <div
                                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 cursor-default"
                                            style={{
                                                backgroundColor:
                                                    'rgba(59, 130, 246, 0.2)',
                                                borderColor:
                                                    'rgba(59, 130, 246, 0.5)',
                                                boxShadow:
                                                    '0 4px 6px -1px rgba(59, 130, 246, 0.2)',
                                            }}
                                        >
                                            <Braces
                                                className="h-4 w-4"
                                                style={{ color: '#3B82F6' }}
                                            />
                                            <span
                                                className="text-sm font-semibold"
                                                style={{ color: '#3B82F6' }}
                                            >
                                                Developer
                                            </span>
                                        </div>
                                    )}
                                    {profile.user.roles &&
                                        profile.user.roles.map((role) => {
                                            const badge = getRoleBadge(role);
                                            const BadgeIcon = badge.icon;
                                            return (
                                                <div
                                                    key={role.id}
                                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 cursor-default"
                                                    style={{
                                                        backgroundColor: `rgba(${badge.rgb}, 0.2)`,
                                                        borderColor: `rgba(${badge.rgb}, 0.5)`,
                                                        boxShadow: `0 4px 6px -1px rgba(${badge.rgb}, 0.2)`,
                                                    }}
                                                >
                                                    <BadgeIcon
                                                        className="h-4 w-4"
                                                        style={{
                                                            color: badge.color,
                                                        }}
                                                    />
                                                    <span
                                                        className="text-sm font-semibold"
                                                        style={{
                                                            color: badge.color,
                                                        }}
                                                    >
                                                        {badge.text}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    {(displayVatsimRating || profile.user.vatsim_cid) && (
                                        profile.user.vatsim_cid ? (
                                            <a
                                                href={`https://stats.vatsim.net/stats/${profile.user.vatsim_cid}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2"
                                                style={{
                                                    background: 'linear-gradient(135deg, rgba(42,160,240,0.3) 0%, rgba(49,196,243,0.3) 50%, rgba(46,204,113,0.3) 100%)',
                                                    borderColor: 'rgba(42,160,240,0.3)',
                                                    boxShadow: '0 4px 6px -1px rgba(42,160,240,0.2)'
                                                }}
                                            >
                                                <span className="inline-flex items-center justify-center rounded-full bg-white p-1">
                                                    <img
                                                        src="/assets/images/vatsim.svg"
                                                        alt="VATSIM"
                                                        className="h-4 w-4"
                                                        style={{ transform: 'rotate(180deg)' }}
                                                    />
                                                </span>
                                                {displayVatsimRating && (
                                                    <span className="text-base md:text-lg font-bold" style={{ color: '#3B82F6' }}>
                                                        {displayVatsimRating}
                                                    </span>
                                                )}
                                            </a>
                                        ) : (
                                            <div
                                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 cursor-default"
                                                style={{
                                                    background: 'linear-gradient(135deg, rgba(42,160,240,0.3) 0%, rgba(49,196,243,0.3) 50%, rgba(46,204,113,0.3) 100%)',
                                                    borderColor: 'rgba(42,160,240,0.3)',
                                                    boxShadow: '0 4px 6px -1px rgba(42,160,240,0.2)'
                                                }}
                                            >
                                                <span className="inline-flex items-center justify-center rounded-full bg-white p-1">
                                                    <img
                                                        src="/assets/images/vatsim.svg"
                                                        alt="VATSIM"
                                                        className="h-4 w-4"
                                                        style={{ transform: 'rotate(180deg)' }}
                                                    />
                                                </span>
                                                {displayVatsimRating && (
                                                    <span className="text-base md:text-lg font-bold" style={{ color: '#3B82F6' }}>
                                                        {displayVatsimRating}
                                                    </span>
                                                )}
                                            </div>
                                        )
                                    )}
                                </div>
                            )}
                        <div className="flex flex-col md:flex-row gap-2 md:gap-4 justify-center md:justify-start">
                            {profile.user.roblox_username && (
                                <p className="text-base md:text-lg text-blue-300">
                                    Roblox:{' '}
                                    {profile.user.roblox_user_id ? (
                                        <a
                                            href={`https://www.roblox.com/users/${profile.user.roblox_user_id}/profile`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="underline hover:text-blue-200"
                                        >
                                            {profile.user.roblox_username}
                                        </a>
                                    ) : (
                                        profile.user.roblox_username
                                    )}
                                </p>
                            )}
                            {/* VATSIM badge moved up to align with role badges */}
                            <div className="flex items-center gap-2 text-gray-400 justify-center md:justify-start">
                                <Calendar className="h-4 w-4" />
                                <span className="text-sm">
                                    Member since{' '}
                                    {new Date(
                                        profile.user.member_since
                                    ).toLocaleDateString('en-US', {
                                        month: 'long',
                                        year: 'numeric',
                                    })}
                                </span>
                            </div>
                        </div>
                        </div>
                        <Button
                            onClick={handleShareProfile}
                            className="flex items-center gap-2 self-center md:self-auto"
                            variant={shareClicked ? 'success' : 'outline'}
                        >
                            <Share2 className="w-4 h-4" />
                            <span>{shareClicked ? 'Copied!' : 'Share'}</span>
                        </Button>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="container mx-auto max-w-6xl px-4 mt-8">
                <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                    <TrendingUp className="h-6 w-6 text-blue-400" />
                    Statistics
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/20 rounded-xl p-6 border-2 border-blue-700/40">
                        <div className="flex items-center gap-2 mb-2">
                            <Plane className="h-5 w-5 text-blue-400" />
                            <p className="text-sm text-gray-400">
                                Total Flights
                            </p>
                        </div>
                        <p className="text-3xl font-bold text-white">
                            {profile.stats.total_flights || 0}
                        </p>
                    </div>

                    <div className="bg-gradient-to-br from-purple-900/30 to-purple-800/20 rounded-xl p-6 border-2 border-purple-700/40">
                        <div className="flex items-center gap-2 mb-2">
                            <Clock className="h-5 w-5 text-purple-400" />
                            <p className="text-sm text-gray-400">Flight Time</p>
                        </div>
                        <p className="text-3xl font-bold text-white">
                            {profile.stats.total_hours
                                ? `${Math.round(profile.stats.total_hours)}h`
                                : '0h'}
                        </p>
                    </div>

                    <div className="bg-gradient-to-br from-green-900/30 to-green-800/20 rounded-xl p-6 border-2 border-green-700/40">
                        <div className="flex items-center gap-2 mb-2">
                            <MapPin className="h-5 w-5 text-green-400" />
                            <p className="text-sm text-gray-400">Distance</p>
                        </div>
                        <p className="text-3xl font-bold text-white">
                            {profile.stats.total_distance_nm
                                ? `${Math.round(
                                      profile.stats.total_distance_nm
                                  )}`
                                : '0'}
                        </p>
                        <p className="text-xs text-gray-500">nm</p>
                    </div>

                    <div className="bg-gradient-to-br from-yellow-900/30 to-yellow-800/20 rounded-xl p-6 border-2 border-yellow-700/40">
                        <div className="flex items-center gap-2 mb-2">
                            <Award className="h-5 w-5 text-yellow-400" />
                            <p className="text-sm text-gray-400">
                                Best Landing
                            </p>
                        </div>
                        <p className="text-3xl font-bold text-white">
                            {profile.stats.best_landing_rate
                                ? `${Math.abs(profile.stats.best_landing_rate)}`
                                : '---'}
                        </p>
                        <p className="text-xs text-gray-500">fpm</p>
                    </div>
                </div>

                {/* Additional Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <div className="bg-gray-900/50 rounded-xl p-4 border-2 border-gray-800">
                        <p className="text-xs text-gray-400 mb-1">
                            Favorite Aircraft
                        </p>
                        <p className="text-xl font-bold text-white">
                            {profile.stats.favorite_aircraft || 'N/A'}
                        </p>
                    </div>

                    <div className="bg-gray-900/50 rounded-xl p-4 border-2 border-gray-800">
                        <p className="text-xs text-gray-400 mb-1">
                            Favorite Departure
                        </p>
                        <p className="text-xl font-bold text-white">
                            {profile.stats.favorite_departure || 'N/A'}
                        </p>
                    </div>

                    <div className="bg-gray-900/50 rounded-xl p-4 border-2 border-gray-800">
                        <p className="text-xs text-gray-400 mb-1">
                            Highest Altitude
                        </p>
                        <p className="text-xl font-bold text-white">
                            {profile.stats.highest_altitude
                                ? `${profile.stats.highest_altitude.toLocaleString()} ft`
                                : 'N/A'}
                        </p>
                    </div>
                </div>

                {/* Activity Chart */}
                {profile.activityData.length > 0 && (
                    <div className="mb-8">
                        <h2 className="text-2xl font-bold text-white mb-4">
                            Flight Activity
                        </h2>
                        <div className="bg-gray-900/50 rounded-xl border-2 border-gray-800 p-6">
                            <Bar
                                data={activityChartData}
                                options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: {
                                        legend: {
                                            position: 'bottom' as const,
                                            labels: {
                                                color: '#F9FAFB',
                                                font: { size: 12 },
                                                padding: 15,
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
                                            padding: 12,
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
                                            },
                                        },
                                        y: {
                                            grid: {
                                                color: 'rgba(55, 65, 81, 0.3)',
                                            },
                                            ticks: {
                                                color: '#9CA3AF',
                                                font: { size: 11 },
                                            },
                                        },
                                    },
                                }}
                                height={300}
                            />
                        </div>
                    </div>
                )}

                {/* Recent Flights */}
                {profile.recentFlights.length > 0 && (
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-4">
                            Recent Flights
                        </h2>
                        <div className="space-y-3">
                            {profile.recentFlights.map((flight) => {
                                const landingGrade = getLandingGrade(
                                    flight.landing_rate_fpm
                                );
                                return (
                                    <div
                                        key={flight.id}
                                        onClick={async () => {
                                            const url = await handleShareFlight(String(flight.id));
                                            if (url) navigate(url);
                                        }}
                                        className="bg-gray-900/50 rounded-xl border-2 border-gray-800 p-4 hover:border-blue-700/50 transition-all"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <span className="text-lg font-bold text-blue-300 font-mono">
                                                        {flight.callsign}
                                                    </span>
                                                    <span className="text-gray-500">
                                                        •
                                                    </span>
                                                    <span className="text-sm text-gray-400">
                                                        {flight.aircraft_model ||
                                                            flight.aircraft_icao ||
                                                            'Unknown'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-4 text-sm text-gray-400">
                                                    <span className="font-mono">
                                                        {flight.departure_icao} → {flight.arrival_icao}
                                                    </span>
                                                    <span>•</span>
                                                    <span>
                                                        {formatDuration(
                                                            flight.duration_minutes
                                                        )}
                                                    </span>
                                                    {flight.total_distance_nm && (
                                                        <>
                                                            <span>•</span>
                                                            <span>
                                                                {Math.round(
                                                                    flight.total_distance_nm
                                                                )}{' '}
                                                                nm
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                {flight.landing_rate_fpm && (
                                                    <div className="text-right">
                                                        <p className="text-xs text-gray-500">
                                                            Landing
                                                        </p>
                                                        <p
                                                            className={`text-sm font-semibold ${landingGrade.color}`}
                                                        >
                                                            {Math.abs(
                                                                flight.landing_rate_fpm
                                                            )}{' '}
                                                            fpm
                                                        </p>
                                                        <p
                                                            className={`text-xs ${landingGrade.color}`}
                                                        >
                                                            {landingGrade.text}
                                                        </p>
                                                    </div>
                                                )}
                                                <div className="text-right">
                                                    <p className="text-xs text-gray-500">
                                                        {new Date(
                                                            flight.flight_end
                                                        ).toLocaleDateString(
                                                            'en-US',
                                                            {
                                                                month: 'short',
                                                                day: 'numeric',
                                                            }
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {profile.recentFlights.length === 0 && (
                    <div className="text-center py-12">
                        <Plane className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                        <p className="text-gray-400 text-lg">
                            No flights logged yet
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
