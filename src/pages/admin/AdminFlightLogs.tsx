import { useState, useEffect } from "react";
import {
  MdFlight,
  MdVisibility,
  MdVisibilityOff,
  MdAccessTime,
  MdStorage,
  MdClose,
  MdEditNote,
} from "react-icons/md";
import { Link } from "react-router-dom";
import AdminLayout from "../../components/admin/AdminLayout";
import AdminModal from "../../components/admin/AdminModal";
import AdminPageHeader from "../../components/admin/AdminPageHeader";
import AdminToolbar from "../../components/admin/AdminToolbar";
import AdminTextInput from "../../components/admin/AdminTextInput";
import AdminStatStrip from "../../components/admin/AdminStatStrip";
import AdminTable from "../../components/admin/AdminTable";
import {
  adminDownsizeButtonSize,
  ADMIN_TH,
  ADMIN_TD,
  ADMIN_TABLE_HEAD,
} from "../../components/admin/adminConstants";
import Loader from "../../components/common/Loader";
import Dropdown from "../../components/common/Dropdown";
import {
  fetchFlightLogs,
  revealFlightLogIP,
  type FlightLogsResponse,
  type FlightLog,
} from "../../utils/fetch/admin";
import Button from "../../components/common/Button";
import ErrorScreen from "../../components/common/ErrorScreen";

export default function AdminFlightLogs() {
  const [logs, setLogs] = useState<FlightLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generalSearch, setGeneralSearch] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [sessionFilter, setSessionFilter] = useState("");
  const [flightIdFilter, setFlightIdFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [textFilter, setTextFilter] = useState("");
  const [selectedLog, setSelectedLog] = useState<FlightLog | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);
  const [revealedIPs, setRevealedIPs] = useState<Set<number>>(new Set());
  const [revealingIP, setRevealingIP] = useState<number | null>(null);

  const actionTypeOptions = [
    { value: "", label: "All Actions" },
    { value: "add", label: "Add Flight" },
    { value: "update", label: "Update Flight" },
    { value: "delete", label: "Delete Flight" },
  ];

  useEffect(() => {
    setClientPage(1);
  }, [
    generalSearch,
    userFilter,
    actionFilter,
    sessionFilter,
    flightIdFilter,
    dateFilter,
    textFilter,
  ]);

  useEffect(() => {
    fetchLogs();
  }, [
    generalSearch,
    userFilter,
    actionFilter,
    sessionFilter,
    flightIdFilter,
    dateFilter,
    textFilter,
  ]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);

      const filters = {
        general: generalSearch || undefined,
        user: userFilter || undefined,
        action: actionFilter || undefined,
        session: sessionFilter || undefined,
        flightId: flightIdFilter || undefined,
        date: dateFilter || undefined,
        text: textFilter || undefined,
      };

      let allLogs: FlightLog[] = [];
      let currentPage = 1;
      let totalPagesFromServer = 1;
      const bigLimit = 500;

      while (currentPage <= Math.min(totalPagesFromServer, 5)) {
        const data: FlightLogsResponse = await fetchFlightLogs(
          currentPage,
          bigLimit,
          filters
        );
        allLogs = [...allLogs, ...data.logs];
        totalPagesFromServer = data.pagination.pages;
        currentPage++;

        if (allLogs.length >= 500) break;
      }

      setLogs(allLogs);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch flight logs";
      setError(errorMessage);
      setToast({ message: errorMessage, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (log: FlightLog) => {
    setSelectedLog(log);
    setShowDetails(true);
  };

  const closeDetailsModal = () => {
    setShowDetails(false);
    setSelectedLog(null);
  };

  const clearFilters = () => {
    setGeneralSearch("");
    setUserFilter("");
    setActionFilter("");
    setSessionFilter("");
    setFlightIdFilter("");
    setDateFilter("");
    setTextFilter("");
  };

  const formatActionType = (action: string) => {
    switch (action) {
      case "add":
        return "Add Flight";
      case "update":
        return "Update Flight";
      case "delete":
        return "Delete Flight";
      default:
        return action;
    }
  };

  const getFlightOwner = (
    log: FlightLog
  ): { userId: string | null; username: string | null } => {
    const data = (log.action === "add" ? log.new_data : log.old_data) as Record<
      string,
      unknown
    > | null;
    return {
      userId: (data?.flight_owner_user_id as string) || null,
      username: (data?.flight_owner_username as string) || null,
    };
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case "add":
        return <MdFlight size={16} className="text-green-400" />;
      case "update":
        return <MdStorage size={16} className="text-blue-400" />;
      case "delete":
        return <MdVisibilityOff size={16} className="text-red-400" />;
      default:
        return <MdFlight size={16} className="text-zinc-400" />;
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
      await revealFlightLogIP(logId);
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
    if (!ip) return "***.***.***.**";
    if (revealedIPs.has(logId)) return ip;
    const parts = ip.split(".");
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.***.**`;
    return "***.***.***.**";
  };

  const getUpdatedField = (log: FlightLog): string => {
    if (log.action !== "update" || !log.new_data) return "N/A";

    const newData = log.new_data as Record<string, unknown>;
    const fields = Object.keys(newData);

    if (fields.length === 0) return "N/A";

    if (fields.length > 1) {
      const firstField = fields[0];
      return `${firstField}: ${String(newData[firstField])} (+${fields.length - 1} more)`;
    }

    const field = fields[0];
    return `${field}: ${String(newData[field])}`;
  };

  const filteredLogs = logs.filter(() => true);
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

  const btnSize = adminDownsizeButtonSize("sm");
  const hasFilters =
    generalSearch ||
    userFilter ||
    actionFilter ||
    sessionFilter ||
    flightIdFilter ||
    dateFilter ||
    textFilter;

  return (
    <AdminLayout toast={toast} onToastClose={() => setToast(null)}>
      <AdminPageHeader
        title="Flight Archive"
        icon={MdEditNote}
        accent="purple"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <AdminTextInput
          label="Search"
          value={generalSearch}
          onChange={setGeneralSearch}
          placeholder="Users, sessions, flight IDs…"
        />
        <AdminTextInput
          label="Username"
          value={userFilter}
          onChange={setUserFilter}
          placeholder="Filter by user…"
        />
        <AdminTextInput
          label="Session ID"
          value={sessionFilter}
          onChange={setSessionFilter}
          placeholder="Session…"
        />
        <div className="flex items-end max-md:order-last">
          <Button
            onClick={clearFilters}
            variant="outline"
            size="sm"
            disabled={!hasFilters}
            className="w-full"
          >
            <MdClose size={16} className="mr-1" />
            Clear filters
          </Button>
        </div>
        <AdminTextInput
          label="Flight ID"
          value={flightIdFilter}
          onChange={setFlightIdFilter}
          placeholder="Flight…"
        />
        <AdminTextInput
          label="Flight data"
          value={textFilter}
          onChange={setTextFilter}
          placeholder="Callsign, route, etc…"
        />
        <AdminTextInput
          label="Date"
          type="date"
          value={dateFilter}
          onChange={setDateFilter}
        />
        <div>
          <label className="block text-xs text-zinc-500 mb-1.5">Action</label>
          <Dropdown
            options={actionTypeOptions}
            value={actionFilter}
            onChange={(value) => setActionFilter(value)}
            placeholder="All actions"
            size="sm"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader />
        </div>
      ) : error ? (
        <ErrorScreen
          title="Error loading flight logs"
          message={error}
          onRetry={fetchLogs}
        />
      ) : (
        <>
          <AdminStatStrip
            columns={3}
            items={[
              { label: "Loaded logs", value: logs.length },
              {
                label: "Showing",
                value: paginatedLogs.length,
                sub: `Page ${filteredLogs.length === 0 ? 0 : clientPage} of ${filteredLogs.length === 0 ? 0 : filteredTotalPages}`,
              },
              {
                label: "Action filter",
                value: actionFilter ? formatActionType(actionFilter) : "All",
              },
            ]}
          />

          <div className="hidden lg:block">
            <AdminTable minWidth="1000px">
              <thead className={ADMIN_TABLE_HEAD}>
                <tr>
                  <th className={ADMIN_TH}>Action</th>
                  <th className={ADMIN_TH}>User</th>
                  <th className={ADMIN_TH}>Session</th>
                  <th className={ADMIN_TH}>Flight ID</th>
                  <th className={ADMIN_TH}>Timestamp</th>
                  <th className={ADMIN_TH}>IP Address</th>
                  <th className={ADMIN_TH}>Updated Field</th>
                  <th className={ADMIN_TH}>Details</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLogs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-t border-zinc-800/60 hover:bg-zinc-800/30"
                  >
                    <td className={ADMIN_TD}>
                      <div className="flex items-center gap-2">
                        {getActionIcon(log.action)}
                        <span className="text-white font-medium">
                          {formatActionType(log.action)}
                        </span>
                      </div>
                    </td>
                    <td className={ADMIN_TD}>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {log.username || `Unknown (${log.user_id})`}
                        </span>
                        <span className="text-xs text-zinc-500">
                          {log.user_id}
                        </span>
                      </div>
                    </td>
                    <td className={ADMIN_TD}>
                      <Link
                        to={`/admin/sessions?search=${log.session_id}`}
                        className="text-purple-400 hover:text-purple-300 underline"
                      >
                        {log.session_id}
                      </Link>
                    </td>
                    <td className={ADMIN_TD}>{log.flight_id}</td>
                    <td className={ADMIN_TD}>
                      <div className="flex items-center gap-1.5">
                        <MdAccessTime size={14} className="text-zinc-500" />
                        <span className="text-sm">
                          {formatDate(log.created_at)}
                        </span>
                      </div>
                    </td>
                    <td className={ADMIN_TD}>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`font-mono text-sm ${
                            revealedIPs.has(log.id) ? "" : "filter blur-sm"
                          }`}
                        >
                          {formatIPAddress(log.ip_address, log.id)}
                        </span>
                        <Button
                          size={btnSize}
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
                    <td className={ADMIN_TD}>{getUpdatedField(log)}</td>
                    <td className={ADMIN_TD}>
                      <Button
                        size={btnSize}
                        variant="ghost"
                        onClick={() => handleViewDetails(log)}
                      >
                        <MdVisibility size={16} />
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </AdminTable>
          </div>

          <div className="lg:hidden">
            {paginatedLogs.map((log) => (
              <div
                key={log.id}
                className="py-3 border-b border-zinc-800/80 last:border-b-0 space-y-2"
              >
                <div className="flex items-center gap-2">
                  {getActionIcon(log.action)}
                  <p className="text-white font-medium text-sm">
                    {formatActionType(log.action)}
                  </p>
                </div>

                <div>
                  <p className="text-zinc-300 text-sm">
                    <span className="text-zinc-500">
                      {log.action === "add" ? "Submitted by" : "Changed by"}:
                    </span>{" "}
                    {log.username || `Unknown (${log.user_id})`}
                  </p>
                  <p className="text-zinc-500 text-xs">{log.user_id}</p>
                  {log.action !== "add" &&
                    (() => {
                      const owner = getFlightOwner(log);
                      if (!owner.username && !owner.userId) return null;
                      return (
                        <p className="text-zinc-300 text-sm mt-1">
                          <span className="text-zinc-500">Flight owner:</span>{" "}
                          {owner.username || owner.userId}
                        </p>
                      );
                    })()}
                </div>

                <p className="text-zinc-300 text-sm">
                  <span className="text-zinc-500">Session:</span>{" "}
                  <Link
                    to={`/admin/sessions?search=${log.session_id}`}
                    className="text-purple-400 hover:text-purple-300 underline"
                  >
                    {log.session_id}
                  </Link>
                </p>
                <p className="text-zinc-300 text-sm">
                  <span className="text-zinc-500">Flight ID:</span>{" "}
                  {log.flight_id}
                </p>
                <p className="text-zinc-300 text-sm">
                  <span className="text-zinc-500">Timestamp:</span>{" "}
                  {formatDate(log.created_at)}
                </p>

                <div className="flex items-center gap-2">
                  <span className="text-zinc-500 text-sm">IP:</span>
                  <span
                    className={`font-mono text-sm ${
                      revealedIPs.has(log.id) ? "" : "filter blur-sm"
                    }`}
                  >
                    {formatIPAddress(log.ip_address, log.id)}
                  </span>
                  <Button
                    size={btnSize}
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

                <p className="text-zinc-300 text-sm">
                  <span className="text-zinc-500">Updated:</span>{" "}
                  {getUpdatedField(log)}
                </p>

                <Button
                  size={btnSize}
                  variant="ghost"
                  onClick={() => handleViewDetails(log)}
                >
                  <MdVisibility size={16} className="mr-1" />
                  View details
                </Button>
              </div>
            ))}
          </div>

          {filteredLogs.length === 0 && (
            <div className="text-center py-12 text-zinc-500 text-sm">
              {logs.length > 0
                ? "No flight logs found. All logs are filtered out."
                : "No flight logs found with the current filters."}
            </div>
          )}

          <AdminToolbar className="justify-center mt-4">
            <Button
              onClick={() => setClientPage(Math.max(1, clientPage - 1))}
              disabled={clientPage === 1 || filteredLogs.length === 0}
              variant="outline"
              size={btnSize}
            >
              Previous
            </Button>
            <span className="text-zinc-500 text-sm px-2">
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
              size={btnSize}
            >
              Next
            </Button>
          </AdminToolbar>
        </>
      )}

      <AdminModal
        open={showDetails && !!selectedLog}
        onClose={closeDetailsModal}
        title="Flight Log Details"
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
                  {formatActionType(selectedLog.action)}
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
                  {selectedLog.action === "add" ? "Submitted By" : "Changed By"}
                </h3>
                <p className="text-white">
                  {selectedLog.username || `Unknown (${selectedLog.user_id})`}
                </p>
                <p className="text-xs text-zinc-500">{selectedLog.user_id}</p>
              </div>
              {selectedLog.action !== "add" &&
                (() => {
                  const owner = getFlightOwner(selectedLog);
                  return (
                    <div className="bg-zinc-800 rounded-lg p-4">
                      <h3 className="text-sm font-medium text-zinc-400 mb-2">
                        Flight Owner
                      </h3>
                      <p className="text-white">
                        {owner.username ||
                          owner.userId ||
                          "Anonymous (public submit)"}
                      </p>
                      {owner.userId && (
                        <p className="text-xs text-zinc-500">{owner.userId}</p>
                      )}
                    </div>
                  );
                })()}
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
                    size={btnSize}
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
            <div className="bg-zinc-800 rounded-lg p-4">
              <h3 className="text-sm font-medium text-zinc-400 mb-2">
                Old Data
              </h3>
              <pre className="text-sm text-zinc-300 whitespace-pre-wrap">
                {selectedLog.old_data
                  ? JSON.stringify(selectedLog.old_data, null, 2)
                  : "N/A"}
              </pre>
            </div>
            <div className="bg-zinc-800 rounded-lg p-4">
              <h3 className="text-sm font-medium text-zinc-400 mb-2">
                New Data
              </h3>
              <pre className="text-sm text-zinc-300 whitespace-pre-wrap">
                {selectedLog.new_data
                  ? JSON.stringify(selectedLog.new_data, null, 2)
                  : "N/A"}
              </pre>
            </div>
          </div>
        )}
      </AdminModal>
    </AdminLayout>
  );
}
