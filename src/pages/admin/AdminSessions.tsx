import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Activity,
  Search,
  Grid3x3,
  List,
  MoreHorizontal,
  ExternalLink,
  Trash2,
  Users,
  Calendar,
  Plane,
  X,
  Wind,
  Database,
  RefreshCw,
  TowerControl,
  Star,
  Shield,
  Wrench,
  Award,
  Crown,
  Trophy,
  Zap,
  Target,
  Heart,
  Sparkles,
  Flame,
  TrendingUp,
  FlaskConical,
  Braces,
  Menu,
} from 'lucide-react';
import Navbar from '../../components/Navbar';
import AdminSidebar from '../../components/admin/AdminSidebar';
import Loader from '../../components/common/Loader';
import Button from '../../components/common/Button';
import Toast from '../../components/common/Toast';
import Dropdown from '../../components/common/Dropdown';
import {
  fetchAdminSessions,
  deleteAdminSession,
  logSessionJoin,
  type AdminSession,
} from '../../utils/fetch/admin';
import ErrorScreen from '../../components/common/ErrorScreen';

type ViewMode = 'grid' | 'list';
type SortBy = 'date' | 'airport' | 'creator' | 'controllers' | 'flights';

const sortOptions = [
  { value: 'date', label: 'Sort by Date' },
  { value: 'airport', label: 'Sort by Airport' },
  { value: 'creator', label: 'Sort by Creator' },
  { value: 'controllers', label: 'Sort by Controllers' },
  { value: 'flights', label: 'Sort by Flights' },
];

const getIconComponent = (iconName: string) => {
  const icons: Record<
    string,
    React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  > = {
    Star,
    Shield,
    Wrench,
    Award,
    Crown,
    Trophy,
    Zap,
    Target,
    Heart,
    Sparkles,
    Flame,
    TrendingUp,
    FlaskConical,
    Braces,
  };
  return icons[iconName] || Star;
};

const getHighestRole = (
  roles?: Array<{
    id: number;
    name: string;
    color: string;
    icon: string;
    priority: number;
  }>
) => {
  if (!roles || roles.length === 0) return null;
  return roles.reduce((highest, current) =>
    current.priority > highest.priority ? current : highest
  );
};

export default function AdminSessions() {
  const [searchParams] = useSearchParams();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<AdminSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [selectedSession, setSelectedSession] = useState<AdminSession | null>(
    null
  );
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(100);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState(searchParams.get('search') || '');

  useEffect(() => {
    fetchSessions();
  }, [page, search]);
  useEffect(() => {
    filterAndSortSessions();
  }, [sessions, sortBy]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchAdminSessions(page, limit, search);
      setSessions(data.sessions);
      setTotalPages(data.pagination.pages);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch sessions';
      setError(errorMessage);
      setToast({
        message: errorMessage,
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortSessions = () => {
    const filtered = [...sessions];

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return (
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        case 'airport':
          return a.airport_icao.localeCompare(b.airport_icao);
        case 'creator':
          return (a.username || a.created_by).localeCompare(
            b.username || b.created_by
          );
        case 'controllers':
          return (b.active_user_count || 0) - (a.active_user_count || 0);
        case 'flights':
          return (b.flight_count || 0) - (a.flight_count || 0);
        default:
          return 0;
      }
    });

    setFilteredSessions(filtered);
  };

  const handleJoinSession = async (session: AdminSession) => {
    try {
      await logSessionJoin(session.session_id);
      const url = `${window.location.origin}/view/${session.session_id}/?accessId=${session.access_id}`;
      window.open(url, '_blank');
    } catch (err) {
      console.error('Error logging session join:', err);
      // Still open the session even if logging fails
      const url = `${window.location.origin}/view/${session.session_id}/?accessId=${session.access_id}`;
      window.open(url, '_blank');
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (
      !confirm(
        'Are you sure you want to delete this session? This action cannot be undone.'
      )
    ) {
      return;
    }

    try {
      await deleteAdminSession(sessionId);
      setToast({
        message: 'Session deleted successfully',
        type: 'success',
      });
      setShowModal(false);
      setSelectedSession(null);
      fetchSessions();
    } catch (err) {
      setToast({
        message:
          err instanceof Error ? err.message : 'Failed to delete session',
        type: 'error',
      });
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();

    if (isNaN(diffMs) || isNaN(date.getTime())) return 'Unknown';
    if (diffMs < 0) return 'Just now';

    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMins > 0) return `${diffMins}m ago`;
    if (diffSecs > 0) return `${diffSecs}s ago`;
    return 'Just now';
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
      timeZoneName: 'short',
    });
  };

  const getAvatarUrl = (
    userId: string,
    avatar: string | null,
    size: number = 64
  ) => {
    if (!avatar) return null;

    // If it's already a full URL, return it as-is
    if (avatar.startsWith('http')) {
      return avatar;
    }

    // Otherwise, construct URL from hash
    const isAnimated = avatar.startsWith('a_');
    const extension = isAnimated ? 'gif' : 'png';
    return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.${extension}?size=${size}`;
  };

  const renderSessionGrid = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {filteredSessions.map((session) => (
        <div
          key={session.session_id}
          className={`bg-zinc-900 border-2 border-zinc-700/50 rounded-2xl p-6 ${
            session.is_pfatc
              ? 'hover:border-blue-500/50'
              : 'hover:border-green-500/50'
          } transition-all duration-200`}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div
                className={`p-2 rounded-lg ${
                  session.is_pfatc ? 'bg-blue-500/20' : 'bg-green-500/20'
                }`}
              >
                {session.is_pfatc ? (
                  <TowerControl className="w-4 h-4 text-blue-500" />
                ) : (
                  <Activity className="w-4 h-4 text-green-400" />
                )}
              </div>
              <div>
                <h3 className="text-white font-bold text-lg">
                  {session.airport_icao}
                </h3>
                <p className="text-xs text-zinc-500 font-mono">
                  {session.session_id}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSelectedSession(session);
                setShowModal(true);
              }}
              className="p-2"
            >
              <MoreHorizontal className="w-5 h-5" />
            </Button>
          </div>

          {/* Creator Info */}
          <div className="flex items-center space-x-3 mb-4 pb-4 border-b border-zinc-700">
            {getAvatarUrl(session.created_by, session.avatar, 40) ? (
              <img
                src={getAvatarUrl(session.created_by, session.avatar, 40)!}
                alt={session.username}
                className="w-10 h-10 rounded-full"
              />
            ) : (
              <div className="w-10 h-10 bg-zinc-700 rounded-full flex items-center justify-center">
                <Users className="w-5 h-5 text-zinc-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium truncate">
                {session.username || 'Unknown User'}
              </p>
              <p className="text-xs text-zinc-500 font-mono truncate">
                {session.created_by}
              </p>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-2 mb-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-400">Flights</span>
              <span className="text-white font-medium">
                {session.flight_count || 0}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-400">Controllers</span>
              <span className="text-white font-medium">
                {session.active_user_count || 0}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-400">Created</span>
              <span className="text-white font-medium">
                {formatTimeAgo(session.created_at)}
              </span>
            </div>
          </div>

          {/* Join Button */}
          <Button
            onClick={() => handleJoinSession(session)}
            className="w-full flex items-center justify-center space-x-2"
            size="sm"
            variant="primary"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Join Session</span>
          </Button>
        </div>
      ))}
    </div>
  );

  const renderSessionList = () => (
    <div className="bg-zinc-900 border-2 border-zinc-700/50 rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead className="bg-zinc-800">
            <tr>
              <th className="px-6 py-4 text-left text-zinc-400 font-medium">
                Session
              </th>
              <th className="px-6 py-4 text-left text-zinc-400 font-medium">
                Creator
              </th>
              <th className="px-6 py-4 text-left text-zinc-400 font-medium">
                Created
              </th>
              <th className="px-6 py-4 text-left text-zinc-400 font-medium">
                Controllers
              </th>
              <th className="px-6 py-4 text-left text-zinc-400 font-medium">
                Flights
              </th>
              <th className="px-6 py-4 text-left text-zinc-400 font-medium">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredSessions.map((session) => (
              <tr
                key={session.session_id}
                className="border-t border-zinc-700/50 hover:bg-zinc-800/50"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-3">
                    <div
                      className={`p-2 rounded-lg ${
                        session.is_pfatc ? 'bg-blue-500/20' : 'bg-green-500/20'
                      }`}
                    >
                      {session.is_pfatc ? (
                        <TowerControl className="w-4 h-4 text-blue-500" />
                      ) : (
                        <Activity className="w-4 h-4 text-green-400" />
                      )}
                    </div>
                    <div>
                      <div className="text-white font-bold">
                        {session.airport_icao}
                      </div>
                      <div className="text-xs text-zinc-500 font-mono">
                        {session.session_id}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-3">
                    {getAvatarUrl(session.created_by, session.avatar, 32) ? (
                      <img
                        src={
                          getAvatarUrl(session.created_by, session.avatar, 32)!
                        }
                        alt={session.username}
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      <div className="w-8 h-8 bg-zinc-700 rounded-full flex items-center justify-center">
                        <Users className="w-4 h-4 text-zinc-400" />
                      </div>
                    )}
                    <div>
                      <div className="text-white font-medium">
                        {session.username || 'Unknown User'}
                      </div>
                      <div className="text-xs text-zinc-500 font-mono">
                        {session.created_by}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-white font-medium">
                    {formatTimeAgo(session.created_at)}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {formatDateTime(session.created_at)}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-white font-medium">
                    {session.active_user_count || 0}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-white font-medium">
                    {session.flight_count || 0}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-2">
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => handleJoinSession(session)}
                      className="flex items-center space-x-2"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Join</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setSelectedSession(session);
                        setShowModal(true);
                      }}
                      className="p-2"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <>
      <div className="min-h-screen bg-black text-white">
        <Navbar />
        <div className="flex pt-16">
          {/* Mobile Sidebar Overlay */}
          {mobileSidebarOpen && (
            <div
              className="fixed inset-0 bg-black/60 z-40 lg:hidden"
              onClick={() => setMobileSidebarOpen(false)}
            />
          )}

          {/* Desktop Sidebar */}
          <div className="hidden lg:block">
            <AdminSidebar
              collapsed={sidebarCollapsed}
              onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
            />
          </div>

          {/* Mobile Sidebar */}
          <div
            className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 lg:hidden ${
              mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            <AdminSidebar
              collapsed={false}
              onToggle={() => setMobileSidebarOpen(false)}
            />
          </div>

          <div className="flex-1 p-4 sm:p-6 lg:p-8">
            {/* Header */}
            <div className="mb-6 sm:mb-8">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <Database className="h-8 w-8 sm:h-10 sm:w-10 text-yellow-400 mr-4" />
                  <div>
                    <h1
                      className="text-3xl sm:text-4xl lg:text-5xl text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600 font-extrabold mb-2"
                      style={{ lineHeight: 1.4 }}
                    >
                      Session Management
                    </h1>
                  </div>
                </div>
              </div>

              {/* Controls */}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                {/* Search */}
                <div className="flex-1 relative group">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-zinc-400 group-focus-within:text-yellow-400 transition-colors" />
                  <input
                    type="text"
                    placeholder="Search by session ID, airport, or creator..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-zinc-900/50 border-2 border-zinc-700 rounded-full text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 transition-all duration-200 hover:border-zinc-600"
                  />
                </div>

                {/* View Mode Toggle */}
                <div className="flex justify-center">
                  <div className="w-full flex bg-zinc-900/50 border-2 border-zinc-700 rounded-full overflow-hidden mx-auto">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`w-1/2 px-4 py-3 flex items-center justify-center space-x-2 transition-colors ${
                        viewMode === 'grid'
                          ? 'bg-yellow-500 text-white'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      <Grid3x3 className="w-4 h-4" />
                      <span className="inline">Grid</span>
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`w-1/2 px-4 py-3 flex items-center justify-center space-x-2 transition-colors ${
                        viewMode === 'list'
                          ? 'bg-yellow-500 text-white'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      <List className="w-4 h-4" />
                      <span className="inline">List</span>
                    </button>
                  </div>
                </div>

                {/* Sort */}
                <Dropdown
                  options={sortOptions}
                  value={sortBy}
                  onChange={(value) => setSortBy(value as SortBy)}
                  size="md"
                />

                {/* Refresh Button */}
                <Button
                  onClick={fetchSessions}
                  variant="outline"
                  size="sm"
                  className="px-4 py-3 flex items-center space-x-2"
                  disabled={loading}
                >
                  <RefreshCw
                    className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
                  />
                  <span className="hidden sm:inline">Refresh</span>
                </Button>
              </div>
            </div>

            {/* Content */}
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader />
              </div>
            ) : error ? (
              <ErrorScreen
                title="Error loading sessions"
                message={error}
                onRetry={fetchSessions}
              />
            ) : filteredSessions.length === 0 ? (
              <div className="text-center py-12 text-zinc-400">
                {search
                  ? 'No sessions found matching your search.'
                  : 'No active sessions.'}
              </div>
            ) : (
              <>
                {viewMode === 'grid'
                  ? renderSessionGrid()
                  : renderSessionList()}
              </>
            )}

            {/* Pagination Controls */}
            <div className="flex justify-center mt-8 space-x-2">
              <Button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                variant="outline"
                size="xs"
              >
                Previous
              </Button>
              <span className="text-zinc-400 py-2">
                Page {page} of {totalPages}
              </span>
              <Button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                variant="outline"
                size="xs"
              >
                Next
              </Button>
            </div>
          </div>
        </div>

        {/* Floating Mobile Menu Button */}
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="lg:hidden fixed bottom-6 right-6 z-30 p-4 bg-yellow-600 hover:bg-yellow-700 rounded-full shadow-lg transition-colors"
        >
          <Menu className="h-6 w-6 text-white" />
        </button>
      </div>

      {/* More Actions Modal */}
      {showModal && selectedSession && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-zinc-900 border-2 border-zinc-700 rounded-2xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Session Details</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowModal(false);
                  setSelectedSession(null);
                }}
                className="p-2"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="space-y-4">
              {/* Session Info */}
              <div className="bg-zinc-800 rounded-lg p-4">
                <div className="flex items-center space-x-3 mb-3">
                  <div
                    className={`p-2 rounded-lg ${
                      selectedSession.is_pfatc
                        ? 'bg-blue-500/20'
                        : 'bg-green-500/20'
                    }`}
                  >
                    {selectedSession.is_pfatc ? (
                      <TowerControl className="w-4 h-4 text-blue-500" />
                    ) : (
                      <Activity className="w-4 h-4 text-green-400" />
                    )}
                  </div>
                  <div>
                    <div className="text-white font-bold text-lg">
                      {selectedSession.airport_icao}
                    </div>
                    <div className="text-xs text-zinc-500 font-mono">
                      {selectedSession.session_id}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">
                      <Plane className="w-4 h-4 inline mr-2" />
                      Flights
                    </span>
                    <span className="text-white font-medium">
                      {selectedSession.flight_count}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">
                      <Wind className="w-4 h-4 inline mr-2" />
                      Active Runway
                    </span>
                    <span className="text-white font-medium">
                      {selectedSession.active_runway || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">
                      <Calendar className="w-4 h-4 inline mr-2" />
                      Created
                    </span>
                    <span className="text-white font-medium">
                      {formatDateTime(selectedSession.created_at)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Creator Info */}
              <div className="bg-zinc-800 rounded-lg p-4">
                <h3 className="text-sm font-medium text-zinc-400 mb-3">
                  Creator
                </h3>
                <div className="flex items-center space-x-3">
                  {getAvatarUrl(
                    selectedSession.created_by,
                    selectedSession.avatar,
                    48
                  ) ? (
                    <img
                      src={
                        getAvatarUrl(
                          selectedSession.created_by,
                          selectedSession.avatar,
                          48
                        )!
                      }
                      alt={selectedSession.username}
                      className="w-12 h-12 rounded-full"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-zinc-700 rounded-full flex items-center justify-center">
                      <Users className="w-6 h-6 text-zinc-400" />
                    </div>
                  )}
                  <div>
                    <div className="text-white font-medium">
                      {selectedSession.username || 'Unknown User'}
                    </div>
                    <div className="text-xs text-zinc-500 font-mono">
                      {selectedSession.created_by}
                    </div>
                  </div>
                </div>
              </div>

              {/* Active Controllers */}
              <div className="bg-zinc-800 rounded-lg p-4">
                <h3 className="text-sm font-medium text-zinc-400 mb-3">
                  Active Controllers ({selectedSession.active_user_count || 0})
                </h3>
                {!selectedSession.active_users ||
                selectedSession.active_user_count === 0 ? (
                  <p className="text-zinc-500 text-sm">
                    No controllers currently active
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selectedSession.active_users.map((user) => {
                      const highestRole = getHighestRole(user.roles);
                      const RoleIcon = highestRole
                        ? getIconComponent(highestRole.icon)
                        : null;

                      return (
                        <div
                          key={user.id}
                          className="flex items-center space-x-3 bg-zinc-700/50 rounded-lg p-2 group relative"
                        >
                          <div className="relative">
                            {getAvatarUrl(user.id, user.avatar, 32) ? (
                              <img
                                src={getAvatarUrl(user.id, user.avatar, 32)!}
                                alt={user.username}
                                className="w-8 h-8 rounded-full transition-all"
                                style={{
                                  border: `2px solid ${highestRole?.color || '#71717a'}`,
                                }}
                              />
                            ) : (
                              <div
                                className="w-8 h-8 bg-zinc-600 rounded-full flex items-center justify-center transition-all"
                                style={{
                                  border: `2px solid ${highestRole?.color || '#71717a'}`,
                                }}
                              >
                                <Users className="w-4 h-4 text-zinc-400" />
                              </div>
                            )}

                            {/* Role Tooltip */}
                            {highestRole && RoleIcon && (
                              <div
                                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-zinc-900 border-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10"
                                style={{
                                  borderColor: highestRole.color,
                                }}
                              >
                                <div className="flex items-center gap-2">
                                  <RoleIcon
                                    className="w-3.5 h-3.5"
                                    style={{ color: highestRole.color }}
                                  />
                                  <span
                                    className="text-sm font-semibold"
                                    style={{ color: highestRole.color }}
                                  >
                                    {highestRole.name}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="text-white text-sm font-medium">
                              {user.username}{' '}
                              <span className="text-zinc-500 font-mono text-xs">
                                ({user.id})
                              </span>
                            </div>
                            {user.position && user.position !== 'POSITION' && (
                              <div className="text-xs text-zinc-400">
                                {user.position}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-2">
                <Button
                  onClick={() => handleJoinSession(selectedSession)}
                  className="w-full flex items-center justify-center space-x-2"
                  variant="primary"
                  size="sm"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Join Session</span>
                </Button>
                <Button
                  onClick={() =>
                    handleDeleteSession(selectedSession.session_id)
                  }
                  className="w-full flex items-center justify-center space-x-2"
                  variant="danger"
                  size="sm"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Session</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}
