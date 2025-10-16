import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
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
  MessageCircle,
  Edit,
  Users,
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
import { useNavigate } from 'react-router-dom';
import { fetchPilotProfile, shareFlight } from '../utils/fetch/pilot';
import { getCurrentUser } from '../utils/fetch/auth';
import { useAuth } from '../hooks/auth/useAuth';
import type { PilotProfile, Role } from '../types/pilot';
import Button from '../components/common/Button';
import Loader from '../components/common/Loader';
import Navbar from '../components/Navbar';
import AccessDenied from '../components/AccessDenied';
import { SiRoblox } from 'react-icons/si';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface UserStatistics {
  total_sessions_created?: number;
  total_flights_submitted?: {
    total?: number;
    logged_with_logbook?: number;
  };
  total_chat_messages_sent?: number;
  total_time_controlling_minutes?: number;
  total_flight_edits?: {
    total_edit_actions?: number;
  };
  last_updated?: string;
}

export default function PilotProfile() {
  const { username } = useParams<{ username: string }>();
  const { user } = useAuth();
  const [profile, setProfile] = useState<PilotProfile | null>(null);
  const [userStats, setUserStats] = useState<UserStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [shareClicked, setShareClicked] = useState(false);
  const navigate = useNavigate();

  const isCurrentUser = user && profile && profile.user.id === user.userId;

  const handleLinkRoblox = () => {
    window.location.href = `${import.meta.env.VITE_SERVER_URL}/api/auth/roblox`;
  };

  const handleLinkVatsim = () => {
    window.location.href = `${import.meta.env.VITE_SERVER_URL}/api/auth/vatsim?force=1`;
  };

  useEffect(() => {
    fetchProfile();
  }, [username]);

  useEffect(() => {
    if (isCurrentUser) {
      fetchUserStats();
    }
  }, [isCurrentUser]);

  const handleShareProfile = () => {
    const profileUrl = `${window.location.origin}/pilots/${username}`;
    navigator.clipboard.writeText(profileUrl);
    setShareClicked(true);
    setTimeout(() => setShareClicked(false), 2000);
  };

  const handleShareFlight = async (flightid: string): Promise<string> => {
    return await shareFlight(flightid);
  };

  const fetchProfile = async () => {
    try {
      const data = await fetchPilotProfile(username!);
      if (data) {
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

  const fetchUserStats = async () => {
    try {
      const userData = await getCurrentUser();
      setUserStats(userData.statistics || {});
    } catch {
      // Optional: handle error silently or set a flag
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
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
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
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (error || !profile) {
    return <AccessDenied errorType="pilot-not-found" />;
  }

  const mapLongToShort = (longName: string | null): string | null => {
    if (!longName) return null;
    const key = longName.toLowerCase();
    if (key.includes('observer')) return 'OBS';
    if (key.includes('student') && key.includes('1')) return 'S1';
    if (key.includes('student') && key.includes('2')) return 'S2';
    if (key.includes('student') && key.includes('3')) return 'S3';
    if (
      key.startsWith('c1') ||
      key.includes('controller 1') ||
      key.includes('controller i')
    )
      return 'C1';
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
    profile.user.vatsim_rating_short ||
    mapLongToShort(profile.user.vatsim_rating_long);

  const isVatsimLinked = !!(
    profile.user.vatsim_cid ||
    profile.user.vatsim_rating_short ||
    profile.user.vatsim_rating_long
  );

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
          .map((d) => Math.round(parseInt(d.total_minutes.toString()) / 60))
          .reverse(),
        backgroundColor: 'rgba(168, 85, 247, 0.5)',
        borderColor: 'rgba(168, 85, 247, 1)',
        borderWidth: 2,
      },
    ],
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <Navbar />

      <div className="bg-gradient-to-b from-zinc-800 to-zinc-900 border-b border-zinc-700/50 py-8 md:py-12">
        <div className="pt-20 pb-4">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              {/* Avatar */}
              <div className="relative self-center md:self-auto">
                <div className="w-24 h-24 md:w-32 md:h-32 rounded-full border-2 border-blue-600 overflow-hidden bg-gray-800 shadow-xl">
                  <img
                    src={getDiscordAvatar(profile.user.id, profile.user.avatar)}
                    alt={profile.user.username}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              {/* User Info */}
              <div className="flex-1 text-center md:text-left">
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
                  {profile.user.username}
                </h1>
                {(profile.user.is_admin ||
                  (profile.user.roles && profile.user.roles.length > 0) ||
                  isVatsimLinked) && (
                  <div className="flex flex-wrap gap-2 mb-3 justify-center md:justify-start">
                    {isCurrentUser && user?.isAdmin && (
                      <div
                        className="inline-flex items-center gap-2 px-4 py-1 rounded-full border-2 cursor-default"
                        style={{
                          backgroundColor: 'rgba(59, 130, 246, 0.2)',
                          borderColor: 'rgba(59, 130, 246, 0.5)',
                          boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.2)',
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
                            className="inline-flex items-center gap-2 px-4 py-1 rounded-full border-2 cursor-default"
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
                  </div>
                )}
                <div className="flex flex-col md:flex-row gap-2 md:gap-4 justify-center md:justify-start mt-2">
                  {/* Roblox */}
                  {(isCurrentUser ||
                    profile.privacySettings.displayLinkedAccountsOnProfile) && (
                    <div className="flex items-center gap-2">
                      <SiRoblox className="h-5 w-5 text-blue-300" />
                      {profile.user.roblox_username ? (
                        profile.user.roblox_user_id ? (
                          <a
                            href={`https://www.roblox.com/users/${profile.user.roblox_user_id}/profile`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-base md:text-lg text-blue-300 hover:underline hover:text-blue-200"
                          >
                            {profile.user.roblox_username}
                          </a>
                        ) : (
                          <span className="text-base md:text-lg text-blue-300">
                            {profile.user.roblox_username}
                          </span>
                        )
                      ) : (
                        isCurrentUser && (
                          <button
                            onClick={handleLinkRoblox}
                            className="text-base md:text-lg text-blue-300 hover:underline hover:text-blue-200"
                          >
                            Connect Roblox
                          </button>
                        )
                      )}
                    </div>
                  )}
                  {/* VATSIM */}
                  {(isCurrentUser ||
                    profile.privacySettings.displayLinkedAccountsOnProfile) && (
                    <div className="flex items-center gap-2">
                      <img
                        src="/assets/images/vatsim.webp"
                        alt="VATSIM"
                        className="h-6 w-6 p-1 bg-white rounded-full"
                      />
                      {isVatsimLinked ? (
                        <a
                          href={`https://stats.vatsim.net/stats/${profile.user.vatsim_cid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-base md:text-lg text-blue-300 hover:underline hover:text-blue-300"
                        >
                          {displayVatsimRating}
                        </a>
                      ) : (
                        isCurrentUser && (
                          <button
                            onClick={handleLinkVatsim}
                            className="text-base md:text-lg text-blue-400 hover:underline hover:text-blue-300"
                          >
                            Connect VATSIM
                          </button>
                        )
                      )}
                    </div>
                  )}
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
      </div>

      {/* Stats Grid */}
      <div className="max-w-7xl mx-auto px-4 mt-8">
        {isCurrentUser &&
          userStats &&
          Object.keys(userStats).length > 0 &&
          (user.settings?.displayControllerStatsOnProfile ?? true) && (
            <>
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <TowerControl className="h-6 w-6 text-blue-400" />
                Controller Statistics
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                <div
                  className="group relative overflow-hidden rounded-3xl p-8 backdrop-blur-xl border-2 border-white/10 transition-all duration-500 animate-fade-in-up"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(37, 99, 235, 0.15))',
                    animationDelay: '800ms',
                  }}
                >
                  <div className="flex items-center justify-end -mb-8">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      <Users className="h-5 w-5 text-blue-400" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-1">
                    {userStats.total_sessions_created || 0}
                  </h3>
                  <p className="text-zinc-400 text-sm">
                    Total Sessions Created
                  </p>
                </div>

                <div
                  className="group relative overflow-hidden rounded-3xl p-8 backdrop-blur-xl border-2 border-white/10 transition-all duration-500 animate-fade-in-up"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(22, 163, 74, 0.15))',
                    animationDelay: '900ms',
                  }}
                >
                  <div className="flex items-center justify-end -mb-8">
                    <div className="p-2 bg-green-500/20 rounded-lg">
                      <Plane className="h-5 w-5 text-green-400" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-1">
                    {userStats.total_flights_submitted?.total || 0}
                  </h3>
                  <p className="text-zinc-400 text-sm">
                    Flights Submitted (
                    {userStats.total_flights_submitted?.logged_with_logbook ||
                      0}{' '}
                    logged)
                  </p>
                </div>

                <div
                  className="group relative overflow-hidden rounded-3xl p-8 backdrop-blur-xl border-2 border-white/10 transition-all duration-500 animate-fade-in-up"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(168, 85, 247, 0.15), rgba(147, 51, 234, 0.15))',
                    animationDelay: '1000ms',
                  }}
                >
                  <div className="flex items-center justify-end -mb-8">
                    <div className="p-2 bg-purple-500/20 rounded-lg">
                      <MessageCircle className="h-5 w-5 text-purple-400" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-1">
                    {userStats.total_chat_messages_sent || 0}
                  </h3>
                  <p className="text-zinc-400 text-sm">Chat Messages Sent</p>
                </div>

                <div
                  className="group relative overflow-hidden rounded-3xl p-8 backdrop-blur-xl border-2 border-white/10 transition-all duration-500 animate-fade-in-up"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(217, 119, 6, 0.15))',
                    animationDelay: '1100ms',
                  }}
                >
                  <div className="flex items-center justify-end -mb-8">
                    <div className="p-2 bg-orange-500/20 rounded-lg">
                      <Clock className="h-5 w-5 text-orange-400" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-1">
                    {(userStats.total_time_controlling_minutes || 0).toFixed(2)}{' '}
                    min
                  </h3>
                  <p className="text-zinc-400 text-sm">Time Controlling</p>
                </div>

                <div
                  className="group relative overflow-hidden rounded-3xl p-8 backdrop-blur-xl border-2 border-white/10 transition-all duration-500 animate-fade-in-up"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(6, 182, 212, 0.15), rgba(8, 145, 178, 0.15))',
                    animationDelay: '1200ms',
                  }}
                >
                  <div className="flex items-center justify-end -mb-8">
                    <div className="p-2 bg-cyan-500/20 rounded-lg">
                      <Edit className="h-5 w-5 text-cyan-400" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-1">
                    {userStats.total_flight_edits?.total_edit_actions || 0}
                  </h3>
                  <p className="text-zinc-400 text-sm">Flight Edit Actions</p>
                </div>

                <div
                  className="group relative overflow-hidden rounded-3xl p-8 backdrop-blur-xl border-2 border-white/10 transition-all duration-500 animate-fade-in-up"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(75, 85, 99, 0.15), rgba(55, 65, 81, 0.15))',
                    animationDelay: '1300ms',
                  }}
                >
                  <div className="flex items-center justify-end -mb-8">
                    <div className="p-2 bg-gray-500/20 rounded-lg">
                      <Clock className="h-5 w-5 text-gray-400" />
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">
                    {userStats.last_updated
                      ? new Date(userStats.last_updated).toLocaleDateString()
                      : 'N/A'}
                  </h3>
                  <p className="text-zinc-400 text-sm">Last Updated</p>
                </div>
              </div>
            </>
          )}

        <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
          <User className="h-6 w-6 text-blue-400" />
          Pilot Statistics
        </h2>
        {(isCurrentUser ||
          profile.privacySettings.displayPilotStatsOnProfile) && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div
              className="group relative overflow-hidden rounded-3xl p-8 backdrop-blur-xl border-2 border-white/10 transition-all duration-500 animate-fade-in-up"
              style={{
                background:
                  'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(37, 99, 235, 0.15))',
                animationDelay: '100ms',
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Plane className="h-5 w-5 text-blue-400" />
                <p className="text-sm text-gray-400">Total Flights</p>
              </div>
              <p className="text-3xl font-bold text-white">
                {profile.stats.total_flights || 0}
              </p>
            </div>

            <div
              className="group relative overflow-hidden rounded-3xl p-8 backdrop-blur-xl border-2 border-white/10 transition-all duration-500 animate-fade-in-up"
              style={{
                background:
                  'linear-gradient(135deg, rgba(168, 85, 247, 0.15), rgba(147, 51, 234, 0.15))',
                animationDelay: '200ms',
              }}
            >
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

            <div
              className="group relative overflow-hidden rounded-3xl p-8 backdrop-blur-xl border-2 border-white/10 transition-all duration-500 animate-fade-in-up"
              style={{
                background:
                  'linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(22, 163, 74, 0.15))',
                animationDelay: '300ms',
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="h-5 w-5 text-green-400" />
                <p className="text-sm text-gray-400">Distance</p>
              </div>
              <p className="text-3xl font-bold text-white">
                {profile.stats.total_distance_nm
                  ? `${Math.round(profile.stats.total_distance_nm)}`
                  : '0'}
              </p>
              <p className="text-xs text-gray-500">nm</p>
            </div>

            <div
              className="group relative overflow-hidden rounded-3xl p-8 backdrop-blur-xl border-2 border-white/10 transition-all duration-500 animate-fade-in-up"
              style={{
                background:
                  'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(217, 119, 6, 0.15))',
                animationDelay: '400ms',
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Award className="h-5 w-5 text-yellow-400" />
                <p className="text-sm text-gray-400">Best Landing</p>
              </div>
              <p className="text-3xl font-bold text-white">
                {profile.stats.best_landing_rate
                  ? `${Math.abs(profile.stats.best_landing_rate)}`
                  : '---'}
              </p>
              <p className="text-xs text-gray-500">fpm</p>
            </div>
          </div>
        )}

        {/* Additional Stats */}
        {(isCurrentUser ||
          profile.privacySettings.displayPilotStatsOnProfile) && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div
              className="group relative overflow-hidden rounded-3xl p-8 backdrop-blur-xl border-2 border-white/10 transition-all duration-500 animate-fade-in-up"
              style={{
                background:
                  'linear-gradient(135deg, rgba(75, 85, 99, 0.15), rgba(55, 65, 81, 0.15))',
                animationDelay: '500ms',
              }}
            >
              <p className="text-xs text-gray-400 mb-1">Favorite Aircraft</p>
              <p className="text-xl font-bold text-white">
                {profile.stats.favorite_aircraft || 'N/A'}
              </p>
            </div>

            <div
              className="group relative overflow-hidden rounded-3xl p-8 backdrop-blur-xl border-2 border-white/10 transition-all duration-500 animate-fade-in-up"
              style={{
                background:
                  'linear-gradient(135deg, rgba(75, 85, 99, 0.15), rgba(55, 65, 81, 0.15))',
                animationDelay: '600ms',
              }}
            >
              <p className="text-xs text-gray-400 mb-1">Favorite Departure</p>
              <p className="text-xl font-bold text-white">
                {profile.stats.favorite_departure || 'N/A'}
              </p>
            </div>

            <div
              className="group relative overflow-hidden rounded-3xl p-8 backdrop-blur-xl border-2 border-white/10 transition-all duration-500 animate-fade-in-up"
              style={{
                background:
                  'linear-gradient(135deg, rgba(75, 85, 99, 0.15), rgba(55, 65, 81, 0.15))',
                animationDelay: '700ms',
              }}
            >
              <p className="text-xs text-gray-400 mb-1">Highest Altitude</p>
              <p className="text-xl font-bold text-white">
                {profile.stats.highest_altitude
                  ? `${profile.stats.highest_altitude.toLocaleString()} ft`
                  : 'N/A'}
              </p>
            </div>
          </div>
        )}

        {/* Activity Chart */}
        {(isCurrentUser ||
          profile.privacySettings.displayPilotStatsOnProfile) &&
          profile.activityData.length > 0 && (
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white mb-4">
                Flight Activity
              </h2>
              <div
                className="group relative overflow-hidden rounded-3xl p-8 backdrop-blur-xl border-2 border-white/10 transition-all duration-500 animate-fade-in-up"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(75, 85, 99, 0.15), rgba(55, 65, 81, 0.15))',
                  animationDelay: '1400ms',
                }}
              >
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
                        backgroundColor: 'rgba(17, 24, 39, 0.95)',
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
              {profile.recentFlights.map((flight, index) => {
                const landingGrade = getLandingGrade(flight.landing_rate_fpm);
                return (
                  <div
                    key={flight.id}
                    onClick={async () => {
                      const url = await handleShareFlight(String(flight.id));
                      if (url) navigate(url);
                    }}
                    className="group relative overflow-hidden rounded-3xl p-8 backdrop-blur-xl border border-white/10 transition-all duration-500 animate-fade-in-up hover:border-blue-700/50"
                    style={{
                      background:
                        'linear-gradient(135deg, rgba(75, 85, 99, 0.15), rgba(55, 65, 81, 0.15))',
                      animationDelay: `${1500 + index * 100}ms`,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-lg font-bold text-blue-300 font-mono">
                            {flight.callsign}
                          </span>
                          <span className="text-gray-500">•</span>
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
                          <span>{formatDuration(flight.duration_minutes)}</span>
                          {flight.total_distance_nm && (
                            <>
                              <span>•</span>
                              <span>
                                {Math.round(flight.total_distance_nm)} nm
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {flight.landing_rate_fpm && (
                          <div className="text-right">
                            <p className="text-xs text-gray-500">Landing</p>
                            <p
                              className={`text-sm font-semibold ${landingGrade.color}`}
                            >
                              {Math.abs(flight.landing_rate_fpm)} fpm
                            </p>
                            <p className={`text-xs ${landingGrade.color}`}>
                              {landingGrade.text}
                            </p>
                          </div>
                        )}
                        <div className="text-right">
                          <p className="text-xs text-gray-500">
                            {new Date(flight.flight_end).toLocaleDateString(
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
            <p className="text-gray-400 text-lg">No flights logged yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
