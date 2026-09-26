import { useState, useEffect, type ReactNode } from 'react';
import {
  Activity,
  Ban,
  Bell,
  BellRing,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Code,
  Database,
  Eraser,
  Eye,
  EyeOff,
  ExternalLink,
  FileText,
  Flag,
  Image,
  ImageOff,
  KeyRound,
  Loader2,
  Megaphone,
  MessageCircle,
  MessageSquare,
  MessageSquareOff,
  MessageSquareWarning,
  Pencil,
  Plane,
  Plus,
  RefreshCw,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Star,
  StarOff,
  Trash2,
  Unlock,
  User,
  UserCog,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import AdminLayout from '../../components/admin/AdminLayout';
import AdminModal from '../../components/admin/AdminModal';
import AdminPage from '../../components/admin/AdminPage';
import AdminRefreshButton from '../../components/admin/AdminRefreshButton';
import AdminToolbar from '../../components/admin/AdminToolbar';
import AdminSearchInput from '../../components/admin/AdminSearchInput';
import AdminSelect from '../../components/admin/AdminSelect';
import AdminTextInput from '../../components/admin/AdminTextInput';
import AdminTable from '../../components/admin/AdminTable';
import {
  AdminEmptyState,
  AdminErrorState,
  AdminLoading,
} from '../../components/admin/AdminStates';
import {
  ADMIN_TONE_TEXT,
  type AdminTone,
} from '../../components/admin/adminConstants';
import { Button } from '@/components/ui/button';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  fetchAuditLogs,
  revealAuditLogIP,
  type AuditLogsResponse,
  type AuditLog,
} from '../../utils/fetch/admin';

const ACTION_LABELS: Record<string, string> = {
  ADMIN_DASHBOARD_ACCESSED: 'Dashboard Access',
  ADMIN_USERS_ACCESSED: 'Users Page Access',
  ADMIN_SESSIONS_ACCESSED: 'Sessions Access',
  ADMIN_SYSTEM_INFO_ACCESSED: 'System Info Access',
  ADMIN_AUDIT_LOGS_ACCESSED: 'Audit Logs Access',
  ADMIN_TESTERS_ACCESSED: 'Testers Page Access',
  IP_ADDRESS_VIEWED: 'IP Address Revealed',
  AUDIT_LOG_IP_VIEWED: 'Audit Log IP Address Revealed',
  USER_BANNED: 'User Banned',
  USER_UNBANNED: 'User Unbanned',
  ADMIN_BANS_ACCESSED: 'Bans Page Access',
  SESSION_DELETED: 'Session Deleted',
  SESSION_JOINED: 'Session Joined',
  TESTER_ADDED: 'Tester Added',
  TESTER_REMOVED: 'Tester Removed',
  TESTER_SETTINGS_UPDATED: 'Tester Settings Updated',
  ROLE_ASSIGNED: 'Role Assigned',
  ROLE_REMOVED: 'Role Removed',
  ROLE_UPDATED: 'Role Updated',
  IP_REVEALED: 'IP Revealed',
  NOTIFICATION_ADDED: 'Notification Added',
  NOTIFICATION_UPDATED: 'Notification Updated',
  NOTIFICATION_DELETED: 'Notification Deleted',
  ADMIN_VERSION_UPDATED: 'Version Updated',
  CHAT_REPORT_DELETED: 'Chat Report Deleted',
  CHAT_REPORT_STATUS_UPDATED: 'Chat Report Status Updated',
  CHAT_REPORT_RESOLVED: 'Chat Report Resolved',
  ROLE_PRIORITIES_UPDATED: 'Role Priorities Updated',
  UPDATE_MODAL_PUBLISHED: 'Update Modal Published',
  UPDATE_MODAL_UNPUBLISHED: 'Update Modal Unpublished',
  UPDATE_MODAL_CREATED: 'Update Modal Created',
  UPDATE_MODAL_DELETED: 'Update Modal Deleted',
  UPDATE_MODAL_UPDATED: 'Update Modal Updated',
  FLIGHT_LOG_IP_REVEALED: 'Flight Log IP Revealed',
  FEEDBACK_DELETED: 'Feedback Deleted',
  CONTROLLER_RATING_DELETED: 'Controller Rating Deleted',
  CONTROLLER_RATING_REPORT_DISMISSED: 'Controller Rating Report Dismissed',
  CONTROLLER_RATING_AUTOMOD_DISMISSED:
    'Controller Rating Automod Flag Dismissed',
  EVENT_MODE_UPDATED: 'Event Mode Updated',
  ADMIN_DEVELOPER_SCOPE_CATALOG: 'Developer Scope Catalog Access',
  ADMIN_DEVELOPER_APPLICATIONS_LIST: 'Developer Applications Access',
  ADMIN_DEVELOPER_APPLICATION_APPROVED: 'Developer Application Approved',
  ADMIN_DEVELOPER_APPLICATION_REJECTED: 'Developer Application Rejected',
  ADMIN_DEVELOPERS_LIST: 'Developers Page Access',
  ADMIN_DEVELOPER_DELETED: 'Developer Deleted',
  ADMIN_DEVELOPER_PROFILE_SCOPES_UPDATED: 'Developer Scopes Updated',
  ADMIN_DEVELOPER_KEYS_LIST: 'Developer Keys Access',
  ADMIN_DEVELOPER_KEY_APPROVED: 'Developer Key Approved',
  ADMIN_DEVELOPER_KEY_REJECTED: 'Developer Key Rejected',
  ADMIN_DEVELOPER_KEY_UPDATED: 'Developer Key Updated',
  ADMIN_DEVELOPER_KEY_REVOKED: 'Developer Key Revoked',
  ADMIN_DEVELOPER_PROFILE_SUSPENDED: 'Developer Profile Suspended',
  ADMIN_DEVELOPER_PROFILE_REACTIVATED: 'Developer Profile Reactivated',
};

const FILTERABLE_ACTIONS = [
  'ADMIN_DASHBOARD_ACCESSED',
  'ADMIN_USERS_ACCESSED',
  'ADMIN_SESSIONS_ACCESSED',
  'ADMIN_SYSTEM_INFO_ACCESSED',
  'ADMIN_AUDIT_LOGS_ACCESSED',
  'ADMIN_TESTERS_ACCESSED',
  'IP_ADDRESS_VIEWED',
  'AUDIT_LOG_IP_VIEWED',
  'USER_BANNED',
  'USER_UNBANNED',
  'ADMIN_BANS_ACCESSED',
  'SESSION_DELETED',
  'SESSION_JOINED',
  'TESTER_ADDED',
  'TESTER_REMOVED',
  'TESTER_SETTINGS_UPDATED',
  'ROLE_ASSIGNED',
  'ROLE_REMOVED',
  'ROLE_UPDATED',
  'IP_REVEALED',
  'NOTIFICATION_ADDED',
  'NOTIFICATION_UPDATED',
  'NOTIFICATION_DELETED',
  'ADMIN_VERSION_UPDATED',
  'CHAT_REPORT_DELETED',
  'CHAT_REPORT_STATUS_UPDATED',
  'CHAT_REPORT_RESOLVED',
  'ROLE_PRIORITIES_UPDATED',
  'UPDATE_MODAL_PUBLISHED',
  'UPDATE_MODAL_UNPUBLISHED',
  'UPDATE_MODAL_CREATED',
  'UPDATE_MODAL_DELETED',
  'UPDATE_MODAL_UPDATED',
  'FLIGHT_LOG_IP_REVEALED',
  'FEEDBACK_DELETED',
  'CONTROLLER_RATING_DELETED',
  'CONTROLLER_RATING_REPORT_DISMISSED',
  'CONTROLLER_RATING_AUTOMOD_DISMISSED',
];

const ACTION_TYPE_OPTIONS = [
  { value: '', label: 'All Actions' },
  ...FILTERABLE_ACTIONS.map((value) => ({
    value,
    label: ACTION_LABELS[value],
  })),
];

type ActionVisual = { icon: LucideIcon; tone: AdminTone };

const ACTION_VISUALS: Record<string, ActionVisual> = {
  IP_ADDRESS_VIEWED: { icon: Eye, tone: 'warning' },
  AUDIT_LOG_IP_VIEWED: { icon: Eye, tone: 'warning' },
  IP_REVEALED: { icon: Eye, tone: 'warning' },
  ADMIN_DASHBOARD_ACCESSED: { icon: ShieldAlert, tone: 'info' },
  ADMIN_USERS_ACCESSED: { icon: User, tone: 'success' },
  ADMIN_SESSIONS_ACCESSED: { icon: Database, tone: 'warning' },
  ADMIN_SYSTEM_INFO_ACCESSED: { icon: Settings, tone: 'info' },
  ADMIN_TESTERS_ACCESSED: { icon: Shield, tone: 'purple' },
  ADMIN_AUDIT_LOGS_ACCESSED: { icon: ShieldAlert, tone: 'warning' },
  USER_BANNED: { icon: Ban, tone: 'danger' },
  ADMIN_BANS_ACCESSED: { icon: Ban, tone: 'danger' },
  USER_UNBANNED: { icon: X, tone: 'success' },
  SESSION_DELETED: { icon: Trash2, tone: 'danger' },
  SESSION_JOINED: { icon: ExternalLink, tone: 'info' },
  TESTER_ADDED: { icon: Plus, tone: 'success' },
  TESTER_REMOVED: { icon: Trash2, tone: 'danger' },
  TESTER_SETTINGS_UPDATED: { icon: Settings, tone: 'info' },
  ROLE_ASSIGNED: { icon: ShieldCheck, tone: 'success' },
  ROLE_REMOVED: { icon: ShieldCheck, tone: 'danger' },
  ROLE_UPDATED: { icon: ShieldCheck, tone: 'info' },
  NOTIFICATION_ADDED: { icon: Plus, tone: 'success' },
  NOTIFICATION_UPDATED: { icon: Pencil, tone: 'info' },
  NOTIFICATION_DELETED: { icon: Trash2, tone: 'danger' },
  ADMIN_VERSION_UPDATED: { icon: Settings, tone: 'info' },
  CHAT_REPORT_DELETED: { icon: MessageSquareOff, tone: 'danger' },
  CHAT_REPORT_STATUS_UPDATED: { icon: MessageSquare, tone: 'info' },
  CHAT_REPORT_RESOLVED: { icon: MessageCircle, tone: 'success' },
  ROLE_PRIORITIES_UPDATED: { icon: Users, tone: 'purple' },
  UPDATE_MODAL_PUBLISHED: { icon: CircleCheck, tone: 'success' },
  UPDATE_MODAL_UNPUBLISHED: { icon: EyeOff, tone: 'danger' },
  UPDATE_MODAL_CREATED: { icon: Plus, tone: 'success' },
  UPDATE_MODAL_DELETED: { icon: Trash2, tone: 'danger' },
  UPDATE_MODAL_UPDATED: { icon: Pencil, tone: 'info' },
  FLIGHT_LOG_IP_REVEALED: { icon: Eye, tone: 'warning' },
  FEEDBACK_DELETED: { icon: Trash2, tone: 'danger' },
  CONTROLLER_RATING_DELETED: { icon: Trash2, tone: 'danger' },
  CONTROLLER_RATING_REPORT_DISMISSED: { icon: CircleCheck, tone: 'success' },
  CONTROLLER_RATING_AUTOMOD_DISMISSED: { icon: CircleCheck, tone: 'success' },
  EVENT_MODE_UPDATED: { icon: CalendarDays, tone: 'warning' },
  ADMIN_DEVELOPER_SCOPE_CATALOG: { icon: Code, tone: 'purple' },
  ADMIN_DEVELOPER_APPLICATIONS_LIST: { icon: Code, tone: 'purple' },
  ADMIN_DEVELOPERS_LIST: { icon: Code, tone: 'purple' },
  ADMIN_DEVELOPER_KEYS_LIST: { icon: Code, tone: 'purple' },
  ADMIN_DEVELOPER_APPLICATION_APPROVED: { icon: CircleCheck, tone: 'success' },
  ADMIN_DEVELOPER_PROFILE_REACTIVATED: { icon: CircleCheck, tone: 'success' },
  ADMIN_DEVELOPER_APPLICATION_REJECTED: { icon: X, tone: 'danger' },
  ADMIN_DEVELOPER_DELETED: { icon: Trash2, tone: 'danger' },
  ADMIN_DEVELOPER_KEY_REVOKED: { icon: Trash2, tone: 'danger' },
  ADMIN_DEVELOPER_PROFILE_SCOPES_UPDATED: { icon: Shield, tone: 'purple' },
  ADMIN_DEVELOPER_KEY_APPROVED: { icon: KeyRound, tone: 'success' },
  ADMIN_DEVELOPER_KEY_REJECTED: { icon: KeyRound, tone: 'danger' },
  ADMIN_DEVELOPER_KEY_UPDATED: { icon: Pencil, tone: 'info' },
  ADMIN_DEVELOPER_PROFILE_SUSPENDED: { icon: Ban, tone: 'warning' },
  ADMIN_DEVELOPER_USAGE_VIEWED: { icon: Code, tone: 'purple' },
  ADMIN_API_LOGS_ACCESSED: { icon: Activity, tone: 'info' },
  ADMIN_API_LOGS_STATS_ACCESSED: { icon: Activity, tone: 'info' },
  ADMIN_API_LOGS_STATS_24H_ACCESSED: { icon: Activity, tone: 'info' },
  ADMIN_API_LOG_VIEWED: { icon: Activity, tone: 'info' },
  ADMIN_FEATURED_FLIGHTS_VIEWED: { icon: Image, tone: 'info' },
  ADMIN_FEEDBACK_ACCESSED: { icon: Star, tone: 'info' },
  ADMIN_FLIGHT_LOGS_ACCESSED: { icon: Plane, tone: 'info' },
  ADMIN_FLIGHT_LOG_VIEWED: { icon: Plane, tone: 'info' },
  ADMIN_NOTIFICATIONS_ACCESSED: { icon: Bell, tone: 'info' },
  ADMIN_PROFILE_CONTENT_VIEWED: { icon: FileText, tone: 'info' },
  ADMIN_ROLES_ACCESSED: { icon: UserCog, tone: 'purple' },
  ADMIN_ROLE_USERS_ACCESSED: { icon: Users, tone: 'purple' },
  ADMIN_UPDATE_MODALS_ACCESSED: { icon: Megaphone, tone: 'info' },
  CHAT_REPORTS_ACCESSED: { icon: MessageSquareWarning, tone: 'warning' },
  ROLE_CREATED: { icon: Plus, tone: 'success' },
  ROLE_DELETED: { icon: Trash2, tone: 'danger' },
  SESSION_UPDATED: { icon: Pencil, tone: 'info' },
  SESSION_CLAIM_RELEASED: { icon: Unlock, tone: 'warning' },
  ADMIN_SYNC_SESSION_COUNTS: { icon: RefreshCw, tone: 'info' },
  IP_HISTORY_REVEALED: { icon: Eye, tone: 'warning' },
  VPN_FLAG_SET: { icon: Flag, tone: 'warning' },
  VPN_GATE_ENABLED: { icon: Shield, tone: 'success' },
  VPN_GATE_DISABLED: { icon: ShieldOff, tone: 'danger' },
  VPN_EXCEPTION_ADDED: { icon: Plus, tone: 'success' },
  VPN_EXCEPTION_REMOVED: { icon: Trash2, tone: 'danger' },
  FEATURED_FLIGHT_UNFEATURED: { icon: StarOff, tone: 'danger' },
  FEATURED_FLIGHT_IMAGE_DELETED: { icon: ImageOff, tone: 'danger' },
  PROFILE_BIO_CLEARED: { icon: Eraser, tone: 'warning' },
  USER_ALERT_SENT: { icon: BellRing, tone: 'orange' },
};

function getActionVisual(actionType: string): ActionVisual {
  const known = ACTION_VISUALS[actionType];
  if (known) return known;
  if (actionType.startsWith('ADMIN_DEVELOPER')) {
    return { icon: Code, tone: 'purple' };
  }
  if (actionType.startsWith('EVENT_')) {
    return { icon: CalendarDays, tone: 'warning' };
  }
  return { icon: ShieldAlert, tone: 'neutral' };
}

function formatActionType(actionType: string) {
  return ACTION_LABELS[actionType] ?? actionType;
}

function ActionIcon({ actionType }: { actionType: string }) {
  const { icon: Icon, tone } = getActionVisual(actionType);
  return (
    <Icon
      className={cn('size-4 shrink-0', ADMIN_TONE_TEXT[tone])}
      aria-hidden
    />
  );
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function DetailField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('grid min-w-0 gap-1', className)}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm">{children}</dd>
    </div>
  );
}

export default function AdminAudit() {
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
  const [clientPage, setClientPage] = useState(1);
  const clientLimit = 50;

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

  const handleActionTypeChange = (value: string) => {
    setActionTypeFilter(value);
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

  const filteredTotalPages = Math.max(
    1,
    Math.ceil(filteredLogs.length / clientLimit)
  );
  const paginatedLogs = filteredLogs.slice(
    (clientPage - 1) * clientLimit,
    clientPage * clientLimit
  );

  const renderIP = (log: AuditLog) => {
    const revealed = revealedIPs.has(log.id);
    const revealing = revealingIP === log.id;
    return (
      <div className="flex items-center gap-1">
        <span
          className={cn(
            'font-mono text-xs transition-[filter]',
            !revealed && 'blur-sm select-none'
          )}
        >
          {formatIPAddress(log.ip_address, log.id)}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => handleRevealIP(log.id)}
              disabled={revealing}
              aria-label={revealed ? 'Hide IP address' : 'Reveal IP address'}
            >
              {revealing ? (
                <Loader2 className="animate-spin" />
              ) : revealed ? (
                <EyeOff />
              ) : (
                <Eye />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{revealed ? 'Hide IP' : 'Reveal IP'}</TooltipContent>
        </Tooltip>
      </div>
    );
  };

  const detailsJson = selectedLog
    ? (JSON.stringify(selectedLog.details, null, 2) ?? '')
    : '';

  const showingFrom =
    filteredLogs.length === 0 ? 0 : (clientPage - 1) * clientLimit + 1;
  const showingTo = Math.min(clientPage * clientLimit, filteredLogs.length);

  return (
    <AdminLayout toast={toast} onToastClose={() => setToast(null)}>
      <AdminPage
        title="Audit Log"
        icon={ShieldAlert}
        actions={
          <AdminRefreshButton
            onClick={() => void fetchLogs()}
            loading={loading}
          />
        }
      >
        <AdminToolbar>
          <AdminTextInput
            value={adminFilter}
            onChange={setAdminFilter}
            placeholder="Filter by admin…"
            aria-label="Filter by admin"
            className="w-full sm:w-48"
          />
          <AdminSearchInput
            value={targetUserFilter}
            onChange={setTargetUserFilter}
            placeholder="Filter by target user…"
            grow={false}
          />
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <AdminTextInput
              type="datetime-local"
              value={dateFromFilter}
              onChange={setDateFromFilter}
              className="min-w-0 sm:w-52"
              aria-label="From date"
            />
            <AdminTextInput
              type="datetime-local"
              value={dateToFilter}
              onChange={setDateToFilter}
              className="min-w-0 sm:w-52"
              aria-label="To date"
            />
          </div>
          <AdminSelect
            options={ACTION_TYPE_OPTIONS}
            value={actionTypeFilter}
            onChange={handleActionTypeChange}
            placeholder="Filter by action…"
            searchPlaceholder="Search actions…"
            aria-label="Filter by action"
            searchable
          />
          <Button variant="outline" onClick={clearFilters}>
            <X />
            Clear filters
          </Button>
        </AdminToolbar>

        {loading ? (
          <AdminLoading label="Loading audit logs…" />
        ) : error ? (
          <AdminErrorState
            title="Error loading audit logs"
            message={error}
            onRetry={fetchLogs}
          />
        ) : filteredLogs.length === 0 ? (
          <AdminEmptyState
            icon={ShieldAlert}
            title={
              logs.length > 0
                ? 'No action logs found'
                : 'No audit logs found with the current filters'
            }
          />
        ) : (
          <div className="grid gap-3">
            <AdminTable minWidth="960px">
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Admin</TableHead>
                  <TableHead>Target user</TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>IP address</TableHead>
                  <TableHead className="text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <ActionIcon actionType={log.action_type} />
                        <span className="font-medium">
                          {formatActionType(log.action_type)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {log.admin_username}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {log.admin_id}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {log.target_username ? (
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {log.target_username}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {log.target_user_id}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">N/A</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="tabular-nums">
                        {formatDate(log.created_at)}
                      </span>
                    </TableCell>
                    <TableCell>{renderIP(log)}</TableCell>
                    <TableCell className="text-right">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleViewDetails(log)}
                            aria-label="View details"
                          >
                            <Eye />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>View details</TooltipContent>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </AdminTable>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
              <p className="text-sm text-muted-foreground tabular-nums">
                Page {clientPage} of {filteredTotalPages} ·{' '}
                {filteredLogs.length.toLocaleString()} total
                <span className="hidden sm:inline">
                  {' '}
                  · showing {showingFrom}–{showingTo}
                </span>
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setClientPage(Math.max(1, clientPage - 1))}
                  disabled={clientPage === 1}
                >
                  <ChevronLeft />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setClientPage(Math.min(filteredTotalPages, clientPage + 1))
                  }
                  disabled={clientPage === filteredTotalPages}
                >
                  Next
                  <ChevronRight />
                </Button>
              </div>
            </div>
          </div>
        )}
      </AdminPage>

      <AdminModal
        open={showDetails && !!selectedLog}
        onClose={closeDetailsModal}
        title="Audit log details"
        size="xl"
        footer={
          <Button variant="outline" onClick={closeDetailsModal}>
            Close
          </Button>
        }
      >
        {selectedLog && (
          <>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              <DetailField label="Action">
                <span className="block font-medium">
                  {formatActionType(selectedLog.action_type)}
                </span>
                <span className="block truncate font-mono text-xs text-muted-foreground">
                  {selectedLog.action_type}
                </span>
              </DetailField>
              <DetailField label="Timestamp">
                <span className="tabular-nums">
                  {formatDate(selectedLog.created_at)}
                </span>
              </DetailField>
              <DetailField label="Admin">
                <span className="block font-medium">
                  {selectedLog.admin_username}
                </span>
                <span className="block font-mono text-xs text-muted-foreground">
                  {selectedLog.admin_id}
                </span>
              </DetailField>
              <DetailField label="IP address">
                {renderIP(selectedLog)}
              </DetailField>
              {selectedLog.target_username && (
                <DetailField label="Target user">
                  <span className="block font-medium">
                    {selectedLog.target_username}
                  </span>
                  <span className="block font-mono text-xs text-muted-foreground">
                    {selectedLog.target_user_id}
                  </span>
                </DetailField>
              )}
              {selectedLog.user_agent && (
                <DetailField label="User agent" className="sm:col-span-2">
                  <span className="font-mono text-xs break-all text-muted-foreground">
                    {selectedLog.user_agent}
                  </span>
                </DetailField>
              )}
            </dl>

            <div className="grid gap-3">
              <h3 className="text-sm font-medium">Additional details</h3>
              <pre className="max-h-80 overflow-auto rounded-xl bg-muted/50 p-4 font-mono text-xs break-all whitespace-pre-wrap">
                {detailsJson}
              </pre>
            </div>
          </>
        )}
      </AdminModal>
    </AdminLayout>
  );
}
