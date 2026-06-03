import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  MdShowChart,
  MdGridOn,
  MdViewList,
  MdMoreHoriz,
  MdOpenInNew,
  MdDelete,
  MdPeople,
  MdCalendarToday,
  MdFlight,
  MdAir,
  MdStorage,
  MdCellTower,
  MdExpandMore,
} from "react-icons/md";
import AdminRefreshButton from "../../components/admin/AdminRefreshButton";
import AdminLayout from "../../components/admin/AdminLayout";
import AdminModal from "../../components/admin/AdminModal";
import AdminPageHeader from "../../components/admin/AdminPageHeader";
import AdminToggleSwitch from "../../components/admin/AdminToggleSwitch";
import AdminToolbar from "../../components/admin/AdminToolbar";
import AdminSearchInput from "../../components/admin/AdminSearchInput";
import AdminTable from "../../components/admin/AdminTable";
import {
  adminDownsizeButtonSize,
  adminSectionClass,
  ADMIN_SEGMENT_ACTIVE,
  ADMIN_SEGMENT_INACTIVE,
  ADMIN_TOGGLE_BADGE_ACTIVE,
  ADMIN_TH,
  ADMIN_TD,
  ADMIN_TABLE_HEAD,
  ADMIN_TOOLBAR_MOBILE_COL,
  ADMIN_TOOLBAR_MOBILE_PAIR,
  ADMIN_TOOLBAR_MOBILE_SEARCH,
  ADMIN_TOOLBAR_MOBILE_SPLIT_ITEM,
} from "../../components/admin/adminConstants";
import Loader from "../../components/common/Loader";
import Button from "../../components/common/Button";
import { getIconComponent } from "../../utils/roles";
import Dropdown from "../../components/common/Dropdown";
import {
  fetchAdminSessions,
  deleteAdminSession,
  logSessionJoin,
  fetchEventMode,
  setEventMode,
  type AdminSession,
  type EventModeState,
} from "../../utils/fetch/admin";
import ErrorScreen from "../../components/common/ErrorScreen";

type ViewMode = "grid" | "list";
type SortBy = "date" | "airport" | "creator" | "controllers" | "flights";

const sortOptions = [
  { value: "date", label: "Sort by Date" },
  { value: "airport", label: "Sort by Airport" },
  { value: "creator", label: "Sort by Creator" },
  { value: "controllers", label: "Sort by Controllers" },
  { value: "flights", label: "Sort by Flights" },
];

function adminNetworkSessionKind(
  session: AdminSession
): "standard" | "pfatc" | "advanced_atc" {
  if (session.is_advanced_atc) return "advanced_atc";
  if (session.is_pfatc) return "pfatc";
  return "standard";
}

const adminSessionKindStyles: Record<
  "standard" | "pfatc" | "advanced_atc",
  { hover: string; iconBg: string; iconClass: string }
> = {
  pfatc: {
    hover: "hover:border-blue-500/50",
    iconBg: "bg-blue-500/20",
    iconClass: "text-blue-500",
  },
  advanced_atc: {
    hover: "hover:border-purple-500/50",
    iconBg: "bg-purple-500/20",
    iconClass: "text-purple-500",
  },
  standard: {
    hover: "hover:border-green-500/50",
    iconBg: "bg-green-500/20",
    iconClass: "text-green-400",
  },
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
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<AdminSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventMode, setEventModeState] = useState<EventModeState>({
    pfatcEventMode: false,
    aatcEventMode: false,
  });
  const [eventModeLoading, setEventModeLoading] = useState(false);
  const [eventModeOpen, setEventModeOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortBy, setSortBy] = useState<SortBy>("date");
  const [selectedSession, setSelectedSession] = useState<AdminSession | null>(
    null
  );
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(100);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState(searchParams.get("search") || "");

  useEffect(() => {
    fetchSessions();
    loadEventMode();
  }, [page, search]);

  const loadEventMode = async () => {
    try {
      const data = await fetchEventMode();
      setEventModeState(data);
    } catch {
      /* optional event mode settings */
    }
  };

  const handleToggleEventMode = async (field: keyof EventModeState) => {
    try {
      setEventModeLoading(true);
      const updated = await setEventMode({ [field]: !eventMode[field] });
      setEventModeState(updated);
      setToast({
        message: `${field === "pfatcEventMode" ? "PFATC" : "AATC"} event mode ${updated[field] ? "enabled" : "disabled"}`,
        type: "success",
      });
    } catch {
      setToast({ message: "Failed to update event mode", type: "error" });
    } finally {
      setEventModeLoading(false);
    }
  };
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
    const filtered = [...sessions];

    filtered.sort((a, b) => {
      switch (sortBy) {
        case "date":
          return (
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        case "airport":
          return a.airport_icao.localeCompare(b.airport_icao);
        case "creator":
          return (a.username || a.created_by).localeCompare(
            b.username || b.created_by
          );
        case "controllers":
          return (b.active_user_count || 0) - (a.active_user_count || 0);
        case "flights":
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
      window.open(url, "_blank");
    } catch (err) {
      console.error("Error logging session join:", err);
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
          err instanceof Error ? err.message : "Failed to delete session",
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

    if (avatar.startsWith("http")) {
      return avatar;
    }

    const isAnimated = avatar.startsWith("a_");
    const extension = isAnimated ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.${extension}?size=${size}`;
  };

  const renderSessionGrid = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {filteredSessions.map((session) => (
        <div
          key={session.session_id}
          className={`bg-zinc-900 border-2 border-zinc-700/50 rounded-2xl p-6 ${
            adminSessionKindStyles[adminNetworkSessionKind(session)].hover
          } transition-all duration-200`}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div
                className={`p-2 rounded-lg ${
                  adminSessionKindStyles[adminNetworkSessionKind(session)]
                    .iconBg
                }`}
              >
                {adminNetworkSessionKind(session) === "standard" ? (
                  <MdShowChart
                    className={`w-4 h-4 ${adminSessionKindStyles.standard.iconClass}`}
                  />
                ) : (
                  <MdCellTower
                    className={`w-4 h-4 ${adminSessionKindStyles[adminNetworkSessionKind(session)].iconClass}`}
                  />
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
              size={adminDownsizeButtonSize("sm")}
              variant="ghost"
              onClick={() => {
                setSelectedSession(session);
                setShowModal(true);
              }}
              className="p-2"
            >
              <MdMoreHoriz className="w-5 h-5" />
            </Button>
          </div>

          <div className="flex items-center space-x-3 mb-4 pb-4 border-b border-zinc-700">
            {getAvatarUrl(session.created_by, session.avatar, 40) ? (
              <img
                src={getAvatarUrl(session.created_by, session.avatar, 40)!}
                alt={session.username}
                className="w-10 h-10 rounded-full"
              />
            ) : (
              <div className="w-10 h-10 bg-zinc-700 rounded-full flex items-center justify-center">
                <MdPeople className="w-5 h-5 text-zinc-400" />
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

          <Button
            onClick={() => handleJoinSession(session)}
            className="w-full flex items-center justify-center space-x-2"
            size={adminDownsizeButtonSize("sm")}
            variant="primary"
          >
            <MdOpenInNew className="w-4 h-4" />
            <span>Join Session</span>
          </Button>
        </div>
      ))}
    </div>
  );

  const renderSessionList = () => (
    <AdminTable minWidth="800px">
      <thead className={ADMIN_TABLE_HEAD}>
        <tr>
          <th className={ADMIN_TH}>Session</th>
          <th className={ADMIN_TH}>Creator</th>
          <th className={ADMIN_TH}>Created</th>
          <th className={ADMIN_TH}>Controllers</th>
          <th className={ADMIN_TH}>Flights</th>
          <th className={ADMIN_TH}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {filteredSessions.map((session) => (
          <tr
            key={session.session_id}
            className="border-t border-zinc-700/50 hover:bg-zinc-800/50"
          >
            <td className={ADMIN_TD}>
              <div className="flex items-center space-x-3">
                <div
                  className={`p-2 rounded-lg ${
                    adminSessionKindStyles[adminNetworkSessionKind(session)]
                      .iconBg
                  }`}
                >
                  {adminNetworkSessionKind(session) === "standard" ? (
                    <MdShowChart
                      className={`w-4 h-4 ${adminSessionKindStyles.standard.iconClass}`}
                    />
                  ) : (
                    <MdCellTower
                      className={`w-4 h-4 ${adminSessionKindStyles[adminNetworkSessionKind(session)].iconClass}`}
                    />
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
            <td className={ADMIN_TD}>
              <div className="flex items-center space-x-3">
                {getAvatarUrl(session.created_by, session.avatar, 32) ? (
                  <img
                    src={getAvatarUrl(session.created_by, session.avatar, 32)!}
                    alt={session.username}
                    className="w-8 h-8 rounded-full"
                  />
                ) : (
                  <div className="w-8 h-8 bg-zinc-700 rounded-full flex items-center justify-center">
                    <MdPeople className="w-4 h-4 text-zinc-400" />
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
            <td className={ADMIN_TD}>
              <div className="text-white font-medium">
                {formatTimeAgo(session.created_at)}
              </div>
              <div className="text-xs text-zinc-500">
                {formatDateTime(session.created_at)}
              </div>
            </td>
            <td className={ADMIN_TD}>
              <span className="text-white font-medium">
                {session.active_user_count || 0}
              </span>
            </td>
            <td className={ADMIN_TD}>
              <span className="text-white font-medium">
                {session.flight_count || 0}
              </span>
            </td>
            <td className={ADMIN_TD}>
              <div className="flex items-center space-x-2">
                <Button
                  size={adminDownsizeButtonSize("sm")}
                  variant="primary"
                  onClick={() => handleJoinSession(session)}
                  className="flex items-center space-x-2"
                >
                  <MdOpenInNew className="w-4 h-4" />
                  <span>Join</span>
                </Button>
                <Button
                  size={adminDownsizeButtonSize("sm")}
                  variant="ghost"
                  onClick={() => {
                    setSelectedSession(session);
                    setShowModal(true);
                  }}
                  className="p-2"
                >
                  <MdMoreHoriz className="w-4 h-4" />
                </Button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </AdminTable>
  );

  return (
    <AdminLayout toast={toast} onToastClose={() => setToast(null)}>
      <AdminPageHeader
        title="Session Management"
        icon={MdStorage}
        accent="yellow"
      />

      <AdminToolbar className={ADMIN_TOOLBAR_MOBILE_COL}>
        <AdminSearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by session ID, airport, or creator..."
          loading={loading}
          className={ADMIN_TOOLBAR_MOBILE_SEARCH}
        />

        <div className={ADMIN_TOOLBAR_MOBILE_PAIR}>
          <div className="flex bg-gray-800 border-2 border-blue-600 rounded-full overflow-hidden h-10 shrink-0 max-md:flex-1">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`px-3 h-full flex items-center justify-center gap-1.5 text-xs transition-colors ${
                viewMode === "grid"
                  ? ADMIN_SEGMENT_ACTIVE
                  : ADMIN_SEGMENT_INACTIVE
              }`}
            >
              <MdGridOn className="w-3.5 h-3.5" />
              <span>Grid</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`px-3 h-full flex items-center justify-center gap-1.5 text-xs transition-colors ${
                viewMode === "list"
                  ? ADMIN_SEGMENT_ACTIVE
                  : ADMIN_SEGMENT_INACTIVE
              }`}
            >
              <MdViewList className="w-3.5 h-3.5" />
              <span>List</span>
            </button>
          </div>

          <Dropdown
            options={sortOptions}
            value={sortBy}
            onChange={(value) => setSortBy(value as SortBy)}
            size="sm"
            className={ADMIN_TOOLBAR_MOBILE_SPLIT_ITEM}
          />

          <button
            type="button"
            onClick={() => setEventModeOpen((o) => !o)}
            className={`flex items-center gap-1.5 h-10 px-3 rounded-full border-2 text-xs font-medium transition-colors shrink-0 max-md:flex-1 max-md:justify-center ${
              eventModeOpen
                ? "bg-blue-500/20 border-blue-500/50 text-blue-200"
                : "bg-gray-800 border-blue-600 text-zinc-200 hover:border-blue-400 hover:text-white"
            } ${eventMode.pfatcEventMode || eventMode.aatcEventMode ? "ring-1 ring-blue-500/40" : ""}`}
          >
            <MdCellTower className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Event Mode</span>
            {(eventMode.pfatcEventMode || eventMode.aatcEventMode) && (
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
            )}
            <MdExpandMore
              className={`w-3.5 h-3.5 transition-transform duration-200 ${eventModeOpen ? "rotate-180" : ""}`}
            />
          </button>

          <AdminRefreshButton
            onClick={fetchSessions}
            loading={loading}
            className="max-md:ml-auto shrink-0"
          />
        </div>
      </AdminToolbar>

      {eventModeOpen && (
        <div className={`${adminSectionClass()} mb-4`}>
          <p className="text-zinc-500 text-sm mb-4">
            When event mode is active, only users with the corresponding Sector
            Controller role can create sessions on that network.
          </p>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-zinc-800 border border-zinc-700/50 rounded-xl">
              <div className="flex items-center gap-4">
                <div
                  className={`p-2 rounded-lg ${eventMode.pfatcEventMode ? "bg-blue-500/20" : "bg-zinc-700/50"}`}
                >
                  <MdCellTower
                    className={`w-4 h-4 ${eventMode.pfatcEventMode ? "text-blue-400" : "text-zinc-500"}`}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium text-sm">
                      PFATC Event Mode
                    </span>
                    {eventMode.pfatcEventMode && (
                      <span className={ADMIN_TOGGLE_BADGE_ACTIVE}>Active</span>
                    )}
                  </div>
                  <p className="text-zinc-500 text-xs mt-0.5">
                    {eventMode.pfatcEventMode
                      ? "Only PFATC Sector Controllers can create PFATC sessions"
                      : "Anyone can create PFATC sessions"}
                  </p>
                </div>
              </div>
              <AdminToggleSwitch
                checked={eventMode.pfatcEventMode}
                onChange={() => handleToggleEventMode("pfatcEventMode")}
                disabled={eventModeLoading}
                aria-label="Toggle PFATC event mode"
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-zinc-800 border border-zinc-700/50 rounded-xl">
              <div className="flex items-center gap-4">
                <div
                  className={`p-2 rounded-lg ${eventMode.aatcEventMode ? "bg-blue-500/20" : "bg-zinc-700/50"}`}
                >
                  <MdCellTower
                    className={`w-4 h-4 ${eventMode.aatcEventMode ? "text-blue-400" : "text-zinc-500"}`}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium text-sm">
                      AATC Event Mode
                    </span>
                    {eventMode.aatcEventMode && (
                      <span className={ADMIN_TOGGLE_BADGE_ACTIVE}>Active</span>
                    )}
                  </div>
                  <p className="text-zinc-500 text-xs mt-0.5">
                    {eventMode.aatcEventMode
                      ? "Only AATC Sector Controllers can create Advanced ATC sessions"
                      : "Anyone can create Advanced ATC sessions"}
                  </p>
                </div>
              </div>
              <AdminToggleSwitch
                checked={eventMode.aatcEventMode}
                onChange={() => handleToggleEventMode("aatcEventMode")}
                disabled={eventModeLoading}
                aria-label="Toggle AATC event mode"
              />
            </div>
          </div>
        </div>
      )}

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
            ? "No sessions found matching your search."
            : "No active sessions."}
        </div>
      ) : (
        <>{viewMode === "grid" ? renderSessionGrid() : renderSessionList()}</>
      )}

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

      <AdminModal
        open={showModal && !!selectedSession}
        onClose={() => {
          setShowModal(false);
          setSelectedSession(null);
        }}
        title="Session Details"
        size="md"
        footer={
          selectedSession ? (
            <>
              <Button
                onClick={() => handleJoinSession(selectedSession)}
                className="flex items-center justify-center gap-2"
                variant="primary"
                size={adminDownsizeButtonSize("sm")}
              >
                <MdOpenInNew className="w-4 h-4" />
                <span>Join Session</span>
              </Button>
              <Button
                onClick={() => handleDeleteSession(selectedSession.session_id)}
                className="flex items-center justify-center gap-2"
                variant="danger"
                size={adminDownsizeButtonSize("sm")}
              >
                <MdDelete className="w-4 h-4" />
                <span>Delete Session</span>
              </Button>
            </>
          ) : undefined
        }
      >
        {selectedSession && (
          <div className="space-y-4">
            <div className="bg-zinc-800 rounded-lg p-4">
              <div className="flex items-center space-x-3 mb-3">
                <div
                  className={`p-2 rounded-lg ${
                    adminSessionKindStyles[
                      adminNetworkSessionKind(selectedSession)
                    ].iconBg
                  }`}
                >
                  {adminNetworkSessionKind(selectedSession) === "standard" ? (
                    <MdShowChart
                      className={`w-4 h-4 ${adminSessionKindStyles.standard.iconClass}`}
                    />
                  ) : (
                    <MdCellTower
                      className={`w-4 h-4 ${adminSessionKindStyles[adminNetworkSessionKind(selectedSession)].iconClass}`}
                    />
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
                    <MdFlight className="w-4 h-4 inline mr-2" />
                    Flights
                  </span>
                  <span className="text-white font-medium">
                    {selectedSession.flight_count}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">
                    <MdAir className="w-4 h-4 inline mr-2" />
                    Active Runway
                  </span>
                  <span className="text-white font-medium">
                    {selectedSession.active_runway || "N/A"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">
                    <MdCalendarToday className="w-4 h-4 inline mr-2" />
                    Created
                  </span>
                  <span className="text-white font-medium">
                    {formatDateTime(selectedSession.created_at)}
                  </span>
                </div>
              </div>
            </div>

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
                    <MdPeople className="w-6 h-6 text-zinc-400" />
                  </div>
                )}
                <div>
                  <div className="text-white font-medium">
                    {selectedSession.username || "Unknown User"}
                  </div>
                  <div className="text-xs text-zinc-500 font-mono">
                    {selectedSession.created_by}
                  </div>
                </div>
              </div>
            </div>

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
                                border: `2px solid ${highestRole?.color || "#71717a"}`,
                              }}
                            />
                          ) : (
                            <div
                              className="w-8 h-8 bg-zinc-600 rounded-full flex items-center justify-center transition-all"
                              style={{
                                border: `2px solid ${highestRole?.color || "#71717a"}`,
                              }}
                            >
                              <MdPeople className="w-4 h-4 text-zinc-400" />
                            </div>
                          )}

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
                            {user.username}{" "}
                            <span className="text-zinc-500 font-mono text-xs">
                              ({user.id})
                            </span>
                          </div>
                          {user.position && user.position !== "POSITION" && (
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
          </div>
        )}
      </AdminModal>
    </AdminLayout>
  );
}
