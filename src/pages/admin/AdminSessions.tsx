import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
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
} from "lucide-react";
import Navbar from "../../components/Navbar";
import AdminSidebar from "../../components/admin/AdminSidebar";
import Loader from "../../components/common/Loader";
import ProtectedRoute from "../../components/ProtectedRoute";
import Button from "../../components/common/Button";
import Toast from "../../components/common/Toast";
import {
    fetchAdminSessions,
    deleteAdminSession,
    logSessionJoin,
    type AdminSession,
} from "../../utils/fetch/admin";

type ViewMode = "grid" | "list";
type SortBy = "date" | "airport" | "creator";

export default function AdminSessions() {
    const [searchParams] = useSearchParams();
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [sessions, setSessions] = useState<AdminSession[]>([]);
    const [filteredSessions, setFilteredSessions] = useState<AdminSession[]>(
        []
    );
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>("grid");
    const [search, setSearch] = useState(searchParams.get("userId") || "");
    const [sortBy, setSortBy] = useState<SortBy>("date");
    const [selectedSession, setSelectedSession] = useState<AdminSession | null>(
        null
    );
    const [showModal, setShowModal] = useState(false);
    const [toast, setToast] = useState<{
        message: string;
        type: "success" | "error" | "info";
    } | null>(null);

    useEffect(() => {
        fetchSessions();
    }, []);

    useEffect(() => {
        filterAndSortSessions();
    }, [sessions, search, sortBy]);

    const fetchSessions = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await fetchAdminSessions();
            setSessions(data);
        } catch (err) {
            const errorMessage =
                err instanceof Error ? err.message : "Failed to fetch sessions";
            setError(errorMessage);
            setToast({
                message: errorMessage,
                type: "error",
            });
        } finally {
            setLoading(false);
        }
    };

    const filterAndSortSessions = () => {
        let filtered = [...sessions];

        // Filter by search
        if (search.trim()) {
            const searchLower = search.toLowerCase();
            filtered = filtered.filter(
                (session) =>
                    session.session_id.toLowerCase().includes(searchLower) ||
                    session.airport_icao.toLowerCase().includes(searchLower) ||
                    session.username?.toLowerCase().includes(searchLower) ||
                    session.created_by.toLowerCase().includes(searchLower)
            );
        }

        // Sort
        filtered.sort((a, b) => {
            switch (sortBy) {
                case "date":
                    return (
                        new Date(b.created_at).getTime() -
                        new Date(a.created_at).getTime()
                    );
                case "airport":
                    return a.airport_icao.localeCompare(b.airport_icao);
                case "creator":
                    return (a.username || a.created_by).localeCompare(
                        b.username || b.created_by
                    );
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
            window.open(url, "_blank");
        } catch (err) {
            console.error('Error logging session join:', err);
            // Still open the session even if logging fails
            const url = `${window.location.origin}/view/${session.session_id}/?accessId=${session.access_id}`;
            window.open(url, "_blank");
        }
    };

    const handleDeleteSession = async (sessionId: string) => {
        if (
            !confirm(
                "Are you sure you want to delete this session? This action cannot be undone."
            )
        ) {
            return;
        }

        try {
            await deleteAdminSession(sessionId);
            setToast({
                message: "Session deleted successfully",
                type: "success",
            });
            setShowModal(false);
            setSelectedSession(null);
            fetchSessions();
        } catch (err) {
            setToast({
                message:
                    err instanceof Error
                        ? err.message
                        : "Failed to delete session",
                type: "error",
            });
        }
    };

    const formatTimeAgo = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();

        if (isNaN(diffMs) || isNaN(date.getTime())) return "Unknown";
        if (diffMs < 0) return "Just now";

        const diffSecs = Math.floor(diffMs / 1000);
        const diffMins = Math.floor(diffSecs / 60);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffDays > 0) return `${diffDays}d ago`;
        if (diffHours > 0) return `${diffHours}h ago`;
        if (diffMins > 0) return `${diffMins}m ago`;
        if (diffSecs > 0) return `${diffSecs}s ago`;
        return "Just now";
    };

    const formatDateTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "UTC",
            timeZoneName: "short",
        });
    };

    const getAvatarUrl = (
        userId: string,
        avatar: string | null,
        size: number = 64
    ) => {
        if (!avatar) return null;

        // If it's already a full URL, return it as-is
        if (avatar.startsWith("http")) {
            return avatar;
        }

        // Otherwise, construct URL from hash
        const isAnimated = avatar.startsWith("a_");
        const extension = isAnimated ? "gif" : "png";
        return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.${extension}?size=${size}`;
    };

    const renderSessionGrid = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSessions.map((session) => (
                <div
                    key={session.session_id}
                    className="bg-zinc-900 border-2 border-zinc-700/50 rounded-2xl p-6 hover:border-green-500/50 transition-all duration-200"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                            <div className="p-2 bg-green-500/20 rounded-lg">
                                <Activity className="w-5 h-5 text-green-400" />
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
                        {getAvatarUrl(
                            session.created_by,
                            session.avatar,
                            40
                        ) ? (
                            <img
                                src={
                                    getAvatarUrl(
                                        session.created_by,
                                        session.avatar,
                                        40
                                    )!
                                }
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
                                {session.username || "Unknown User"}
                            </p>
                            <p className="text-xs text-zinc-500 font-mono truncate">
                                {session.created_by}
                            </p>
                        </div>
                    </div>

                    {/* Details */}
                    <div className="space-y-2 mb-4">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-zinc-400">Active Runway</span>
                            <span className="text-white font-medium">
                                {session.active_runway || "N/A"}
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
                        {session.is_pfatc && (
                            <div className="flex items-center justify-center">
                                <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                    PFATC Session
                                </span>
                            </div>
                        )}
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
            <table className="w-full">
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
                            Runway
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
                                    <div className="p-2 bg-green-500/20 rounded-lg">
                                        <Activity className="w-4 h-4 text-green-400" />
                                    </div>
                                    <div>
                                        <div className="text-white font-bold">
                                            {session.airport_icao}
                                        </div>
                                        <div className="text-xs text-zinc-500 font-mono">
                                            {session.session_id}
                                        </div>
                                        {session.is_pfatc && (
                                            <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                                PFATC
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex items-center space-x-3">
                                    {getAvatarUrl(
                                        session.created_by,
                                        session.avatar,
                                        32
                                    ) ? (
                                        <img
                                            src={
                                                getAvatarUrl(
                                                    session.created_by,
                                                    session.avatar,
                                                    32
                                                )!
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
                                            {session.username || "Unknown User"}
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
                                    {session.active_runway || "N/A"}
                                </span>
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex items-center space-x-2">
                                    <Button
                                        size="sm"
                                        variant="primary"
                                        onClick={() =>
                                            handleJoinSession(session)
                                        }
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
    );

    return (
        <ProtectedRoute requireAdmin={true}>
            <div className="min-h-screen bg-black text-white">
                <Navbar />
                <div className="flex pt-16">
                    <AdminSidebar
                        collapsed={sidebarCollapsed}
                        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
                    />
                    <div className="flex-1 p-8">
                        {/* Header */}
                        <div className="mb-8">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center">
                                    <div className="p-3 bg-yellow-500/20 rounded-xl mr-4">
                                        <Database className="h-8 w-8 text-yellow-400" />
                                    </div>
                                    <div>
                                        <h1
                                            className="text-5xl text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600 font-extrabold mb-2"
                                            style={{ lineHeight: 1.2 }}
                                        >
                                            Sessions
                                        </h1>
                                        <p className="text-zinc-400">
                                            {filteredSessions.length} active
                                            session
                                            {filteredSessions.length !== 1
                                                ? "s"
                                                : ""}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Controls */}
                            <div className="flex flex-col md:flex-row gap-4">
                                {/* Search */}
                                <div className="flex-1 relative group">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-zinc-400 group-focus-within:text-green-400 transition-colors" />
                                    <input
                                        type="text"
                                        placeholder="Search by session ID, airport, or creator..."
                                        value={search}
                                        onChange={(e) =>
                                            setSearch(e.target.value)
                                        }
                                        className="w-full pl-11 pr-4 py-3 bg-zinc-900/50 border-2 border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-all duration-200 hover:border-zinc-600"
                                    />
                                </div>

                                {/* Sort */}
                                <select
                                    value={sortBy}
                                    onChange={(e) =>
                                        setSortBy(e.target.value as SortBy)
                                    }
                                    className="px-4 py-3 bg-zinc-900/50 border-2 border-zinc-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-all duration-200 hover:border-zinc-600"
                                >
                                    <option value="date">Sort by Date</option>
                                    <option value="airport">
                                        Sort by Airport
                                    </option>
                                    <option value="creator">
                                        Sort by Creator
                                    </option>
                                </select>

                                {/* View Mode Toggle */}
                                <div className="flex bg-zinc-900/50 border-2 border-zinc-700 rounded-xl overflow-hidden">
                                    <button
                                        onClick={() => setViewMode("grid")}
                                        className={`px-4 py-3 flex items-center space-x-2 transition-colors ${
                                            viewMode === "grid"
                                                ? "bg-green-500 text-white"
                                                : "text-zinc-400 hover:text-white"
                                        }`}
                                    >
                                        <Grid3x3 className="w-4 h-4" />
                                        <span className="hidden sm:inline">
                                            Grid
                                        </span>
                                    </button>
                                    <button
                                        onClick={() => setViewMode("list")}
                                        className={`px-4 py-3 flex items-center space-x-2 transition-colors ${
                                            viewMode === "list"
                                                ? "bg-green-500 text-white"
                                                : "text-zinc-400 hover:text-white"
                                        }`}
                                    >
                                        <List className="w-4 h-4" />
                                        <span className="hidden sm:inline">
                                            List
                                        </span>
                                    </button>
                                </div>

                                {/* Refresh Button */}
                                <Button
                                    onClick={fetchSessions}
                                    variant="outline"
                                    size="sm"
                                    className="px-4 py-3 flex items-center space-x-2"
                                    disabled={loading}
                                >
                                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
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
                            <div className="text-center py-12">
                                <div className="text-red-400 mb-2">
                                    Error loading sessions
                                </div>
                                <div className="text-zinc-400 text-sm">
                                    {error}
                                </div>
                                <button
                                    onClick={fetchSessions}
                                    className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                                >
                                    Retry
                                </button>
                            </div>
                        ) : filteredSessions.length === 0 ? (
                            <div className="text-center py-12 text-zinc-400">
                                {search
                                    ? "No sessions found matching your search."
                                    : "No active sessions."}
                            </div>
                        ) : (
                            <>
                                {viewMode === "grid"
                                    ? renderSessionGrid()
                                    : renderSessionList()}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* More Actions Modal */}
            {showModal && selectedSession && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-zinc-900 border-2 border-zinc-700 rounded-2xl p-6 max-w-md w-full mx-4">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-white">
                                Session Details
                            </h2>
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
                                    <div className="p-2 bg-green-500/20 rounded-lg">
                                        <Activity className="w-5 h-5 text-green-400" />
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
                                            {selectedSession.active_runway ||
                                                "N/A"}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-zinc-400">
                                            <Calendar className="w-4 h-4 inline mr-2" />
                                            Created
                                        </span>
                                        <span className="text-white font-medium">
                                            {formatDateTime(
                                                selectedSession.created_at
                                            )}
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
                                            {selectedSession.username ||
                                                "Unknown User"}
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
                                    Active Controllers (
                                    {selectedSession.active_user_count || 0})
                                </h3>
                                {!selectedSession.active_users ||
                                selectedSession.active_user_count === 0 ? (
                                    <p className="text-zinc-500 text-sm">
                                        No controllers currently active
                                    </p>
                                ) : (
                                    <div className="space-y-2">
                                        {selectedSession.active_users.map(
                                            (user) => (
                                                <div
                                                    key={user.id}
                                                    className="flex items-center space-x-3 bg-zinc-700/50 rounded-lg p-2"
                                                >
                                                    {getAvatarUrl(
                                                        user.id,
                                                        user.avatar,
                                                        32
                                                    ) ? (
                                                        <img
                                                            src={
                                                                getAvatarUrl(
                                                                    user.id,
                                                                    user.avatar,
                                                                    32
                                                                )!
                                                            }
                                                            alt={user.username}
                                                            className="w-8 h-8 rounded-full"
                                                        />
                                                    ) : (
                                                        <div className="w-8 h-8 bg-zinc-600 rounded-full flex items-center justify-center">
                                                            <Users className="w-4 h-4 text-zinc-400" />
                                                        </div>
                                                    )}
                                                    <div className="flex-1">
                                                        <div className="text-white text-sm font-medium">
                                                            {user.username}{" "}
                                                            <span className="text-zinc-500 font-mono text-xs">
                                                                ({user.id})
                                                            </span>
                                                        </div>
                                                        {user.position &&
                                                            user.position !==
                                                                "POSITION" && (
                                                                <div className="text-xs text-zinc-400">
                                                                    {
                                                                        user.position
                                                                    }
                                                                </div>
                                                            )}
                                                    </div>
                                                </div>
                                            )
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="space-y-2 pt-2">
                                <Button
                                    onClick={() =>
                                        handleJoinSession(selectedSession)
                                    }
                                    className="w-full flex items-center justify-center space-x-2"
                                    variant="primary"
                                    size="sm"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                    <span>Join Session</span>
                                </Button>
                                <Button
                                    onClick={() =>
                                        handleDeleteSession(
                                            selectedSession.session_id
                                        )
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
        </ProtectedRoute>
    );
}
