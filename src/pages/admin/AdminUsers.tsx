import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
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
  Database,
  ShieldUser,
  Braces,
  ExternalLink,
  User,
  Check,
  Menu,
} from 'lucide-react';
import Navbar from '../../components/Navbar';
import AdminSidebar from '../../components/admin/AdminSidebar';
import Loader from '../../components/common/Loader';
import Dropdown from '../../components/common/Dropdown';
import {
  fetchAdminUsers,
  revealUserIP,
  fetchRoles,
  assignRoleToUser,
  type AdminUser,
  type Role,
} from '../../utils/fetch/admin';
import Button from '../../components/common/Button';
import Toast from '../../components/common/Toast';
import ErrorScreen from '../../components/common/ErrorScreen';
import { useAuth } from '../../hooks/auth/useAuth';
import { removeRoleFromUser } from '../../utils/fetch/admin';
import { getIconComponent } from '../../utils/roles';

export default function AdminUsers() {
  const { user } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterAdmin, setFilterAdmin] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [revealedIPs, setRevealedIPs] = useState<Set<string>>(new Set());
  const [revealingIP, setRevealingIP] = useState<string | null>(null);
  const [showFullscreenImage, setShowFullscreenImage] = useState(false);
  const [fullscreenImageUrl, setFullscreenImageUrl] = useState<string | null>(
    null
  );
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedUserForRole, setSelectedUserForRole] =
    useState<AdminUser | null>(null);
  const [assigningRole, setAssigningRole] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  const filterOptions = [
    { value: 'all', label: 'All Users' },
    { value: 'admin', label: 'Admins Only' },
    { value: 'non-admin', label: 'Non-Admins' },
    { value: 'cached', label: 'Cached Users Only' },
  ];

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [usersData, rolesData] = await Promise.all([
        fetchAdminUsers(page, limit, debouncedSearch, filterAdmin),
        fetchRoles(),
      ]);

      const sortedUsers = usersData.users.sort(
        (a, b) =>
          new Date(b.last_login).getTime() - new Date(a.last_login).getTime()
      );

      setUsers(sortedUsers);
      setRoles(rolesData);
      setTotalPages(usersData.pagination.pages);

      return sortedUsers;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch data';
      setError(errorMessage);
      setToast({
        message: errorMessage,
        type: 'error',
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, filterAdmin]);

  useEffect(() => {
    fetchData();
  }, [page, debouncedSearch, filterAdmin, fetchData]);

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

  const handleManageRole = (user: AdminUser) => {
    setSelectedUserForRole(user);
    setShowRoleModal(true);
  };

  const handleRemoveRole = async (userId: string, roleId: number) => {
    try {
      await removeRoleFromUser(userId, roleId);
      setToast({ message: 'Role removed successfully', type: 'success' });
      const updatedUsers = await fetchData();
      const updatedUser = updatedUsers.find((u) => u.id === userId);
      if (updatedUser) {
        setSelectedUserForRole(updatedUser);
      }
    } catch (error) {
      setToast({
        message:
          error instanceof Error ? error.message : 'Failed to remove role',
        type: 'error',
      });
    }
  };

  const handleAssignRole = async (roleId: number | null) => {
    if (!selectedUserForRole) return;

    try {
      setAssigningRole(true);

      if (roleId) {
        await assignRoleToUser(selectedUserForRole.id, roleId);
        setToast({
          message: 'Role assigned successfully',
          type: 'success',
        });
      } else {
        setToast({
          message: 'Please use the Admin Roles page to remove roles',
          type: 'info',
        });
      }

      const updatedUsers = await fetchData();
      const updatedUser = updatedUsers.find(
        (u) => u.id === selectedUserForRole.id
      );
      if (updatedUser) {
        setSelectedUserForRole(updatedUser);
      }
    } catch (error) {
      setToast({
        message:
          error instanceof Error ? error.message : 'Failed to update role',
        type: 'error',
      });
    } finally {
      setAssigningRole(false);
    }
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
        message: 'IP address revealed successfully',
        type: 'success',
      });
    } catch (error) {
      console.error('Error revealing IP:', error);
      setToast({
        message:
          error instanceof Error
            ? error.message
            : 'Failed to reveal IP address',
        type: 'error',
      });
    } finally {
      setRevealingIP(null);
    }
  };

  const formatIPAddress = (ip: string | null | undefined, userId: string) => {
    if (!ip) {
      return '***.***.***.**';
    }
    if (revealedIPs.has(userId)) {
      return ip;
    }

    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.***.**`;
    }
    return '***.***.***.**';
  };

  const API_BASE_URL = import.meta.env.VITE_SERVER_URL || '';

  type BackgroundImageSettings = {
    selectedImage?: string;
    useCustomBackground?: boolean;
    favorites?: string[];
  };

  const renderBackgroundImageSettings = (
    bgSettings: BackgroundImageSettings
  ) => {
    const { selectedImage, useCustomBackground, favorites } = bgSettings || {};
    const imageUrl = selectedImage
      ? selectedImage.startsWith('https://')
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
              <strong>Custom Background:</strong>{' '}
              <span
                className={
                  useCustomBackground ? 'text-green-400' : 'text-red-400'
                }
              >
                {useCustomBackground ? 'Enabled' : 'Disabled'}
              </span>
            </p>
            <p>
              <strong>Favorites:</strong> {favorites?.length || 0} items
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
                  (e.target as HTMLImageElement).src = '/placeholder-image.png';
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
        <h3 className="text-lg font-semibold text-white mb-4">Sounds</h3>
        <div className="space-y-3">
          {startupSound && (
            <div className="flex justify-between items-center text-sm text-zinc-300 bg-zinc-800 p-3 rounded">
              <span>Startup Sound:</span>
              <span
                className={
                  startupSound.enabled ? 'text-green-400' : 'text-red-400'
                }
              >
                {startupSound.enabled
                  ? `Enabled (${startupSound.volume}%)`
                  : 'Disabled'}
              </span>
            </div>
          )}
          {chatNotificationSound && (
            <div className="flex justify-between items-center text-sm text-zinc-300 bg-zinc-800 p-3 rounded">
              <span>Chat Notification:</span>
              <span
                className={
                  chatNotificationSound.enabled
                    ? 'text-green-400'
                    : 'text-red-400'
                }
              >
                {chatNotificationSound.enabled
                  ? `Enabled (${chatNotificationSound.volume}%)`
                  : 'Disabled'}
              </span>
            </div>
          )}
          {newStripSound && (
            <div className="flex justify-between items-center text-sm text-zinc-300 bg-zinc-800 p-3 rounded">
              <span>New Strip Sound:</span>
              <span
                className={
                  newStripSound.enabled ? 'text-green-400' : 'text-red-400'
                }
              >
                {newStripSound.enabled
                  ? `Enabled (${newStripSound.volume}%)`
                  : 'Disabled'}
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
        <h3 className="text-lg font-semibold text-white mb-4">Layout</h3>
        <div className="space-y-3 text-sm text-zinc-300">
          <div className="bg-zinc-800 p-3 rounded">
            <p>
              <strong>Combined View:</strong>{' '}
              <span
                className={showCombinedView ? 'text-green-400' : 'text-red-400'}
              >
                {showCombinedView ? 'Enabled' : 'Disabled'}
              </span>
            </p>
          </div>
          <div className="bg-zinc-800 p-3 rounded">
            <p>
              <strong>Flight Row Opacity:</strong> {flightRowOpacity}%
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
          Enabled: {enabledColumns.join(', ') || 'None'}
        </div>
      </div>
    );
  };

  type AcarsSettings = {
    notesEnabled?: boolean;
    chartsEnabled?: boolean;
    terminalWidth?: number;
    notesWidth?: number;
  };

  const renderAcarsSettings = (acarsSettings: AcarsSettings) => {
    const { notesEnabled, chartsEnabled, terminalWidth, notesWidth } =
      acarsSettings || {};
    const chartsWidth = 100 - (terminalWidth || 50) - (notesWidth || 20);

    return (
      <div className="space-y-4 p-4 bg-zinc-900 rounded-lg border-2 border-zinc-700">
        <h3 className="text-lg font-semibold text-white mb-4">
          ACARS Settings
        </h3>
        <div className="space-y-3">
          {/* Panel Status */}
          <div className="bg-zinc-800 p-3 rounded space-y-2">
            <div className="flex justify-between items-center text-sm text-zinc-300">
              <span>Notes Panel:</span>
              <span
                className={notesEnabled ? 'text-green-400' : 'text-red-400'}
              >
                {notesEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm text-zinc-300">
              <span>Charts Panel:</span>
              <span
                className={chartsEnabled ? 'text-green-400' : 'text-red-400'}
              >
                {chartsEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>

          {/* Panel Widths */}
          <div className="bg-zinc-800 p-3 rounded">
            <p className="text-xs text-zinc-400 mb-2">Panel Widths:</p>
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs text-zinc-300">
                <span>Terminal:</span>
                <span className="text-green-400 font-medium">
                  {terminalWidth || 50}%
                </span>
              </div>
              <div className="flex justify-between items-center text-xs text-zinc-300">
                <span>Notes:</span>
                <span className="text-blue-400 font-medium">
                  {notesWidth || 20}%
                </span>
              </div>
              <div className="flex justify-between items-center text-xs text-zinc-300">
                <span>Charts:</span>
                <span className="text-purple-400 font-medium">
                  {chartsWidth}%
                </span>
              </div>
            </div>

            {/* Visual Preview */}
            <div className="mt-3">
              <div className="h-2 flex rounded-full overflow-hidden">
                <div
                  style={{ width: `${terminalWidth || 50}%` }}
                  className="bg-green-500"
                  title={`Terminal: ${terminalWidth || 50}%`}
                />
                {notesEnabled && (
                  <div
                    style={{ width: `${notesWidth || 20}%` }}
                    className="bg-blue-500"
                    title={`Notes: ${notesWidth || 20}%`}
                  />
                )}
                {chartsEnabled && (
                  <div
                    style={{ width: `${chartsWidth}%` }}
                    className="bg-purple-500"
                    title={`Charts: ${chartsWidth}%`}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />
      <div className="flex pt-16">
        {/* Mobile Overlay */}
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
          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="lg:hidden fixed bottom-6 right-6 z-30 p-4 bg-green-600 hover:bg-green-700 rounded-full shadow-lg transition-colors"
          >
            <Menu className="h-6 w-6 text-white" />
          </button>

          {/* Header */}
          <div className="mb-6 sm:mb-8">
            <div className="flex items-center mb-4">
              <Users className="h-8 w-8 sm:h-10 sm:w-10 text-green-400 mr-4" />
              <div>
                <h1
                  className="text-3xl sm:text-4xl lg:text-5xl text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-green-600 font-extrabold mb-2"
                  style={{ lineHeight: 1.4 }}
                >
                  User Management
                </h1>
              </div>
            </div>
            {/* Search and Filter */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <div className="flex-1 relative group">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-zinc-400 group-focus-within:text-green-400 transition-colors" />
                {loading && search !== debouncedSearch && (
                  <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-green-400 animate-spin" />
                )}
                <input
                  type="text"
                  placeholder="Search by username, user ID or IP address..."
                  value={search}
                  onChange={handleSearchChange}
                  className="w-full pl-11 pr-10 py-3 bg-zinc-900/50 border-2 border-zinc-700 rounded-full text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-all duration-200 hover:border-zinc-600"
                />
              </div>
              <div className="relative w-full sm:w-52">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400 z-10 ml-3 pointer-events-none" />
                <Dropdown
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
            <ErrorScreen
              title="Error loading users"
              message={error}
              onRetry={fetchData}
            />
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block bg-zinc-900 border-2 border-zinc-700/50 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[800px]">
                    <thead className="bg-zinc-800">
                      <tr>
                        <th className="px-6 py-4 text-left text-zinc-400 font-medium">
                          User
                        </th>
                        <th className="px-6 py-4 text-left text-zinc-400 font-medium hidden sm:table-cell">
                          Last Login
                        </th>
                        {user?.isAdmin && (
                          <th className="px-6 py-4 text-left text-zinc-400 font-medium hidden md:table-cell">
                            IP Address
                          </th>
                        )}
                        <th className="px-6 py-4 text-left text-zinc-400 font-medium hidden lg:table-cell">
                          VPN
                        </th>
                        <th className="px-6 py-4 text-left text-zinc-400 font-medium hidden xl:table-cell">
                          Sessions
                        </th>
                        <th className="px-6 py-4 text-left text-zinc-400 font-medium hidden lg:table-cell">
                          Role
                        </th>
                        <th className="px-6 py-4 text-left text-zinc-400 font-medium hidden xl:table-cell">
                          Cached
                        </th>
                        <th className="px-6 py-4 text-left text-zinc-400 font-medium">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((tableUser) => (
                        <tr
                          key={tableUser.id}
                          className="border-t border-zinc-700/50 hover:bg-zinc-800/50"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-3">
                              {tableUser.avatar ? (
                                <img
                                  src={`https://cdn.discordapp.com/avatars/${tableUser.id}/${tableUser.avatar}.png`}
                                  alt={tableUser.username}
                                  className="w-8 h-8 rounded-full"
                                />
                              ) : (
                                <div className="w-8 h-8 bg-zinc-600 rounded-full flex items-center justify-center">
                                  <Users className="w-4 h-4 text-zinc-400" />
                                </div>
                              )}
                              <div className="flex flex-col">
                                <span className="text-white font-medium">
                                  {tableUser.username}
                                </span>
                                <span className="text-zinc-400 text-xs">
                                  {tableUser.id}
                                </span>
                                <span className="text-zinc-400 text-xs sm:hidden">
                                  Last:{' '}
                                  {new Date(
                                    tableUser.last_login
                                  ).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-zinc-300 hidden sm:table-cell">
                            {new Date(
                              tableUser.last_login
                            ).toLocaleDateString()}
                          </td>
                          {user?.isAdmin && (
                            <td className="px-6 py-4 text-zinc-300 hidden md:table-cell">
                              <div className="flex items-center space-x-2">
                                <span
                                  className={
                                    revealedIPs.has(tableUser.id)
                                      ? ''
                                      : 'filter blur-sm'
                                  }
                                >
                                  {formatIPAddress(
                                    tableUser.ip_address,
                                    tableUser.id
                                  )}
                                </span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleRevealIP(tableUser.id)}
                                  disabled={revealingIP === tableUser.id}
                                  className="p-1"
                                >
                                  {revealingIP === tableUser.id ? (
                                    <div className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
                                  ) : revealedIPs.has(tableUser.id) ? (
                                    <EyeOff className="w-4 h-4" />
                                  ) : (
                                    <Eye className="w-4 h-4" />
                                  )}
                                </Button>
                              </div>
                            </td>
                          )}
                          <td className="px-6 py-4 hidden lg:table-cell">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                tableUser.is_vpn
                                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                  : 'bg-green-500/20 text-green-400 border border-green-500/30'
                              }`}
                            >
                              {tableUser.is_vpn ? 'Yes' : 'No'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-zinc-300 hidden xl:table-cell">
                            {tableUser.current_sessions_count ?? 0}
                          </td>
                          <td className="px-6 py-4 hidden lg:table-cell">
                            <div className="flex flex-wrap gap-2">
                              {tableUser.is_admin && (
                                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30 w-fit">
                                  <Braces className="w-3 h-3" />
                                  Developer
                                </span>
                              )}
                              {!tableUser.is_admin &&
                              tableUser.roles &&
                              tableUser.roles.length > 0
                                ? tableUser.roles.length === 1
                                  ? // Single role: Show icon and name
                                    (() => {
                                      const role = tableUser.roles[0];
                                      const RoleIcon = getIconComponent(
                                        role.icon
                                      );
                                      return (
                                        <span
                                          key={role.id}
                                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border w-fit"
                                          style={{
                                            backgroundColor: `${role.color}20`,
                                            color: role.color,
                                            borderColor: `${role.color}40`,
                                          }}
                                        >
                                          <RoleIcon className="w-3 h-3" />
                                          {role.name}
                                        </span>
                                      );
                                    })()
                                  : // Multiple roles: Show only icons
                                    tableUser.roles.map((role) => {
                                      const RoleIcon = getIconComponent(
                                        role.icon
                                      );
                                      return (
                                        <span
                                          key={role.id}
                                          className="inline-flex items-center justify-center w-6 h-6 rounded-full border"
                                          style={{
                                            backgroundColor: `${role.color}20`,
                                            borderColor: `${role.color}40`,
                                          }}
                                          title={role.name}
                                        >
                                          <RoleIcon
                                            className="w-3 h-3"
                                            style={{ color: role.color }}
                                          />
                                        </span>
                                      );
                                    })
                                : !tableUser.is_admin && (
                                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-zinc-600/20 text-zinc-400 border border-zinc-600/30 w-fit">
                                      No Role
                                    </span>
                                  )}
                            </div>
                          </td>
                          <td className="px-6 py-4 hidden xl:table-cell">
                            <img
                              src={`${API_BASE_URL}/assets/app/icons/redis${tableUser.cached ? '-green' : ''}.svg`}
                              alt="Redis cache status"
                              className="w-6 h-6"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-1 sm:space-y-0 sm:space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleViewSettings(tableUser)}
                                className="p-2 w-full sm:w-auto"
                              >
                                <Settings className="w-4 h-4" />
                              </Button>
                              {!tableUser.is_admin && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => handleManageRole(tableUser)}
                                  className="p-2 w-full sm:w-auto bg-rose-500/20 border-rose-500/30 hover:bg-rose-500/30"
                                >
                                  <ShieldUser className="w-4 h-4" />
                                </Button>
                              )}
                              {(tableUser.current_sessions_count || 0) >= 1 && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() =>
                                    (window.location.href = `/admin/sessions?userId=${tableUser.id}`)
                                  }
                                  className="p-2 w-full sm:w-auto bg-yellow-500/20 border-yellow-500/30 hover:bg-yellow-500/30"
                                >
                                  <Database className="w-4 h-4" />
                                </Button>
                              )}
                              {!tableUser.is_admin && (
                                <Button
                                  size="sm"
                                  variant="danger"
                                  onClick={() =>
                                    (window.location.href = `/admin/bans?userId=${
                                      tableUser.id
                                    }&username=${encodeURIComponent(
                                      tableUser.username
                                    )}`)
                                  }
                                  className="flex items-center space-x-2 w-full sm:w-auto"
                                >
                                  <Ban className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile Cards */}
              <div className="block md:hidden space-y-4">
                {users.map((tableUser) => (
                  <div
                    key={tableUser.id}
                    className="bg-zinc-900 border-2 border-zinc-700/50 rounded-2xl p-4"
                  >
                    <div className="flex items-center space-x-3 mb-4">
                      {tableUser.avatar ? (
                        <img
                          src={`https://cdn.discordapp.com/avatars/${tableUser.id}/${tableUser.avatar}.png`}
                          alt={tableUser.username}
                          className="w-12 h-12 rounded-full"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-zinc-600 rounded-full flex items-center justify-center">
                          <Users className="w-6 h-6 text-zinc-400" />
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="text-white font-medium text-lg">
                          {tableUser.username}
                        </div>
                        <div className="text-zinc-400 text-sm">
                          {tableUser.id}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 text-sm text-zinc-300">
                      <div>
                        Last Login:{' '}
                        {new Date(tableUser.last_login).toLocaleDateString()}
                      </div>
                      {user?.isAdmin && (
                        <div className="flex items-center space-x-2">
                          <span>
                            IP:{' '}
                            {formatIPAddress(
                              tableUser.ip_address,
                              tableUser.id
                            )}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRevealIP(tableUser.id)}
                            disabled={revealingIP === tableUser.id}
                            className="p-1"
                          >
                            {revealingIP === tableUser.id ? (
                              <div className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
                            ) : revealedIPs.has(tableUser.id) ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      )}
                      <div>VPN: {tableUser.is_vpn ? 'Yes' : 'No'}</div>
                      <div>
                        Sessions: {tableUser.current_sessions_count ?? 0}
                      </div>
                      <div>
                        Role:
                        {tableUser.is_admin ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30 ml-2">
                            <Braces className="w-3 h-3" />
                            Developer
                          </span>
                        ) : tableUser.roles && tableUser.roles.length > 0 ? (
                          <div className="flex flex-wrap gap-2 mt-1">
                            {tableUser.roles.map((role) => {
                              const RoleIcon = getIconComponent(role.icon);
                              return (
                                <span
                                  key={role.id}
                                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border"
                                  style={{
                                    backgroundColor: `${role.color}20`,
                                    color: role.color,
                                    borderColor: `${role.color}40`,
                                  }}
                                >
                                  <RoleIcon className="w-3 h-3" />
                                  {role.name}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-zinc-400 ml-2">No Role</span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <span>Cached:</span>
                        <img
                          src={`${API_BASE_URL}/assets/app/icons/redis${
                            tableUser.cached ? '-green' : ''
                          }.svg`}
                          alt="Redis cache status"
                          className="w-6 h-6"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewSettings(tableUser)}
                        className="flex-1"
                      >
                        <Settings className="w-4 h-4 mr-2" />
                        Settings
                      </Button>
                      {!tableUser.is_admin && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleManageRole(tableUser)}
                          className="flex-1 bg-rose-500/20 border-rose-500/30 hover:bg-rose-500/30"
                        >
                          <ShieldUser className="w-4 h-4 mr-2" />
                          Role
                        </Button>
                      )}
                      {(tableUser.current_sessions_count || 0) >= 1 && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            (window.location.href = `/admin/sessions?userId=${tableUser.id}`)
                          }
                          className="flex-1 bg-yellow-500/20 border-yellow-500/30 hover:bg-yellow-500/30"
                        >
                          <Database className="w-4 h-4 mr-2" />
                          Sessions
                        </Button>
                      )}
                      {!tableUser.is_admin && (
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() =>
                            (window.location.href = `/admin/bans?userId=${
                              tableUser.id
                            }&username=${encodeURIComponent(tableUser.username)}`)
                          }
                          className="flex-1"
                        >
                          <Ban className="w-4 h-4 mr-2" />
                          Ban
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
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
            </>
          )}

          {/* Role Assignment Modal */}
          {showRoleModal && selectedUserForRole && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-40">
              <div className="bg-zinc-900 border-2 border-zinc-700 rounded-2xl p-6 max-w-md w-full mx-4">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <ShieldUser className="w-6 h-6 text-rose-400" />
                    <h2 className="text-xl font-bold text-white">
                      Manage Roles
                    </h2>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowRoleModal(false)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="space-y-4">
                  <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-4">
                    <div className="flex items-center space-x-3 mb-2">
                      {selectedUserForRole.avatar ? (
                        <img
                          src={`https://cdn.discordapp.com/avatars/${selectedUserForRole.id}/${selectedUserForRole.avatar}.png`}
                          alt={selectedUserForRole.username}
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 bg-zinc-600 rounded-full flex items-center justify-center">
                          <Users className="w-4 h-4 text-zinc-400" />
                        </div>
                      )}
                      <div>
                        <div className="text-white font-medium">
                          {selectedUserForRole.username}
                        </div>
                        <div className="text-zinc-400 text-sm">
                          {selectedUserForRole.id}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-zinc-300">
                      Current Roles:{' '}
                      {selectedUserForRole.roles &&
                      selectedUserForRole.roles.length > 0 ? (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {selectedUserForRole.roles.map((role) => {
                            const RoleIcon = getIconComponent(role.icon);
                            return (
                              <span
                                key={role.id}
                                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border"
                                style={{
                                  backgroundColor: `${role.color}20`,
                                  color: role.color,
                                  borderColor: `${role.color}40`,
                                }}
                              >
                                <RoleIcon className="w-3 h-3" />
                                {role.name}
                                <button
                                  onClick={() =>
                                    handleRemoveRole(
                                      selectedUserForRole.id,
                                      role.id
                                    )
                                  }
                                  className="ml-1 text-zinc-400 hover:text-white"
                                  title="Remove role"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        'No Roles'
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-zinc-300 mb-2 font-medium">
                      Add Role
                    </label>
                    <Dropdown
                      options={[
                        { value: '', label: '+ Add Role' },
                        ...roles
                          .filter(
                            (role) =>
                              !selectedUserForRole.roles?.some(
                                (ur) => ur.id === role.id
                              )
                          )
                          .map((role) => ({
                            value: role.id.toString(),
                            label: role.name,
                          })),
                      ]}
                      value=""
                      onChange={(val) => {
                        if (val !== '') {
                          handleAssignRole(parseInt(val));
                        }
                      }}
                      size="sm"
                      className="w-full"
                    />
                  </div>

                  <div>
                    <button
                      onClick={() => {
                        selectedUserForRole.roles?.forEach((role) =>
                          handleRemoveRole(selectedUserForRole.id, role.id)
                        );
                      }}
                      disabled={
                        assigningRole || !selectedUserForRole.roles?.length
                      }
                      className="w-full p-3 rounded-lg border bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 transition-colors"
                    >
                      <div className="font-medium">Remove All Roles</div>
                      <div className="text-sm text-zinc-400">
                        Remove all role permissions
                      </div>
                    </button>
                  </div>

                  {assigningRole && (
                    <div className="flex items-center justify-center py-4">
                      <div className="flex items-center space-x-3 text-zinc-400">
                        <div className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
                        <span>Updating roles...</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Settings Modal */}
          {showSettings && selectedUser && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="bg-zinc-900 border-2 border-zinc-700 rounded-2xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <Settings className="w-6 h-6 text-blue-400" />
                    <h2 className="text-xl font-bold text-white">
                      {selectedUser.username}'s Settings
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

                {/* Account Information Section */}
                <div className="bg-zinc-800/50 border-2 border-zinc-700/50 rounded-lg p-4 space-y-3 mb-6">
                  <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide mb-3">
                    Account Information
                  </h3>

                  {/* Roblox Account Status */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-zinc-400" />
                      <span className="text-zinc-300 text-sm">
                        Roblox Account
                      </span>
                    </div>
                    {selectedUser.roblox_username ? (
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-400" />
                        <span className="text-green-400 text-sm font-medium">
                          {selectedUser.roblox_username}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <X className="w-4 h-4 text-red-400" />
                        <span className="text-red-400 text-sm">Not Linked</span>
                      </div>
                    )}
                  </div>

                  {/* Public Profile Link */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-zinc-400" />
                      <span className="text-zinc-300 text-sm">
                        Public Profile
                      </span>
                    </div>
                    <Link
                      to={`/user/${selectedUser.username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 rounded-lg text-blue-400 hover:text-blue-300 text-sm font-medium transition-all"
                    >
                      View Profile
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>

                <div className="space-y-6">
                  {selectedUser.settings ? (
                    <>
                      {renderBackgroundImageSettings({
                        ...selectedUser.settings.backgroundImage,
                        selectedImage:
                          selectedUser.settings.backgroundImage
                            ?.selectedImage ?? undefined,
                      })}
                      {renderSoundSettings(selectedUser.settings.sounds)}
                      {renderLayoutSettings(selectedUser.settings.layout)}
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
                          'Departure'
                        )}
                        {renderTableColumns(
                          selectedUser.settings
                            .arrivalsTableColumns as unknown as Record<
                            string,
                            boolean
                          >,
                          'Arrivals'
                        )}
                      </div>
                      {selectedUser.settings.acars &&
                        renderAcarsSettings(
                          selectedUser.settings.acars as AcarsSettings
                        )}
                      <div className="space-y-4 p-4 bg-zinc-900 rounded-lg border-2 border-zinc-700">
                        <h3 className="text-lg font-semibold text-white mb-4">
                          Other Settings
                        </h3>
                        <div className="space-y-2 text-sm text-zinc-300">
                          <div>
                            <strong>Tutorial Completed:</strong>{' '}
                            <span
                              className={
                                selectedUser.settings.tutorialCompleted
                                  ? 'text-green-400'
                                  : 'text-red-400'
                              }
                            >
                              {selectedUser.settings.tutorialCompleted
                                ? 'Yes'
                                : 'No'}
                            </span>
                          </div>
                          <div>
                            <strong>Display Linked Accounts:</strong>{' '}
                            <span
                              className={
                                selectedUser.settings
                                  .displayLinkedAccountsOnProfile
                                  ? 'text-green-400'
                                  : 'text-red-400'
                              }
                            >
                              {selectedUser.settings
                                .displayLinkedAccountsOnProfile
                                ? 'Yes'
                                : 'No'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-4 p-4 bg-zinc-900 rounded-lg border-2 border-zinc-700">
                        <h3 className="text-lg font-semibold text-white mb-4">
                          Raw Settings Data
                        </h3>
                        <pre className="bg-zinc-800 rounded p-3 text-xs text-zinc-300 overflow-x-auto">
                          {JSON.stringify(selectedUser.settings, null, 2)}
                        </pre>
                      </div>
                    </>
                  ) : (
                    <p className="text-zinc-400 text-center">
                      No settings available for this user.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Fullscreen Image Modal */}
          {showFullscreenImage && fullscreenImageUrl && (
            <div
              className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50"
              onClick={() => setShowFullscreenImage(false)}
            >
              <div className="relative w-full h-full p-4 flex items-center justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute top-4 right-4 z-10"
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
                    style={{ borderRadius: '1rem' }}
                  />
                </div>
              </div>
            </div>
          )}
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
    </div>
  );
}
