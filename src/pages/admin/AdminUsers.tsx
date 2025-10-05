import { useState, useEffect } from "react";
import {
    Users,
    Search,
    Filter,
    Settings,
    Eye,
    EyeOff,
    X,
    Ban,
    Loader2,
    Calendar,
} from "lucide-react";
import Navbar from "../../components/Navbar";
import AdminSidebar from "../../components/admin/AdminSidebar";
import Loader from "../../components/common/Loader";
import ProtectedRoute from "../../components/ProtectedRoute";
import Dropdown from "../../components/common/Dropdown";
import {
    fetchAdminUsers,
    revealUserIP,
    type AdminUsersResponse,
    type AdminUser,
} from "../../utils/fetch/admin";
import Button from "../../components/common/Button";
import Toast from "../../components/common/Toast";

export default function AdminUsers() {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [limit] = useState(50);
    const [totalPages, setTotalPages] = useState(1);
    const [totalUsers, setTotalUsers] = useState(0);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [filterAdmin, setFilterAdmin] = useState<string>("all");
    const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
    const [showSettings, setShowSettings] = useState(false);
    const [revealedIPs, setRevealedIPs] = useState<Set<string>>(new Set());
    const [revealingIP, setRevealingIP] = useState<string | null>(null);
    const [showFullscreenImage, setShowFullscreenImage] = useState(false);
    const [fullscreenImageUrl, setFullscreenImageUrl] = useState<string | null>(
        null
    );
    const [toast, setToast] = useState<{
        message: string;
        type: "success" | "error" | "info";
    } | null>(null);

    const filterOptions = [
        { value: "all", label: "All Users" },
        { value: "admin", label: "Admins Only" },
        { value: "non-admin", label: "Non-Admins" },
    ];

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
        }, 300);

        return () => clearTimeout(timer);
    }, [search]);

    // Fetch users when debounced search, page, or filter changes
    useEffect(() => {
        fetchUsers();
    }, [page, debouncedSearch, filterAdmin]);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            setError(null);

            const data: AdminUsersResponse = await fetchAdminUsers(
                page,
                limit,
                debouncedSearch,
                filterAdmin
            );

            setUsers(data.users);
            setTotalPages(data.pagination.pages);
            setTotalUsers(data.pagination.total);
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to fetch users"
            );
        } finally {
            setLoading(false);
        }
    };

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearch(e.target.value);
        setPage(1);
    };

    const handleFilterChange = (value: string) => {
        setFilterAdmin(value);
        setPage(1);
    };

    const handleViewSettings = (user: AdminUser) => {
        setSelectedUser(user);
        setShowSettings(true);
    };

    const closeSettingsModal = () => {
        setShowSettings(false);
        setSelectedUser(null);
    };

    const handleRevealIP = async (userId: string) => {
        if (revealedIPs.has(userId)) {
            setRevealedIPs((prev) => {
                const newSet = new Set(prev);
                newSet.delete(userId);
                return newSet;
            });
            return;
        }

        try {
            setRevealingIP(userId);
            await revealUserIP(userId);
            setRevealedIPs((prev) => new Set(prev).add(userId));
            setToast({
                message: "IP address revealed successfully",
                type: "success",
            });
        } catch (error) {
            console.error("Error revealing IP:", error);
            setToast({
                message:
                    error instanceof Error
                        ? error.message
                        : "Failed to reveal IP address",
                type: "error",
            });
        } finally {
            setRevealingIP(null);
        }
    };

    const formatIPAddress = (ip: string | null | undefined, userId: string) => {
        if (!ip) {
            return "***.***.***.**";
        }
        if (revealedIPs.has(userId)) {
            return ip;
        }

        const parts = ip.split(".");
        if (parts.length === 4) {
            return `${parts[0]}.${parts[1]}.***.**`;
        }
        return "***.***.***.**";
    };

    const API_BASE_URL = import.meta.env.VITE_SERVER_URL || "";

    type BackgroundImageSettings = {
        selectedImage?: string;
        useCustomBackground?: boolean;
        favorites?: string[];
    };

    const renderBackgroundImageSettings = (
        bgSettings: BackgroundImageSettings
    ) => {
        const { selectedImage, useCustomBackground, favorites } =
            bgSettings || {};
        const imageUrl = selectedImage
            ? selectedImage.startsWith("https://")
                ? selectedImage
                : `${API_BASE_URL}/assets/app/backgrounds/${selectedImage}`
            : null;

        return (
            <div className="space-y-4 p-4 bg-zinc-900 rounded-lg border-2 border-zinc-700">
                <h3 className="text-lg font-semibold text-white mb-4">
                    Background Image
                </h3>
                <div className="flex items-center space-x-4">
                    <div className="text-sm text-zinc-300 flex-1">
                        <p className="mb-2">
                            <strong>Custom Background:</strong>{" "}
                            <span
                                className={
                                    useCustomBackground
                                        ? "text-green-400"
                                        : "text-red-400"
                                }
                            >
                                {useCustomBackground ? "Enabled" : "Disabled"}
                            </span>
                        </p>
                        <p>
                            <strong>Favorites:</strong> {favorites?.length || 0}{" "}
                            items
                        </p>
                    </div>
                    {imageUrl ? (
                        <div
                            className="w-32 h-20 border border-zinc-600 rounded-lg overflow-hidden cursor-pointer hover:border-blue-500 transition-colors"
                            onClick={() => {
                                setFullscreenImageUrl(imageUrl);
                                setShowFullscreenImage(true);
                            }}
                        >
                            <img
                                src={imageUrl}
                                alt="Selected background"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).src =
                                        "/placeholder-image.png";
                                }}
                            />
                        </div>
                    ) : (
                        <div className="w-32 h-20 bg-zinc-700 rounded-lg flex items-center justify-center text-zinc-400 text-xs">
                            No image selected
                        </div>
                    )}
                </div>
            </div>
        );
    };

    type SoundSetting = {
        enabled: boolean;
        volume: number;
    };

    type SoundSettings = {
        startupSound?: SoundSetting;
        chatNotificationSound?: SoundSetting;
        newStripSound?: SoundSetting;
    };

    const renderSoundSettings = (soundSettings: SoundSettings) => {
        const { startupSound, chatNotificationSound, newStripSound } =
            soundSettings || {};
        return (
            <div className="space-y-4 p-4 bg-zinc-900 rounded-lg border-2 border-zinc-700">
                <h3 className="text-lg font-semibold text-white mb-4">
                    Sounds
                </h3>
                <div className="space-y-3">
                    {startupSound && (
                        <div className="flex justify-between items-center text-sm text-zinc-300 bg-zinc-800 p-3 rounded">
                            <span>Startup Sound:</span>
                            <span
                                className={
                                    startupSound.enabled
                                        ? "text-green-400"
                                        : "text-red-400"
                                }
                            >
                                {startupSound.enabled
                                    ? `Enabled (${startupSound.volume}%)`
                                    : "Disabled"}
                            </span>
                        </div>
                    )}
                    {chatNotificationSound && (
                        <div className="flex justify-between items-center text-sm text-zinc-300 bg-zinc-800 p-3 rounded">
                            <span>Chat Notification:</span>
                            <span
                                className={
                                    chatNotificationSound.enabled
                                        ? "text-green-400"
                                        : "text-red-400"
                                }
                            >
                                {chatNotificationSound.enabled
                                    ? `Enabled (${chatNotificationSound.volume}%)`
                                    : "Disabled"}
                            </span>
                        </div>
                    )}
                    {newStripSound && (
                        <div className="flex justify-between items-center text-sm text-zinc-300 bg-zinc-800 p-3 rounded">
                            <span>New Strip Sound:</span>
                            <span
                                className={
                                    newStripSound.enabled
                                        ? "text-green-400"
                                        : "text-red-400"
                                }
                            >
                                {newStripSound.enabled
                                    ? `Enabled (${newStripSound.volume}%)`
                                    : "Disabled"}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    type LayoutSettings = {
        showCombinedView?: boolean;
        flightRowOpacity?: number;
    };

    const renderLayoutSettings = (layoutSettings: LayoutSettings) => {
        const { showCombinedView, flightRowOpacity } = layoutSettings || {};
        return (
            <div className="space-y-4 p-4 bg-zinc-900 rounded-lg border-2 border-zinc-700">
                <h3 className="text-lg font-semibold text-white mb-4">
                    Layout
                </h3>
                <div className="space-y-3 text-sm text-zinc-300">
                    <div className="bg-zinc-800 p-3 rounded">
                        <p>
                            <strong>Combined View:</strong>{" "}
                            <span
                                className={
                                    showCombinedView
                                        ? "text-green-400"
                                        : "text-red-400"
                                }
                            >
                                {showCombinedView ? "Enabled" : "Disabled"}
                            </span>
                        </p>
                    </div>
                    <div className="bg-zinc-800 p-3 rounded">
                        <p>
                            <strong>Flight Row Opacity:</strong>{" "}
                            {flightRowOpacity}%
                        </p>
                    </div>
                </div>
            </div>
        );
    };

    const renderTableColumns = (
        columns: Record<string, boolean> | undefined,
        type: string
    ) => {
        if (!columns) return null;
        const enabledColumns = Object.entries(columns)
            .filter(([, enabled]) => enabled)
            .map(([key]) => key);
        return (
            <div className="space-y-2 p-4 bg-zinc-900 rounded-lg border-2 border-zinc-700">
                <h4 className="text-md font-medium text-zinc-200 mb-2">
                    {type} Table Columns
                </h4>
                <div className="text-sm text-zinc-300 bg-zinc-800 p-3 rounded">
                    Enabled: {enabledColumns.join(", ") || "None"}
                </div>
            </div>
        );
    };

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
                            <div className="flex items-center mb-4">
                                <div className="p-3 bg-green-500/20 rounded-xl mr-4">
                                    <Users className="h-8 w-8 text-green-400" />
                                </div>
                                <div>
                                    <h1
                                        className="text-5xl text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-green-600 font-extrabold mb-2"
                                        style={{ lineHeight: 1.2 }}
                                    >
                                        User Management
                                    </h1>
                                    <p className="text-zinc-400">
                                        {totalUsers} total user{totalUsers !== 1 ? 's' : ''}
                                    </p>
                                </div>
                            </div>
                            {/* Search and Filter */}
                            <div className="flex space-x-4">
                                <div className="flex-1 relative group">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-zinc-400 group-focus-within:text-green-400 transition-colors" />
                                    {loading && search !== debouncedSearch && (
                                        <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-green-400 animate-spin" />
                                    )}
                                    <input
                                        type="text"
                                        placeholder="Search by username or user ID..."
                                        value={search}
                                        onChange={handleSearchChange}
                                        className="w-full pl-11 pr-10 py-3 bg-zinc-900/50 border-2 border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-all duration-200 hover:border-zinc-600"
                                    />
                                </div>
                                <div className="relative w-52">
                                    <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400 z-10 ml-3 pointer-events-none" />
                                    <Dropdown
                                        size="sm"
                                        options={filterOptions}
                                        value={filterAdmin}
                                        onChange={handleFilterChange}
                                        placeholder="Filter users..."
                                        className="pl-10"
                                    />
                                </div>
                            </div>
                        </div>

                        {loading ? (
                            <div className="flex justify-center py-12">
                                <Loader />
                            </div>
                        ) : error ? (
                            <div className="text-center py-12">
                                <div className="text-red-400 mb-2">
                                    Error loading users
                                </div>
                                <div className="text-zinc-400 text-sm">
                                    {error}
                                </div>
                                <button
                                    onClick={fetchUsers}
                                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                >
                                    Retry
                                </button>
                            </div>
                        ) : (
                            <>
                                {/* Users Table */}
                                <div className="bg-zinc-900 border-2 border-zinc-700/50 rounded-2xl overflow-hidden">
                                    <table className="w-full">
                                        <thead className="bg-zinc-800">
                                            <tr>
                                                <th className="px-6 py-4 text-left text-zinc-400 font-medium">
                                                    User
                                                </th>
                                                <th className="px-6 py-4 text-left text-zinc-400 font-medium">
                                                    Last Login
                                                </th>
                                                <th className="px-6 py-4 text-left text-zinc-400 font-medium">
                                                    IP Address
                                                </th>
                                                <th className="px-6 py-4 text-left text-zinc-400 font-medium">
                                                    VPN
                                                </th>
                                                <th className="px-6 py-4 text-left text-zinc-400 font-medium">
                                                    Sessions
                                                </th>
                                                <th className="px-6 py-4 text-left text-zinc-400 font-medium">
                                                    Admin
                                                </th>
                                                <th className="px-6 py-4 text-left text-zinc-400 font-medium">
                                                    Actions
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {users.map((user) => (
                                                <tr
                                                    key={user.id}
                                                    className="border-t border-zinc-700/50 hover:bg-zinc-800/50"
                                                >
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center space-x-3">
                                                            {user.avatar ? (
                                                                <img
                                                                    src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`}
                                                                    alt={
                                                                        user.username
                                                                    }
                                                                    className="w-8 h-8 rounded-full"
                                                                />
                                                            ) : (
                                                                <div className="w-8 h-8 bg-zinc-600 rounded-full flex items-center justify-center">
                                                                    <Users className="w-4 h-4 text-zinc-400" />
                                                                </div>
                                                            )}
                                                            <span className="text-white font-medium">
                                                                {user.username}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-zinc-300">
                                                        {new Date(
                                                            user.last_login
                                                        ).toLocaleDateString()}
                                                    </td>
                                                    <td className="px-6 py-4 text-zinc-300">
                                                        <div className="flex items-center space-x-2">
                                                            <span
                                                                className={
                                                                    revealedIPs.has(
                                                                        user.id
                                                                    )
                                                                        ? ""
                                                                        : "filter blur-sm"
                                                                }
                                                            >
                                                                {formatIPAddress(
                                                                    user.ip_address,
                                                                    user.id
                                                                )}
                                                            </span>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() =>
                                                                    handleRevealIP(
                                                                        user.id
                                                                    )
                                                                }
                                                                disabled={
                                                                    revealingIP ===
                                                                    user.id
                                                                }
                                                                className="p-1"
                                                            >
                                                                {revealingIP ===
                                                                user.id ? (
                                                                    <div className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
                                                                ) : revealedIPs.has(
                                                                      user.id
                                                                  ) ? (
                                                                    <EyeOff className="w-4 h-4" />
                                                                ) : (
                                                                    <Eye className="w-4 h-4" />
                                                                )}
                                                            </Button>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span
                                                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                                user.is_vpn
                                                                    ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                                                    : "bg-green-500/20 text-green-400 border border-green-500/30"
                                                            }`}
                                                        >
                                                            {user.is_vpn
                                                                ? "Yes"
                                                                : "No"}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-zinc-300">
                                                        {user.total_sessions_created ||
                                                            0}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {user.is_admin ? (
                                                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                                                Admin
                                                            </span>
                                                        ) : (
                                                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-zinc-600/20 text-zinc-400 border border-zinc-600/30">
                                                                User
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center space-x-2">
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() =>
                                                                    handleViewSettings(
                                                                        user
                                                                    )
                                                                }
                                                                className="flex items-center space-x-2"
                                                            >
                                                                <Settings className="w-4 h-4" />
                                                                <span>
                                                                    Settings
                                                                </span>
                                                            </Button>
                                                            {(user.total_sessions_created ||
                                                                0) >= 1 && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="secondary"
                                                                    onClick={() =>
                                                                        (window.location.href = `/admin/sessions?userId=${user.id}`)
                                                                    }
                                                                    className="flex items-center space-x-2"
                                                                >
                                                                    <Calendar className="w-4 h-4" />
                                                                    <span>
                                                                        Sessions
                                                                    </span>
                                                                </Button>
                                                            )}
                                                            {!user.is_admin && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="danger"
                                                                    onClick={() =>
                                                                        (window.location.href = `/admin/bans?userId=${
                                                                            user.id
                                                                        }&username=${encodeURIComponent(
                                                                            user.username
                                                                        )}`)
                                                                    }
                                                                    className="flex items-center space-x-2"
                                                                >
                                                                    <Ban className="w-4 h-4" />
                                                                    <span>
                                                                        Ban
                                                                    </span>
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination */}
                                <div className="flex justify-center mt-8 space-x-2">
                                    <Button
                                        onClick={() =>
                                            setPage(Math.max(1, page - 1))
                                        }
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
                                        onClick={() =>
                                            setPage(
                                                Math.min(totalPages, page + 1)
                                            )
                                        }
                                        disabled={page === totalPages}
                                        variant="outline"
                                        size="xs"
                                    >
                                        Next
                                    </Button>
                                </div>
                            </>
                        )}

                        {/* Settings Modal */}
                        {showSettings && selectedUser && (
                            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                                <div className="bg-zinc-900 border-2 border-zinc-700 rounded-2xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto shadow-2xl">
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="flex items-center space-x-3">
                                            <Settings className="w-6 h-6 text-blue-400" />
                                            <h2 className="text-xl font-bold text-white">
                                                {selectedUser.username}'s
                                                Settings
                                            </h2>
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={closeSettingsModal}
                                        >
                                            Close
                                        </Button>
                                    </div>
                                    <div className="space-y-6">
                                        {selectedUser.settings ? (
                                            <>
                                                {renderBackgroundImageSettings({
                                                    ...selectedUser.settings
                                                        .backgroundImage,
                                                    selectedImage:
                                                        selectedUser.settings
                                                            .backgroundImage
                                                            ?.selectedImage ??
                                                        undefined,
                                                })}
                                                {renderSoundSettings(
                                                    selectedUser.settings.sounds
                                                )}
                                                {renderLayoutSettings(
                                                    selectedUser.settings.layout
                                                )}
                                                <div className="space-y-4 p-4 bg-zinc-900 rounded-lg border-2 border-zinc-700">
                                                    <h3 className="text-lg font-semibold text-white mb-4">
                                                        Table Columns
                                                    </h3>
                                                    {renderTableColumns(
                                                        selectedUser.settings
                                                            .departureTableColumns as unknown as Record<
                                                            string,
                                                            boolean
                                                        >,
                                                        "Departure"
                                                    )}
                                                    {renderTableColumns(
                                                        selectedUser.settings
                                                            .arrivalsTableColumns as unknown as Record<
                                                            string,
                                                            boolean
                                                        >,
                                                        "Arrivals"
                                                    )}
                                                </div>
                                            </>
                                        ) : (
                                            <p className="text-zinc-400 text-center">
                                                No settings available for this
                                                user.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Fullscreen Image Modal */}
                        {showFullscreenImage && fullscreenImageUrl && (
                            <div
                                className="fixed inset-24 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50"
                                onClick={() => setShowFullscreenImage(false)}
                            >
                                <div className="relative w-full h-full p-4 flex items-center justify-center">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="absolute -top-6 right-12 z-10"
                                        onClick={() => {
                                            setShowFullscreenImage(false);
                                        }}
                                    >
                                        <X className="w-4 h-4" />
                                    </Button>
                                    <div className="max-w-full max-h-full flex items-center justify-center">
                                        <img
                                            src={fullscreenImageUrl}
                                            alt="Fullscreen background"
                                            className="object-contain rounded-xl max-w-full max-h-full"
                                            style={{ borderRadius: "1rem" }}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

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
