import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  User,
  Plane,
  Clock,
  Award,
  Calendar,
  TrendingUp,
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
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { SiRoblox } from 'react-icons/si';
import { fetchPilotProfile } from '../utils/fetch/pilot';
import { getCurrentUser } from '../utils/fetch/auth';
import { useAuth } from '../hooks/auth/useAuth';
import { fetchBackgrounds } from '../utils/fetch/data';
import type { PilotProfile, Role } from '../types/pilot';
import Button from '../components/common/Button';
import Loader from '../components/common/Loader';
import Navbar from '../components/Navbar';
import AccessDenied from '../components/AccessDenied';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

type Ranks = Record<string, number | string | null>;

const isRankOne = (ranks: Ranks): boolean => {
  const statKeys = [
    'total_sessions_created',
    'total_flights_submitted.total',
    'total_time_controlling_minutes',
    'total_chat_messages_sent',
    'total_flight_edits.total_edit_actions',
  ];
  return statKeys.some((key) => {
    const rank = ranks[key];
    return typeof rank === 'number' && rank === 1;
  });
};

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

interface AvailableImage {
  filename: string;
  path: string;
  extension: string;
}

export default function PilotProfile() {
  const { username } = useParams<{ username: string }>();
  const { user } = useAuth();
  const [profile, setProfile] = useState<PilotProfile | null>(null);
  const [userStats, setUserStats] = useState<UserStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [shareClicked, setShareClicked] = useState(false);
  const [ranks, setRanks] = useState<Ranks>({});
  const [availableImages, setAvailableImages] = useState<AvailableImage[]>([]);

  const isCurrentUser = user && profile && profile.user.id === user.userId;
  const API_BASE_URL = import.meta.env.VITE_SERVER_URL;

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

  useEffect(() => {
    const loadImages = async () => {
      try {
        const data = await fetchBackgrounds();
        setAvailableImages(data);
      } catch (error) {
        console.error('Error loading available images:', error);
      }
    };
    loadImages();
  }, []);

  const handleShareProfile = () => {
    const profileUrl = `${window.location.origin}/user/${username}`;
    navigator.clipboard.writeText(profileUrl);
    setShareClicked(true);
    setTimeout(() => setShareClicked(false), 2000);
  };

  const fetchProfile = async () => {
    try {
      const data = await fetchPilotProfile(username!);
      if (data) {
        setProfile(data);
        if (!isCurrentUser) {
          setUserStats(data.user.statistics || {});
        }
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
      setRanks(userData.ranks || {});
    } catch {
      // ignore
    }
  };

  const getBackgroundImage = () => {
    if (
      !profile?.user.background_image ||
      !profile.privacySettings.displayBackgroundOnProfile
    ) {
      return null;
    }

    const selectedImage = profile.user.background_image.selectedImage;

    const getImageUrl = (filename: string | null): string | null => {
      if (!filename || filename === 'random' || filename === 'favorites') {
        return filename;
      }
      if (filename.startsWith('https://api.cephie.app/')) {
        return filename;
      }
      return `${API_BASE_URL}/assets/app/backgrounds/${filename}`;
    };

    if (selectedImage === 'random' && availableImages.length > 0) {
      const randomIndex = Math.floor(Math.random() * availableImages.length);
      return `${API_BASE_URL}${availableImages[randomIndex].path}`;
    } else if (selectedImage === 'favorites') {
      const favorites = profile.user.background_image.favorites || [];
      if (favorites.length > 0) {
        const randomFav =
          favorites[Math.floor(Math.random() * favorites.length)];
        const favImageUrl = getImageUrl(randomFav);
        if (
          favImageUrl &&
          favImageUrl !== 'random' &&
          favImageUrl !== 'favorites'
        ) {
          return favImageUrl;
        }
      }
    } else if (selectedImage) {
      const imageUrl = getImageUrl(selectedImage);
      if (imageUrl && imageUrl !== 'random' && imageUrl !== 'favorites') {
        return imageUrl;
      }
    }

    return null;
  };

  const backgroundImage = getBackgroundImage();

  const getDiscordAvatar = (userId: string, avatarHash: string | null) => {
    if (!avatarHash) {
      return `https://cdn.discordapp.com/embed/avatars/${
        parseInt(userId) % 5
      }.png`;
    }
    return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.png?size=256`;
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

  const hasCrown = isCurrentUser && isRankOne(ranks);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <Navbar />

      <div
        className={`relative ${!backgroundImage ? 'bg-gradient-to-b from-zinc-800 to-zinc-900 border-b border-zinc-700/50' : ''}`}
        style={
          backgroundImage
            ? {
                backgroundImage: `url(${backgroundImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
              }
            : {}
        }
      >
        {backgroundImage && (
          <>
            <div className="absolute inset-0 backdrop-blur-[2px]"></div>
            <div className="absolute inset-0 bg-gradient-to-tr from-black via-black/70 to-transparent"></div>
            <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent"></div>
          </>
        )}
        <div className="py-8 md:py-12 relative z-10">
          <div className="pt-20 pb-4">
            <div className="max-w-7xl mx-auto px-4">
              <div className="flex flex-col md:flex-row md:items-center gap-6">
                {/* Avatar */}
                <div className="relative self-center md:self-auto">
                  <div className="w-24 h-24 md:w-32 md:h-32 rounded-full border-2 border-blue-600 overflow-hidden bg-gray-800 shadow-xl">
                    <img
                      src={getDiscordAvatar(
                        profile.user.id,
                        profile.user.avatar
                      )}
                      alt={profile.user.username}
                      className="w-full h-full object-cover"
                    />
                    {hasCrown && (
                      <Crown
                        className="absolute -top-2 right-0 w-10 h-10 transform rotate-12 shadow-2xl"
                        style={{
                          color: '#fbbf24',
                          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
                        }}
                      />
                    )}
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
                      {profile.user.is_admin && (
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
                    <div className="flex items-center gap-2 text-gray-400 justify-center md:justify-start">
                      <Calendar className="h-5 w-5" />
                      <span className="text-base md:text-lg">
                        Member since{' '}
                        {new Date(profile.user.member_since).toLocaleDateString(
                          'en-US',
                          {
                            month: 'long',
                            year: 'numeric',
                          }
                        )}
                      </span>
                    </div>
                    {/* Roblox */}
                    {(isCurrentUser ||
                      profile.privacySettings
                        .displayLinkedAccountsOnProfile) && (
                      <div className="flex items-center gap-2 justify-center md:justify-start">
                        {profile.user.roblox_username && (
                          <SiRoblox className="h-5 w-5 text-blue-300" />
                        )}
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
                      profile.privacySettings
                        .displayLinkedAccountsOnProfile) && (
                      <div className="flex items-center gap-2 justify-center md:justify-start">
                        {isVatsimLinked && (
                          <img
                            src="/assets/images/vatsim.webp"
                            alt="VATSIM"
                            className="h-6 w-6 p-1 bg-white rounded-full"
                          />
                        )}
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
      </div>

      {/* Stats Grid */}
      <div className="max-w-7xl mx-auto px-4 mt-8">
        {profile.user.bio && profile.user.bio.trim() !== '' && (
          <div className="mb-8 p-5 bg-zinc-800/50 rounded-3xl border-2 border-zinc-700/50">
            <p className="text-zinc-300 text-md font-medium leading-relaxed whitespace-pre-wrap">
              {profile.user.bio}
            </p>
          </div>
        )}
        {(isCurrentUser ||
          profile.privacySettings.displayPilotStatsOnProfile) && (
          <>
            {(
              isCurrentUser
                ? (user.settings?.displayStatsOnProfile ?? true)
                : true
            ) ? (
              userStats && Object.keys(userStats).length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                  {/* Sessions Created */}
                  <div
                    className="group relative overflow-hidden rounded-3xl p-8 backdrop-blur-xl border-2 border-white/10 transition-all duration-500 animate-fade-in-up flex items-center justify-between"
                    style={{
                      background:
                        'linear-gradient(135deg, rgba(16, 185, 129, 0.14), rgba(20, 184, 166, 0.10))',
                      animationDelay: '800ms',
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-emerald-400/20 rounded-lg">
                        <Users className="h-6 w-6 text-emerald-300" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-white">
                          {userStats.total_sessions_created || 0}
                        </h3>
                        <p className="text-zinc-400 text-sm">
                          Total Sessions Created
                        </p>
                      </div>
                    </div>
                    {/* Only show ranks for current user */}
                    {isCurrentUser && (
                      <div className="text-right">
                        <p className="text-sm text-gray-300 font-semibold">
                          Rank
                        </p>
                        <p className="text-lg font-bold text-emerald-300">
                          #{ranks.total_sessions_created || 'N/A'}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Total Flights */}
                  <div
                    className="group relative overflow-hidden rounded-3xl p-8 backdrop-blur-xl border-2 border-white/10 transition-all duration-500 animate-fade-in-up flex items-center justify-between"
                    style={{
                      background:
                        'linear-gradient(135deg, rgba(249, 115, 22, 0.12), rgba(239, 68, 68, 0.08))',
                      animationDelay: '1300ms',
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-amber-500/20 rounded-lg">
                        <Plane className="h-6 w-6 text-amber-300" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-white">
                          {userStats?.total_flights_submitted?.total || 0}
                        </h3>
                        <p className="text-zinc-400 text-sm">
                          Flights Submitted
                        </p>
                      </div>
                    </div>
                    {isCurrentUser && (
                      <div className="text-right">
                        <p className="text-sm text-gray-300 font-semibold">
                          Rank
                        </p>
                        <p className="text-lg font-bold text-amber-300">
                          #{ranks['total_flights_submitted.total'] || 'N/A'}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Time Controlling */}
                  <div
                    className="group relative overflow-hidden rounded-3xl p-8 backdrop-blur-xl border-2 border-white/10 transition-all duration-500 animate-fade-in-up flex items-center justify-between"
                    style={{
                      background:
                        'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(124, 58, 237, 0.10))',
                      animationDelay: '1100ms',
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-indigo-500/20 rounded-lg">
                        <Clock className="h-6 w-6 text-indigo-300" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-white">
                          {(
                            userStats.total_time_controlling_minutes || 0
                          ).toFixed(2)}{' '}
                          min
                        </h3>
                        <p className="text-zinc-400 text-sm">
                          Time Controlling
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-300 font-semibold">
                        Rank
                      </p>
                      <p className="text-lg font-bold text-indigo-300">
                        #{ranks.total_time_controlling_minutes || 'N/A'}
                      </p>
                    </div>
                  </div>

                  {/* Flight Edit Actions */}
                  <div
                    className="group relative overflow-hidden rounded-3xl p-8 backdrop-blur-xl border-2 border-white/10 transition-all duration-500 animate-fade-in-up flex items-center justify-between"
                    style={{
                      background:
                        'linear-gradient(135deg, rgba(14, 165, 233, 0.12), rgba(96, 165, 250, 0.08))',
                      animationDelay: '1200ms',
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-sky-500/20 rounded-lg">
                        <Edit className="h-6 w-6 text-sky-300" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-white">
                          {userStats.total_flight_edits?.total_edit_actions ||
                            0}
                        </h3>
                        <p className="text-zinc-400 text-sm">
                          Flight Edit Actions
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-300 font-semibold">
                        Rank
                      </p>
                      <p className="text-lg font-bold text-sky-300">
                        #
                        {ranks['total_flight_edits.total_edit_actions'] ||
                          'N/A'}
                      </p>
                    </div>
                  </div>

                  {/* Chat Messages */}
                  <div
                    className="group relative overflow-hidden rounded-3xl p-8 backdrop-blur-xl border-2 border-white/10 transition-all duration-500 animate-fade-in-up flex items-center justify-between"
                    style={{
                      background:
                        'linear-gradient(135deg, rgba(236, 72, 153, 0.12), rgba(234, 88, 126, 0.10))',
                      animationDelay: '1000ms',
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-pink-500/20 rounded-lg">
                        <MessageCircle className="h-6 w-6 text-pink-300" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-white">
                          {userStats.total_chat_messages_sent || 0}
                        </h3>
                        <p className="text-zinc-400 text-sm">
                          Chat Messages Sent
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Last Updated - New */}
                  <div
                    className="group relative overflow-hidden rounded-3xl p-8 backdrop-blur-xl border-2 border-white/10 transition-all duration-500 animate-fade-in-up flex items-center justify-between"
                    style={{
                      background:
                        'linear-gradient(135deg, rgba(168, 85, 247, 0.10), rgba(236, 72, 153, 0.06))',
                      animationDelay: '1400ms',
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-violet-500/20 rounded-lg">
                        <Clock className="h-6 w-6 text-violet-300" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white">
                          {userStats.last_updated
                            ? new Date(userStats.last_updated).toLocaleString(
                                'en-US',
                                {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                }
                              )
                            : 'Never'}
                        </h3>
                        <p className="text-zinc-400 text-sm">Last Updated</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-zinc-400 text-center mb-8">
                  No statistics available yet.
                </p>
              )
            ) : (
              <p className="text-zinc-400 text-center">
                Statistics are hidden for privacy reasons.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
