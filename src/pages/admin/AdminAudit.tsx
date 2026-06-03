import { useState, useEffect } from "react";
import {
  MdGppMaybe,
  MdFilterList,
  MdCalendarToday,
  MdPerson,
  MdVisibility,
  MdVisibilityOff,
  MdAccessTime,
  MdBlock,
  MdClose,
  MdDelete,
  MdOpenInNew,
  MdStorage,
  MdAdd,
  MdSettings,
  MdShield,
  MdAdminPanelSettings,
  MdEdit,
  MdCheckCircle,
  MdGroups,
  MdSpeakerNotesOff,
  MdChat,
  MdChatBubbleOutline,
  MdEvent,
  MdCode,
  MdVpnKey,
} from "react-icons/md";
import AdminLayout from "../../components/admin/AdminLayout";
import AdminModal from "../../components/admin/AdminModal";
import AdminPageHeader from "../../components/admin/AdminPageHeader";
import AdminToolbar from "../../components/admin/AdminToolbar";
import AdminSearchInput from "../../components/admin/AdminSearchInput";
import AdminIconInput from "../../components/admin/AdminIconInput";
import AdminTable from "../../components/admin/AdminTable";
import {
  adminDownsizeButtonSize,
  ADMIN_INPUT_ICON_CLASS,
  ADMIN_TH,
  ADMIN_TD,
  ADMIN_TABLE_HEAD,
  ADMIN_TOOLBAR_MOBILE_COL,
  ADMIN_TOOLBAR_MOBILE_PAIR,
  ADMIN_TOOLBAR_MOBILE_SEARCH,
  ADMIN_TOOLBAR_MOBILE_SPLIT_ITEM,
  ADMIN_TOOLBAR_MOBILE_SPLIT_ROW,
  ADMIN_TOOLBAR_MOBILE_STACK_ITEM,
} from "../../components/admin/adminConstants";
import Loader from "../../components/common/Loader";
import Dropdown from "../../components/common/Dropdown";
import {
  fetchAuditLogs,
  revealAuditLogIP,
  type AuditLogsResponse,
  type AuditLog,
} from "../../utils/fetch/admin";
import Button from "../../components/common/Button";
import ErrorScreen from "../../components/common/ErrorScreen";

export default function AdminAudit() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adminFilter, setAdminFilter] = useState("");
  const [actionTypeFilter, setActionTypeFilter] = useState("");
  const [targetUserFilter, setTargetUserFilter] = useState("");
  const [dateFromFilter, setDateFromFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);
  const [revealedIPs, setRevealedIPs] = useState<Set<number>>(new Set());
  const [revealingIP, setRevealingIP] = useState<number | null>(null);
  const [clientPage, setClientPage] = useState(1);
  const clientLimit = 50;

  const actionTypeOptions = [
    { value: "", label: "All Actions" },
    { value: "ADMIN_DASHBOARD_ACCESSED", label: "Dashboard Access" },
    { value: "ADMIN_USERS_ACCESSED", label: "Users Page Access" },
    { value: "ADMIN_SESSIONS_ACCESSED", label: "Sessions Access" },
    { value: "ADMIN_SYSTEM_INFO_ACCESSED", label: "System Info Access" },
    { value: "ADMIN_AUDIT_LOGS_ACCESSED", label: "Audit Logs Access" },
    { value: "ADMIN_TESTERS_ACCESSED", label: "Testers Page Access" },
    { value: "IP_ADDRESS_VIEWED", label: "IP Address Revealed" },
    {
      value: "AUDIT_LOG_IP_VIEWED",
      label: "Audit Log IP Address Revealed",
    },
    { value: "USER_BANNED", label: "User Banned" },
    { value: "USER_UNBANNED", label: "User Unbanned" },
    { value: "ADMIN_BANS_ACCESSED", label: "Bans Page Access" },
    { value: "SESSION_DELETED", label: "Session Deleted" },
    { value: "SESSION_JOINED", label: "Session Joined" },
    { value: "TESTER_ADDED", label: "Tester Added" },
    { value: "TESTER_REMOVED", label: "Tester Removed" },
    { value: "TESTER_SETTINGS_UPDATED", label: "Tester Settings Updated" },
    { value: "ROLE_ASSIGNED", label: "Role Assigned" },
    { value: "ROLE_REMOVED", label: "Role Removed" },
    { value: "ROLE_UPDATED", label: "Role Updated" },
    { value: "IP_REVEALED", label: "IP Revealed" },
    { value: "NOTIFICATION_ADDED", label: "Notification Added" },
    { value: "NOTIFICATION_UPDATED", label: "Notification Updated" },
    { value: "NOTIFICATION_DELETED", label: "Notification Deleted" },
    { value: "ADMIN_VERSION_UPDATED", label: "Version Updated" },
    { value: "CHAT_REPORT_DELETED", label: "Chat Report Deleted" },
    {
      value: "CHAT_REPORT_STATUS_UPDATED",
      label: "Chat Report Status Updated",
    },
    { value: "CHAT_REPORT_RESOLVED", label: "Chat Report Resolved" },
    { value: "ROLE_PRIORITIES_UPDATED", label: "Role Priorities Updated" },
    { value: "UPDATE_MODAL_PUBLISHED", label: "Update Modal Published" },
    { value: "UPDATE_MODAL_UNPUBLISHED", label: "Update Modal Unpublished" },
    { value: "UPDATE_MODAL_CREATED", label: "Update Modal Created" },
    { value: "UPDATE_MODAL_DELETED", label: "Update Modal Deleted" },
    { value: "UPDATE_MODAL_UPDATED", label: "Update Modal Updated" },
    { value: "FLIGHT_LOG_IP_REVEALED", label: "Flight Log IP Revealed" },
    { value: "FEEDBACK_DELETED", label: "Feedback Deleted" },
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
          (log) => !log.action_type.includes("_ACCESSED")
        );
        if (activityLogs.length >= 500) break;
      }

      setLogs(allLogs);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch audit logs";
      setError(errorMessage);
      setToast({
        message: errorMessage,
        type: "error",
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
    setAdminFilter("");
    setActionTypeFilter("");
    setTargetUserFilter("");
    setDateFromFilter("");
    setDateToFilter("");
  };

  const formatActionType = (actionType: string) => {
    switch (actionType) {
      case "ADMIN_DASHBOARD_ACCESSED":
        return "Dashboard Access";
      case "ADMIN_USERS_ACCESSED":
        return "Users Page Access";
      case "ADMIN_SESSIONS_ACCESSED":
        return "Sessions Access";
      case "ADMIN_SYSTEM_INFO_ACCESSED":
        return "System Info Access";
      case "ADMIN_AUDIT_LOGS_ACCESSED":
        return "Audit Logs Access";
      case "ADMIN_TESTERS_ACCESSED":
        return "Testers Page Access";
      case "IP_ADDRESS_VIEWED":
        return "IP Address Revealed";
      case "AUDIT_LOG_IP_VIEWED":
        return "Audit Log IP Address Revealed";
      case "USER_BANNED":
        return "User Banned";
      case "USER_UNBANNED":
        return "User Unbanned";
      case "ADMIN_BANS_ACCESSED":
        return "Bans Page Access";
      case "SESSION_DELETED":
        return "Session Deleted";
      case "SESSION_JOINED":
        return "Session Joined";
      case "TESTER_ADDED":
        return "Tester Added";
      case "TESTER_REMOVED":
        return "Tester Removed";
      case "TESTER_SETTINGS_UPDATED":
        return "Tester Settings Updated";
      case "ROLE_ASSIGNED":
        return "Role Assigned";
      case "ROLE_REMOVED":
        return "Role Removed";
      case "ROLE_UPDATED":
        return "Role Updated";
      case "IP_REVEALED":
        return "IP Revealed";
      case "NOTIFICATION_ADDED":
        return "Notification Added";
      case "NOTIFICATION_UPDATED":
        return "Notification Updated";
      case "NOTIFICATION_DELETED":
        return "Notification Deleted";
      case "ADMIN_VERSION_UPDATED":
        return "Version Updated";
      case "CHAT_REPORT_DELETED":
        return "Chat Report Deleted";
      case "CHAT_REPORT_STATUS_UPDATED":
        return "Chat Report Status Updated";
      case "CHAT_REPORT_RESOLVED":
        return "Chat Report Resolved";
      case "ROLE_PRIORITIES_UPDATED":
        return "Role Priorities Updated";
      case "UPDATE_MODAL_PUBLISHED":
        return "Update Modal Published";
      case "UPDATE_MODAL_UNPUBLISHED":
        return "Update Modal Unpublished";
      case "UPDATE_MODAL_CREATED":
        return "Update Modal Created";
      case "UPDATE_MODAL_DELETED":
        return "Update Modal Deleted";
      case "UPDATE_MODAL_UPDATED":
        return "Update Modal Updated";
      case "FLIGHT_LOG_IP_REVEALED":
        return "Flight Log IP Revealed";
      case "FEEDBACK_DELETED":
        return "Feedback Deleted";
      case "EVENT_MODE_UPDATED":
        return "Event Mode Updated";
      case "ADMIN_DEVELOPER_SCOPE_CATALOG":
        return "Developer Scope Catalog Access";
      case "ADMIN_DEVELOPER_APPLICATIONS_LIST":
        return "Developer Applications Access";
      case "ADMIN_DEVELOPER_APPLICATION_APPROVED":
        return "Developer Application Approved";
      case "ADMIN_DEVELOPER_APPLICATION_REJECTED":
        return "Developer Application Rejected";
      case "ADMIN_DEVELOPERS_LIST":
        return "Developers Page Access";
      case "ADMIN_DEVELOPER_DELETED":
        return "Developer Deleted";
      case "ADMIN_DEVELOPER_PROFILE_SCOPES_UPDATED":
        return "Developer Scopes Updated";
      case "ADMIN_DEVELOPER_KEYS_LIST":
        return "Developer Keys Access";
      case "ADMIN_DEVELOPER_KEY_APPROVED":
        return "Developer Key Approved";
      case "ADMIN_DEVELOPER_KEY_REJECTED":
        return "Developer Key Rejected";
      case "ADMIN_DEVELOPER_KEY_UPDATED":
        return "Developer Key Updated";
      case "ADMIN_DEVELOPER_KEY_REVOKED":
        return "Developer Key Revoked";
      case "ADMIN_DEVELOPER_PROFILE_SUSPENDED":
        return "Developer Profile Suspended";
      case "ADMIN_DEVELOPER_PROFILE_REACTIVATED":
        return "Developer Profile Reactivated";
      default:
        return actionType;
    }
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case "IP_ADDRESS_VIEWED":
      case "AUDIT_LOG_IP_VIEWED":
      case "IP_REVEALED":
        return <MdVisibility size={16} className="text-orange-400" />;
      case "ADMIN_DASHBOARD_ACCESSED":
        return <MdGppMaybe size={16} className="text-blue-400" />;
      case "ADMIN_USERS_ACCESSED":
        return <MdPerson size={16} className="text-green-400" />;
      case "ADMIN_SESSIONS_ACCESSED":
        return <MdStorage size={16} className="text-yellow-400" />;
      case "ADMIN_SYSTEM_INFO_ACCESSED":
        return <MdSettings size={16} className="text-cyan-400" />;
      case "ADMIN_TESTERS_ACCESSED":
        return <MdShield size={16} className="text-purple-400" />;
      case "ADMIN_AUDIT_LOGS_ACCESSED":
        return <MdGppMaybe size={16} className="text-orange-400" />;
      case "USER_BANNED":
      case "ADMIN_BANS_ACCESSED":
        return <MdBlock size={16} className="text-red-400" />;
      case "USER_UNBANNED":
        return <MdClose size={16} className="text-green-400" />;
      case "SESSION_DELETED":
        return <MdDelete size={16} className="text-red-400" />;
      case "SESSION_JOINED":
        return <MdOpenInNew size={16} className="text-blue-400" />;
      case "TESTER_ADDED":
        return <MdAdd size={16} className="text-green-400" />;
      case "TESTER_REMOVED":
        return <MdDelete size={16} className="text-red-400" />;
      case "TESTER_SETTINGS_UPDATED":
        return <MdSettings size={16} className="text-blue-400" />;
      case "ROLE_ASSIGNED":
        return <MdAdminPanelSettings size={16} className="text-green-400" />;
      case "ROLE_REMOVED":
        return <MdAdminPanelSettings size={16} className="text-red-400" />;
      case "ROLE_UPDATED":
        return <MdAdminPanelSettings size={16} className="text-blue-400" />;
      case "NOTIFICATION_ADDED":
        return <MdAdd size={16} className="text-green-400" />;
      case "NOTIFICATION_UPDATED":
        return <MdEdit size={16} className="text-cyan-400" />;
      case "NOTIFICATION_DELETED":
        return <MdDelete size={16} className="text-red-400" />;
      case "ADMIN_VERSION_UPDATED":
        return <MdSettings size={16} className="text-teal-500" />;
      case "CHAT_REPORT_DELETED":
        return <MdSpeakerNotesOff size={16} className="text-red-400" />;
      case "CHAT_REPORT_STATUS_UPDATED":
        return <MdChat size={16} className="text-blue-400" />;
      case "CHAT_REPORT_RESOLVED":
        return <MdChatBubbleOutline size={16} className="text-green-400" />;
      case "ROLE_PRIORITIES_UPDATED":
        return <MdGroups size={16} className="text-purple-400" />;
      case "UPDATE_MODAL_PUBLISHED":
        return <MdCheckCircle size={16} className="text-green-400" />;
      case "UPDATE_MODAL_UNPUBLISHED":
        return <MdVisibilityOff size={16} className="text-red-400" />;
      case "UPDATE_MODAL_CREATED":
        return <MdAdd size={16} className="text-green-400" />;
      case "UPDATE_MODAL_DELETED":
        return <MdDelete size={16} className="text-red-400" />;
      case "UPDATE_MODAL_UPDATED":
        return <MdEdit size={16} className="text-blue-400" />;
      case "FLIGHT_LOG_IP_REVEALED":
        return <MdVisibility size={16} className="text-orange-400" />;
      case "FEEDBACK_DELETED":
        return <MdDelete size={16} className="text-red-400" />;
      case "EVENT_MODE_UPDATED":
        return <MdEvent size={16} className="text-amber-400" />;
      case "ADMIN_DEVELOPER_SCOPE_CATALOG":
      case "ADMIN_DEVELOPER_APPLICATIONS_LIST":
      case "ADMIN_DEVELOPERS_LIST":
      case "ADMIN_DEVELOPER_KEYS_LIST":
        return <MdCode size={16} className="text-violet-400" />;
      case "ADMIN_DEVELOPER_APPLICATION_APPROVED":
      case "ADMIN_DEVELOPER_PROFILE_REACTIVATED":
        return <MdCheckCircle size={16} className="text-green-400" />;
      case "ADMIN_DEVELOPER_APPLICATION_REJECTED":
        return <MdClose size={16} className="text-red-400" />;
      case "ADMIN_DEVELOPER_DELETED":
      case "ADMIN_DEVELOPER_KEY_REVOKED":
        return <MdDelete size={16} className="text-red-400" />;
      case "ADMIN_DEVELOPER_PROFILE_SCOPES_UPDATED":
        return <MdShield size={16} className="text-purple-400" />;
      case "ADMIN_DEVELOPER_KEY_APPROVED":
        return <MdVpnKey size={16} className="text-green-400" />;
      case "ADMIN_DEVELOPER_KEY_REJECTED":
        return <MdVpnKey size={16} className="text-red-400" />;
      case "ADMIN_DEVELOPER_KEY_UPDATED":
        return <MdEdit size={16} className="text-cyan-400" />;
      case "ADMIN_DEVELOPER_PROFILE_SUSPENDED":
        return <MdBlock size={16} className="text-orange-400" />;
      default:
        if (actionType.startsWith("ADMIN_DEVELOPER")) {
          return <MdCode size={16} className="text-violet-400" />;
        }
        if (actionType.startsWith("EVENT_")) {
          return <MdEvent size={16} className="text-amber-400" />;
        }
        return <MdGppMaybe size={16} className="text-zinc-400" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
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

  const formatIPAddress = (ip: string | null | undefined, logId: number) => {
    if (!ip) {
      return "***.***.***.**";
    }
    if (revealedIPs.has(logId)) {
      return ip;
    }

    const parts = ip.split(".");
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.***.**`;
    }
    return "***.***.***.**";
  };

  const isPageNavAction = (actionType: string) => {
    return actionType.includes("_ACCESSED");
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

  return (
    <AdminLayout toast={toast} onToastClose={() => setToast(null)}>
      <AdminPageHeader title="Audit Log" icon={MdGppMaybe} accent="orange" />

      <AdminToolbar className={ADMIN_TOOLBAR_MOBILE_COL}>
        <AdminIconInput
          icon={<MdPerson size={18} />}
          value={adminFilter}
          onChange={setAdminFilter}
          placeholder="Filter by admin..."
          className={`w-40 sm:w-48 ${ADMIN_TOOLBAR_MOBILE_STACK_ITEM}`}
        />
        <AdminSearchInput
          value={targetUserFilter}
          onChange={setTargetUserFilter}
          placeholder="Filter by target user..."
          grow={false}
          className={`w-40 sm:w-48 ${ADMIN_TOOLBAR_MOBILE_SEARCH}`}
        />
        <div className={ADMIN_TOOLBAR_MOBILE_PAIR}>
          <AdminIconInput
            icon={<MdCalendarToday size={18} />}
            type="datetime-local"
            value={dateFromFilter}
            onChange={setDateFromFilter}
            className={`w-44 sm:w-48 ${ADMIN_TOOLBAR_MOBILE_SPLIT_ITEM}`}
            aria-label="From date"
          />
          <AdminIconInput
            icon={<MdCalendarToday size={18} />}
            type="datetime-local"
            value={dateToFilter}
            onChange={setDateToFilter}
            className={`w-44 sm:w-48 ${ADMIN_TOOLBAR_MOBILE_SPLIT_ITEM}`}
            aria-label="To date"
          />
        </div>
        <div className={ADMIN_TOOLBAR_MOBILE_SPLIT_ROW}>
          <div className="relative w-44 sm:w-52">
            <span className={ADMIN_INPUT_ICON_CLASS} aria-hidden>
              <MdFilterList size={18} />
            </span>
            <Dropdown
              size="sm"
              options={actionTypeOptions}
              value={actionTypeFilter}
              onChange={handleActionTypeChange}
              placeholder="Filter by action..."
              className="!pl-11"
            />
          </div>
          <Button
            onClick={clearFilters}
            variant="outline"
            size={adminDownsizeButtonSize("md")}
            className="shrink-0"
          >
            Clear Filters
          </Button>
        </div>
      </AdminToolbar>

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
          <AdminTable className="hidden lg:block" minWidth="1000px">
            <thead className={ADMIN_TABLE_HEAD}>
              <tr>
                <th className={ADMIN_TH}>Action</th>
                <th className={ADMIN_TH}>Admin</th>
                <th className={ADMIN_TH}>Target User</th>
                <th className={ADMIN_TH}>Timestamp</th>
                <th className={ADMIN_TH}>IP Address</th>
                <th className={ADMIN_TH}>Details</th>
              </tr>
            </thead>
            <tbody>
              {paginatedLogs.map((log) => (
                <tr
                  key={log.id}
                  className="border-t border-zinc-700/50 hover:bg-zinc-800/50"
                >
                  <td className={ADMIN_TD}>
                    <div className="flex items-center space-x-3">
                      {getActionIcon(log.action_type)}
                      <div className="flex flex-col">
                        <span className="text-white font-medium">
                          {formatActionType(log.action_type)}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className={`${ADMIN_TD} text-zinc-300`}>
                    <div className="flex flex-col">
                      <span className="font-medium">{log.admin_username}</span>
                      <span className="text-xs text-zinc-500">
                        {log.admin_id}
                      </span>
                    </div>
                  </td>
                  <td className={`${ADMIN_TD} text-zinc-300`}>
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
                  <td className={`${ADMIN_TD} text-zinc-300`}>
                    <div className="flex items-center space-x-2">
                      <MdAccessTime size={16} className="text-zinc-500" />
                      <span className="text-sm">
                        {formatDate(log.created_at)}
                      </span>
                    </div>
                  </td>
                  <td className={`${ADMIN_TD} text-zinc-300`}>
                    <div className="flex items-center space-x-2">
                      <span
                        className={`font-mono text-sm ${
                          revealedIPs.has(log.id) ? "" : "filter blur-sm"
                        }`}
                      >
                        {formatIPAddress(log.ip_address, log.id)}
                      </span>
                      <Button
                        size={adminDownsizeButtonSize("sm")}
                        variant="ghost"
                        onClick={() => handleRevealIP(log.id)}
                        disabled={revealingIP === log.id}
                        className="p-1"
                      >
                        {revealingIP === log.id ? (
                          <div className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
                        ) : revealedIPs.has(log.id) ? (
                          <MdVisibilityOff size={16} />
                        ) : (
                          <MdVisibility size={16} />
                        )}
                      </Button>
                    </div>
                  </td>
                  <td className={ADMIN_TD}>
                    <Button
                      size={adminDownsizeButtonSize("sm")}
                      variant="ghost"
                      onClick={() => handleViewDetails(log)}
                      className="flex items-center space-x-2"
                    >
                      <MdVisibility size={16} />
                      <span>View</span>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </AdminTable>

          <div className="lg:hidden space-y-4">
            {paginatedLogs.map((log) => (
              <div
                key={log.id}
                className="py-4 border-b border-zinc-800/80 last:border-b-0"
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
                    <strong>Timestamp:</strong> {formatDate(log.created_at)}
                  </p>

                  <div className="flex items-center space-x-2">
                    <p className="text-zinc-300">
                      <strong>IP:</strong>{" "}
                      <span
                        className={`font-mono text-sm ${
                          revealedIPs.has(log.id) ? "" : "filter blur-sm"
                        }`}
                      >
                        {formatIPAddress(log.ip_address, log.id)}
                      </span>
                    </p>
                    <Button
                      size={adminDownsizeButtonSize("sm")}
                      variant="ghost"
                      onClick={() => handleRevealIP(log.id)}
                      disabled={revealingIP === log.id}
                      className="p-1"
                    >
                      {revealingIP === log.id ? (
                        <div className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
                      ) : revealedIPs.has(log.id) ? (
                        <MdVisibilityOff size={16} />
                      ) : (
                        <MdVisibility size={16} />
                      )}
                    </Button>
                  </div>

                  <div className="flex space-x-2">
                    <Button
                      size={adminDownsizeButtonSize("sm")}
                      variant="ghost"
                      onClick={() => handleViewDetails(log)}
                      className="flex items-center space-x-2"
                    >
                      <MdVisibility size={16} />
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
                ? "No action logs found. All logs are page navigation events."
                : "No audit logs found with the current filters."}
            </div>
          )}

          <div className="flex justify-center mt-8 space-x-2">
            <Button
              onClick={() => setClientPage(Math.max(1, clientPage - 1))}
              disabled={clientPage === 1 || filteredLogs.length === 0}
              variant="outline"
              size={adminDownsizeButtonSize("sm")}
            >
              Previous
            </Button>
            <span className="text-zinc-400 py-2">
              Page {filteredLogs.length === 0 ? 0 : clientPage} of{" "}
              {filteredLogs.length === 0 ? 0 : filteredTotalPages}
            </span>
            <Button
              onClick={() =>
                setClientPage(Math.min(filteredTotalPages, clientPage + 1))
              }
              disabled={
                clientPage === filteredTotalPages || filteredLogs.length === 0
              }
              variant="outline"
              size={adminDownsizeButtonSize("sm")}
            >
              Next
            </Button>
          </div>
        </>
      )}

      <AdminModal
        open={showDetails && !!selectedLog}
        onClose={closeDetailsModal}
        title="Audit Log Details"
        size="xl"
      >
        {selectedLog && (
          <div className="space-y-4">
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
                  {formatDate(selectedLog.created_at)}
                </p>
              </div>
              <div className="bg-zinc-800 rounded-lg p-4">
                <h3 className="text-sm font-medium text-zinc-400 mb-2">
                  Admin
                </h3>
                <p className="text-white">{selectedLog.admin_username}</p>
                <p className="text-xs text-zinc-500">{selectedLog.admin_id}</p>
              </div>
              <div className="bg-zinc-800 rounded-lg p-4">
                <h3 className="text-sm font-medium text-zinc-400 mb-2">
                  IP Address
                </h3>
                <div className="flex items-center space-x-2">
                  <p
                    className={`text-white font-mono ${
                      revealedIPs.has(selectedLog.id) ? "" : "filter blur-sm"
                    }`}
                  >
                    {formatIPAddress(selectedLog.ip_address, selectedLog.id)}
                  </p>
                  <Button
                    size={adminDownsizeButtonSize("sm")}
                    variant="ghost"
                    onClick={() => handleRevealIP(selectedLog.id)}
                    disabled={revealingIP === selectedLog.id}
                    className="p-1"
                  >
                    {revealingIP === selectedLog.id ? (
                      <div className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
                    ) : revealedIPs.has(selectedLog.id) ? (
                      <MdVisibilityOff size={16} />
                    ) : (
                      <MdVisibility size={16} />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {selectedLog.target_username && (
              <div className="bg-zinc-800 rounded-lg p-4">
                <h3 className="text-sm font-medium text-zinc-400 mb-2">
                  Target User
                </h3>
                <p className="text-white">{selectedLog.target_username}</p>
                <p className="text-xs text-zinc-500">
                  {selectedLog.target_user_id}
                </p>
              </div>
            )}

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

            <div className="bg-zinc-800 rounded-lg p-4">
              <h3 className="text-sm font-medium text-zinc-400 mb-2">
                Additional Details
              </h3>
              <pre className="text-sm text-zinc-300 whitespace-pre-wrap">
                {JSON.stringify(selectedLog.details, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </AdminModal>
    </AdminLayout>
  );
}
