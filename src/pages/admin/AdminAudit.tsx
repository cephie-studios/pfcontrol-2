import { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Search,
  Filter,
  Calendar,
  User,
  Eye,
  EyeOff,
  Clock,
  Ban,
  X,
  Trash2,
  ExternalLink,
  Database,
  Plus,
  Settings,
  Shield,
  ShieldUser,
  Edit,
  Menu,
  CheckCircle,
  UsersRound,
  MessageCircleX,
  MessageCircleMore,
  MessageCircleIcon,
} from 'lucide-react';
import Navbar from '../../components/Navbar';
import AdminSidebar from '../../components/admin/AdminSidebar';
import Loader from '../../components/common/Loader';
import Dropdown from '../../components/common/Dropdown';
import {
  fetchAuditLogs,
  revealAuditLogIP,
  type AuditLogsResponse,
  type AuditLog,
} from '../../utils/fetch/admin';
import Button from '../../components/common/Button';
import Toast from '../../components/common/Toast';
import ErrorScreen from '../../components/common/ErrorScreen';

export default function AdminAudit() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adminFilter, setAdminFilter] = useState('');
  const [actionTypeFilter, setActionTypeFilter] = useState('');
  const [targetUserFilter, setTargetUserFilter] = useState('');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);
  const [revealedIPs, setRevealedIPs] = useState<Set<number>>(new Set());
  const [revealingIP, setRevealingIP] = useState<number | null>(null);

  const actionTypeOptions = [
    { value: '', label: 'All Actions' },
    { value: 'ADMIN_DASHBOARD_ACCESSED', label: 'Dashboard Access' },
    { value: 'ADMIN_USERS_ACCESSED', label: 'Users Page Access' },
    { value: 'ADMIN_SESSIONS_ACCESSED', label: 'Sessions Access' },
    { value: 'ADMIN_SYSTEM_INFO_ACCESSED', label: 'System Info Access' },
    { value: 'ADMIN_AUDIT_LOGS_ACCESSED', label: 'Audit Logs Access' },
    { value: 'ADMIN_TESTERS_ACCESSED', label: 'Testers Page Access' },
    { value: 'IP_ADDRESS_VIEWED', label: 'IP Address Revealed' },
    {
      value: 'AUDIT_LOG_IP_VIEWED',
      label: 'Audit Log IP Address Revealed',
    },
    { value: 'USER_BANNED', label: 'User Banned' },
    { value: 'USER_UNBANNED', label: 'User Unbanned' },
    { value: 'ADMIN_BANS_ACCESSED', label: 'Bans Page Access' },
    { value: 'SESSION_DELETED', label: 'Session Deleted' },
    { value: 'SESSION_JOINED', label: 'Session Joined' },
    { value: 'TESTER_ADDED', label: 'Tester Added' },
    { value: 'TESTER_REMOVED', label: 'Tester Removed' },
    { value: 'TESTER_SETTINGS_UPDATED', label: 'Tester Settings Updated' },
    { value: 'ROLE_ASSIGNED', label: 'Role Assigned' },
    { value: 'ROLE_REMOVED', label: 'Role Removed' },
    { value: 'ROLE_UPDATED', label: 'Role Updated' },
    { value: 'IP_REVEALED', label: 'IP Revealed' },
    { value: 'NOTIFICATION_ADDED', label: 'Notification Added' },
    { value: 'NOTIFICATION_UPDATED', label: 'Notification Updated' },
    { value: 'NOTIFICATION_DELETED', label: 'Notification Deleted' },
    { value: 'ADMIN_VERSION_UPDATED', label: 'Version Updated' },
    { value: 'CHAT_REPORT_DELETED', label: 'Chat Report Deleted' },
    {
      value: 'CHAT_REPORT_STATUS_UPDATED',
      label: 'Chat Report Status Updated',
    },
    { value: 'CHAT_REPORT_RESOLVED', label: 'Chat Report Resolved' },
    { value: 'ROLE_PRIORITIES_UPDATED', label: 'Role Priorities Updated' },
    { value: 'UPDATE_MODAL_PUBLISHED', label: 'Update Modal Published' },
    { value: 'UPDATE_MODAL_UNPUBLISHED', label: 'Update Modal Unpublished' },
    { value: 'UPDATE_MODAL_CREATED', label: 'Update Modal Created' },
    { value: 'UPDATE_MODAL_DELETED', label: 'Update Modal Deleted' },
    { value: 'UPDATE_MODAL_UPDATED', label: 'Update Modal Updated' },
    { value: 'FLIGHT_LOG_IP_REVEALED', label: 'Flight Log IP Revealed' },
    { value: 'FEEDBACK_DELETED', label: 'Feedback Deleted' },
  ];

  useEffect(() => {
    setClientPage(1);
  }, [
    adminFilter,
    actionTypeFilter,
    targetUserFilter,
    dateFromFilter,
    dateToFilter,
  ]);

  useEffect(() => {
    fetchLogs();
  }, [
    adminFilter,
    actionTypeFilter,
    targetUserFilter,
    dateFromFilter,
    dateToFilter,
  ]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);

      const filters = {
        adminId: adminFilter || undefined,
        actionType: actionTypeFilter || undefined,
        targetUserId: targetUserFilter || undefined,
        dateFrom: dateFromFilter || undefined,
        dateTo: dateToFilter || undefined,
      };

      let allLogs: AuditLog[] = [];
      let currentPage = 1;
      let totalPagesFromServer = 1;
      const bigLimit = 500;

      while (currentPage <= Math.min(totalPagesFromServer, 5)) {
        const data: AuditLogsResponse = await fetchAuditLogs(
          currentPage,
          bigLimit,
          filters
        );
        allLogs = [...allLogs, ...data.logs];
        totalPagesFromServer = data.pagination.pages;
        currentPage++;

        const activityLogs = allLogs.filter(
          (log) => !log.action_type.includes('_ACCESSED')
        );
        if (activityLogs.length >= 500) break;
      }

      setLogs(allLogs);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch audit logs';
      setError(errorMessage);
      setToast({
        message: errorMessage,
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAdminFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAdminFilter(e.target.value);
  };

  const handleTargetUserFilterChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setTargetUserFilter(e.target.value);
  };

  const handleActionTypeChange = (value: string) => {
    setActionTypeFilter(value);
  };

  const handleDateFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDateFromFilter(e.target.value);
  };

  const handleDateToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDateToFilter(e.target.value);
  };

  const handleViewDetails = (log: AuditLog) => {
    setSelectedLog(log);
    setShowDetails(true);
  };

  const closeDetailsModal = () => {
    setShowDetails(false);
    setSelectedLog(null);
  };

  const clearFilters = () => {
    setAdminFilter('');
    setActionTypeFilter('');
    setTargetUserFilter('');
    setDateFromFilter('');
    setDateToFilter('');
  };

  const formatActionType = (actionType: string) => {
    switch (actionType) {
      case 'ADMIN_DASHBOARD_ACCESSED':
        return 'Dashboard Access';
      case 'ADMIN_USERS_ACCESSED':
        return 'Users Page Access';
      case 'ADMIN_SESSIONS_ACCESSED':
        return 'Sessions Access';
      case 'ADMIN_SYSTEM_INFO_ACCESSED':
        return 'System Info Access';
      case 'ADMIN_AUDIT_LOGS_ACCESSED':
        return 'Audit Logs Access';
      case 'ADMIN_TESTERS_ACCESSED':
        return 'Testers Page Access';
      case 'IP_ADDRESS_VIEWED':
        return 'IP Address Revealed';
      case 'AUDIT_LOG_IP_VIEWED':
        return 'Audit Log IP Address Revealed';
      case 'USER_BANNED':
        return 'User Banned';
      case 'USER_UNBANNED':
        return 'User Unbanned';
      case 'ADMIN_BANS_ACCESSED':
        return 'Bans Page Access';
      case 'SESSION_DELETED':
        return 'Session Deleted';
      case 'SESSION_JOINED':
        return 'Session Joined';
      case 'TESTER_ADDED':
        return 'Tester Added';
      case 'TESTER_REMOVED':
        return 'Tester Removed';
      case 'TESTER_SETTINGS_UPDATED':
        return 'Tester Settings Updated';
      case 'ROLE_ASSIGNED':
        return 'Role Assigned';
      case 'ROLE_REMOVED':
        return 'Role Removed';
      case 'ROLE_UPDATED':
        return 'Role Updated';
      case 'IP_REVEALED':
        return 'IP Revealed';
      case 'NOTIFICATION_ADDED':
        return 'Notification Added';
      case 'NOTIFICATION_UPDATED':
        return 'Notification Updated';
      case 'NOTIFICATION_DELETED':
        return 'Notification Deleted';
      case 'ADMIN_VERSION_UPDATED':
        return 'Version Updated';
      case 'CHAT_REPORT_DELETED':
        return 'Chat Report Deleted';
      case 'CHAT_REPORT_STATUS_UPDATED':
        return 'Chat Report Status Updated';
      case 'CHAT_REPORT_RESOLVED':
        return 'Chat Report Resolved';
      case 'ROLE_PRIORITIES_UPDATED':
        return 'Role Priorities Updated';
      case 'UPDATE_MODAL_PUBLISHED':
        return 'Update Modal Published';
      case 'UPDATE_MODAL_UNPUBLISHED':
        return 'Update Modal Unpublished';
      case 'UPDATE_MODAL_CREATED':
        return 'Update Modal Created';
      case 'UPDATE_MODAL_DELETED':
        return 'Update Modal Deleted';
      case 'UPDATE_MODAL_UPDATED':
        return 'Update Modal Updated';
      case 'FLIGHT_LOG_IP_REVEALED':
        return 'Flight Log IP Revealed';
      case 'FEEDBACK_DELETED':
        return 'Feedback Deleted';
      default:
        return actionType;
    }
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'IP_ADDRESS_VIEWED':
      case 'AUDIT_LOG_IP_VIEWED':
      case 'IP_REVEALED':
        return <Eye className="w-4 h-4 text-orange-400" />;
      case 'ADMIN_DASHBOARD_ACCESSED':
        return <ShieldAlert className="w-4 h-4 text-blue-400" />;
      case 'ADMIN_USERS_ACCESSED':
        return <User className="w-4 h-4 text-green-400" />;
      case 'ADMIN_SESSIONS_ACCESSED':
        return <Database className="w-4 h-4 text-yellow-400" />;
      case 'ADMIN_SYSTEM_INFO_ACCESSED':
        return <Settings className="w-4 h-4 text-cyan-400" />;
      case 'ADMIN_TESTERS_ACCESSED':
        return <Shield className="w-4 h-4 text-purple-400" />;
      case 'ADMIN_AUDIT_LOGS_ACCESSED':
        return <ShieldAlert className="w-4 h-4 text-orange-400" />;
      case 'USER_BANNED':
      case 'ADMIN_BANS_ACCESSED':
        return <Ban className="w-4 h-4 text-red-400" />;
      case 'USER_UNBANNED':
        return <X className="w-4 h-4 text-green-400" />;
      case 'SESSION_DELETED':
        return <Trash2 className="w-4 h-4 text-red-400" />;
      case 'SESSION_JOINED':
        return <ExternalLink className="w-4 h-4 text-blue-400" />;
      case 'TESTER_ADDED':
        return <Plus className="w-4 h-4 text-green-400" />;
      case 'TESTER_REMOVED':
        return <Trash2 className="w-4 h-4 text-red-400" />;
      case 'TESTER_SETTINGS_UPDATED':
        return <Settings className="w-4 h-4 text-blue-400" />;
      case 'ROLE_ASSIGNED':
        return <ShieldUser className="w-4 h-4 text-green-400" />;
      case 'ROLE_REMOVED':
        return <ShieldUser className="w-4 h-4 text-red-400" />;
      case 'ROLE_UPDATED':
        return <ShieldUser className="w-4 h-4 text-blue-400" />;
      case 'NOTIFICATION_ADDED':
        return <Plus className="w-4 h-4 text-green-400" />;
      case 'NOTIFICATION_UPDATED':
        return <Edit className="w-4 h-4 text-cyan-400" />;
      case 'NOTIFICATION_DELETED':
        return <Trash2 className="w-4 h-4 text-red-400" />;
      case 'ADMIN_VERSION_UPDATED':
        return <Settings className="w-4 h-4 text-teal-500" />;
      case 'CHAT_REPORT_DELETED':
        return <MessageCircleX className="w-4 h-4 text-red-400" />;
      case 'CHAT_REPORT_STATUS_UPDATED':
        return <MessageCircleMore className="w-4 h-4 text-blue-400" />;
      case 'CHAT_REPORT_RESOLVED':
        return <MessageCircleIcon className="w-4 h-4 text-green-400" />;
      case 'ROLE_PRIORITIES_UPDATED':
        return <UsersRound className="w-4 h-4 text-purple-400" />;
      case 'UPDATE_MODAL_PUBLISHED':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'UPDATE_MODAL_UNPUBLISHED':
        return <EyeOff className="w-4 h-4 text-red-400" />;
      case 'UPDATE_MODAL_CREATED':
        return <Plus className="w-4 h-4 text-green-400" />;
      case 'UPDATE_MODAL_DELETED':
        return <Trash2 className="w-4 h-4 text-red-400" />;
      case 'UPDATE_MODAL_UPDATED':
        return <Edit className="w-4 h-4 text-blue-400" />;
      case 'FLIGHT_LOG_IP_REVEALED':
        return <Eye className="w-4 h-4 text-orange-400" />;
      case 'FEEDBACK_DELETED':
        return <Trash2 className="w-4 h-4 text-red-400" />;
      default:
        return <ShieldAlert className="w-4 h-4 text-zinc-400" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const handleRevealIP = async (logId: number) => {
    if (revealedIPs.has(logId)) {
      setRevealedIPs((prev) => {
        const newSet = new Set(prev);
        newSet.delete(logId);
        return newSet;
      });
      return;
    }

    try {
      setRevealingIP(logId);
      await revealAuditLogIP(logId);
      setRevealedIPs((prev) => new Set(prev).add(logId));
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

  const formatIPAddress = (ip: string | null | undefined, logId: number) => {
    if (!ip) {
      return '***.***.***.**';
    }
    if (revealedIPs.has(logId)) {
      return ip;
    }

    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.***.**`;
    }
    return '***.***.***.**';
  };

  const isPageNavAction = (actionType: string) => {
    return actionType.includes('_ACCESSED');
  };

  const filteredLogs = logs.filter((log) => !isPageNavAction(log.action_type));

  // Client-side pagination for filtered logs
  const [clientPage, setClientPage] = useState(1);
  const clientLimit = 50;
  const filteredTotalPages = Math.max(
    1,
    Math.ceil(filteredLogs.length / clientLimit)
  );
  const paginatedLogs = filteredLogs.slice(
    (clientPage - 1) * clientLimit,
    clientPage * clientLimit
  );

  return (
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
            <div className="flex items-center mb-4">
              <div className="p-2 sm:p-3 bg-orange-500/20 rounded-xl mr-3 sm:mr-4">
                <ShieldAlert className="h-6 w-6 sm:h-8 sm:w-8 text-orange-400" />
              </div>
              <h1
                className="text-3xl sm:text-4xl lg:text-5xl text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-600 font-extrabold mb-2"
                style={{ lineHeight: 1.4 }}
              >
                Audit Log
              </h1>
            </div>

            {/* Filters */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Admin Filter */}
                <div className="relative">
                  <User className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Filter by admin username..."
                    value={adminFilter}
                    onChange={handleAdminFilterChange}
                    className="w-full pl-10 pr-4 py-2 bg-zinc-900 border-2 border-zinc-700 rounded-full text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                {/* Target User Filter */}
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Filter by target user..."
                    value={targetUserFilter}
                    onChange={handleTargetUserFilterChange}
                    className="w-full pl-10 pr-4 py-2 bg-zinc-900 border-2 border-zinc-700 rounded-full text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                {/* Action Type Filter */}
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400 z-10 ml-3" />
                  <Dropdown
                    size="sm"
                    options={actionTypeOptions}
                    value={actionTypeFilter}
                    onChange={handleActionTypeChange}
                    placeholder="Filter by action..."
                    className="pl-10 h-11"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Date From */}
                <div>
                  <label className="block text-zinc-500 text-xs -mt-2 mb-2">
                    From Date
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input
                      type="datetime-local"
                      placeholder="From date..."
                      value={dateFromFilter}
                      onChange={handleDateFromChange}
                      className="w-full pl-10 pr-4 py-2 bg-zinc-900 border-2 border-zinc-700 rounded-full text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>

                {/* Date To */}
                <div>
                  <label className="block text-zinc-500 text-xs -mt-2 mb-2">
                    To Date
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input
                      type="datetime-local"
                      placeholder="To date..."
                      value={dateToFilter}
                      onChange={handleDateToChange}
                      className="w-full pl-10 pr-4 py-2 bg-zinc-900 border-2 border-zinc-700 rounded-full text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>

                {/* Clear Filters */}
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={clearFilters}
                    variant="outline"
                    size="md"
                    className="h-11 mt-4"
                  >
                    Clear Filters
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader />
            </div>
          ) : error ? (
            <ErrorScreen
              title="Error loading audit logs"
              message={error}
              onRetry={fetchLogs}
            />
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden lg:block bg-zinc-900 border-2 border-zinc-700/50 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1000px]">
                    <thead className="bg-zinc-800">
                      <tr>
                        <th className="px-6 py-4 text-left text-zinc-400 font-medium">
                          Action
                        </th>
                        <th className="px-6 py-4 text-left text-zinc-400 font-medium">
                          Admin
                        </th>
                        <th className="px-6 py-4 text-left text-zinc-400 font-medium">
                          Target User
                        </th>
                        <th className="px-6 py-4 text-left text-zinc-400 font-medium">
                          Timestamp
                        </th>
                        <th className="px-6 py-4 text-left text-zinc-400 font-medium">
                          IP Address
                        </th>
                        <th className="px-6 py-4 text-left text-zinc-400 font-medium">
                          Details
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedLogs.map((log) => (
                        <tr
                          key={log.id}
                          className="border-t border-zinc-700/50 hover:bg-zinc-800/50"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-3">
                              {getActionIcon(log.action_type)}
                              <div className="flex flex-col">
                                <span className="text-white font-medium">
                                  {formatActionType(log.action_type)}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-zinc-300">
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {log.admin_username}
                              </span>
                              <span className="text-xs text-zinc-500">
                                {log.admin_id}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-zinc-300">
                            {log.target_username ? (
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {log.target_username}
                                </span>
                                <span className="text-xs text-zinc-500">
                                  {log.target_user_id}
                                </span>
                              </div>
                            ) : (
                              <span className="text-zinc-500">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-zinc-300">
                            <div className="flex items-center space-x-2">
                              <Clock className="w-4 h-4 text-zinc-500" />
                              <span className="text-sm">
                                {formatDate(log.timestamp)}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-zinc-300">
                            <div className="flex items-center space-x-2">
                              <span
                                className={`font-mono text-sm ${
                                  revealedIPs.has(log.id)
                                    ? ''
                                    : 'filter blur-sm'
                                }`}
                              >
                                {formatIPAddress(log.ip_address, log.id)}
                              </span>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleRevealIP(log.id)}
                                disabled={revealingIP === log.id}
                                className="p-1"
                              >
                                {revealingIP === log.id ? (
                                  <div className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
                                ) : revealedIPs.has(log.id) ? (
                                  <EyeOff className="w-4 h-4" />
                                ) : (
                                  <Eye className="w-4 h-4" />
                                )}
                              </Button>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleViewDetails(log)}
                              className="flex items-center space-x-2"
                            >
                              <Eye className="w-4 h-4" />
                              <span>View</span>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile Card View */}
              <div className="lg:hidden space-y-4">
                {paginatedLogs.map((log) => (
                  <div
                    key={log.id}
                    className="bg-zinc-900 border-2 border-zinc-700/50 rounded-2xl p-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3">
                        {getActionIcon(log.action_type)}
                        <div>
                          <p className="text-white font-medium">
                            {formatActionType(log.action_type)}
                          </p>
                        </div>
                      </div>

                      <div>
                        <p className="text-zinc-300">
                          <strong>Admin:</strong> {log.admin_username}
                        </p>
                        <p className="text-zinc-400 text-xs">{log.admin_id}</p>
                      </div>

                      {log.target_username ? (
                        <div>
                          <p className="text-zinc-300">
                            <strong>Target User:</strong> {log.target_username}
                          </p>
                          <p className="text-zinc-400 text-xs">
                            {log.target_user_id}
                          </p>
                        </div>
                      ) : (
                        <p className="text-zinc-500">
                          <strong>Target User:</strong> -
                        </p>
                      )}

                      <p className="text-zinc-300">
                        <strong>Timestamp:</strong> {formatDate(log.timestamp)}
                      </p>

                      <div className="flex items-center space-x-2">
                        <p className="text-zinc-300">
                          <strong>IP:</strong>{' '}
                          <span
                            className={`font-mono text-sm ${
                              revealedIPs.has(log.id) ? '' : 'filter blur-sm'
                            }`}
                          >
                            {formatIPAddress(log.ip_address, log.id)}
                          </span>
                        </p>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRevealIP(log.id)}
                          disabled={revealingIP === log.id}
                          className="p-1"
                        >
                          {revealingIP === log.id ? (
                            <div className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
                          ) : revealedIPs.has(log.id) ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </Button>
                      </div>

                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleViewDetails(log)}
                          className="flex items-center space-x-2"
                        >
                          <Eye className="w-4 h-4" />
                          <span className="hidden lg:inline">View</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {filteredLogs.length === 0 && (
                <div className="text-center py-12 text-zinc-400">
                  {logs.length > 0
                    ? 'No action logs found. All logs are page navigation events.'
                    : 'No audit logs found with the current filters.'}
                </div>
              )}

              {/* Client-side pagination for filtered logs */}
              <div className="flex justify-center mt-8 space-x-2">
                <Button
                  onClick={() => setClientPage(Math.max(1, clientPage - 1))}
                  disabled={clientPage === 1 || filteredLogs.length === 0}
                  variant="outline"
                  size="sm"
                >
                  Previous
                </Button>
                <span className="text-zinc-400 py-2">
                  Page {filteredLogs.length === 0 ? 0 : clientPage} of{' '}
                  {filteredLogs.length === 0 ? 0 : filteredTotalPages}
                </span>
                <Button
                  onClick={() =>
                    setClientPage(Math.min(filteredTotalPages, clientPage + 1))
                  }
                  disabled={
                    clientPage === filteredTotalPages ||
                    filteredLogs.length === 0
                  }
                  variant="outline"
                  size="sm"
                >
                  Next
                </Button>
              </div>
            </>
          )}

          {/* Details Modal */}
          {showDetails && selectedLog && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    {getActionIcon(selectedLog.action_type)}
                    <h2 className="text-xl font-bold text-white">
                      Audit Log Details
                    </h2>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={closeDetailsModal}
                  >
                    Close
                  </Button>
                </div>

                <div className="space-y-4">
                  {/* Basic Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-zinc-800 rounded-lg p-4">
                      <h3 className="text-sm font-medium text-zinc-400 mb-2">
                        Action
                      </h3>
                      <p className="text-white">
                        {formatActionType(selectedLog.action_type)}
                      </p>
                    </div>
                    <div className="bg-zinc-800 rounded-lg p-4">
                      <h3 className="text-sm font-medium text-zinc-400 mb-2">
                        Timestamp
                      </h3>
                      <p className="text-white">
                        {formatDate(selectedLog.timestamp)}
                      </p>
                    </div>
                    <div className="bg-zinc-800 rounded-lg p-4">
                      <h3 className="text-sm font-medium text-zinc-400 mb-2">
                        Admin
                      </h3>
                      <p className="text-white">{selectedLog.admin_username}</p>
                      <p className="text-xs text-zinc-500">
                        {selectedLog.admin_id}
                      </p>
                    </div>
                    <div className="bg-zinc-800 rounded-lg p-4">
                      <h3 className="text-sm font-medium text-zinc-400 mb-2">
                        IP Address
                      </h3>
                      <div className="flex items-center space-x-2">
                        <p
                          className={`text-white font-mono ${
                            revealedIPs.has(selectedLog.id)
                              ? ''
                              : 'filter blur-sm'
                          }`}
                        >
                          {formatIPAddress(
                            selectedLog.ip_address,
                            selectedLog.id
                          )}
                        </p>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRevealIP(selectedLog.id)}
                          disabled={revealingIP === selectedLog.id}
                          className="p-1"
                        >
                          {revealingIP === selectedLog.id ? (
                            <div className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
                          ) : revealedIPs.has(selectedLog.id) ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Target User */}
                  {selectedLog.target_username && (
                    <div className="bg-zinc-800 rounded-lg p-4">
                      <h3 className="text-sm font-medium text-zinc-400 mb-2">
                        Target User
                      </h3>
                      <p className="text-white">
                        {selectedLog.target_username}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {selectedLog.target_user_id}
                      </p>
                    </div>
                  )}

                  {/* User Agent */}
                  {selectedLog.user_agent && (
                    <div className="bg-zinc-800 rounded-lg p-4">
                      <h3 className="text-sm font-medium text-zinc-400 mb-2">
                        User Agent
                      </h3>
                      <p className="text-white text-sm break-all">
                        {selectedLog.user_agent}
                      </p>
                    </div>
                  )}

                  {/* Details */}
                  <div className="bg-zinc-800 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-zinc-400 mb-2">
                      Additional Details
                    </h3>
                    <pre className="text-sm text-zinc-300 whitespace-pre-wrap">
                      {JSON.stringify(selectedLog.details, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating Mobile Menu Button */}
      <button
        onClick={() => setMobileSidebarOpen(true)}
        className="lg:hidden fixed bottom-6 right-6 z-30 p-4 bg-orange-600 hover:bg-orange-700 rounded-full shadow-lg transition-colors"
      >
        <Menu className="h-6 w-6 text-white" />
      </button>

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
