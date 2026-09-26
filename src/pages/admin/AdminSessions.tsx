import { useState, useEffect, type CSSProperties } from 'react';
import { useSearchParams } from 'react-router';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  LayoutGrid,
  List,
  Lock,
  Info,
  Plug,
  RadioTower,
  Server,
  Sparkles,
  TowerControl,
  Trash2,
  Unlock,
  User,
  type LucideIcon,
} from 'lucide-react';
import AdminRefreshButton from '../../components/admin/AdminRefreshButton';
import AdminLayout from '../../components/admin/AdminLayout';
import AdminModal from '../../components/admin/AdminModal';
import AdminPage from '../../components/admin/AdminPage';
import AdminSection from '../../components/admin/AdminSection';
import AdminSelect from '../../components/admin/AdminSelect';
import AdminSessionEditor from '../../components/admin/AdminSessionEditor';
import AdminStatusBadge from '../../components/admin/AdminStatusBadge';
import AdminToggleSwitch from '../../components/admin/AdminToggleSwitch';
import AdminToolbar from '../../components/admin/AdminToolbar';
import AdminSearchInput from '../../components/admin/AdminSearchInput';
import AdminTable from '../../components/admin/AdminTable';
import {
  AdminEmptyState,
  AdminErrorState,
  AdminLoading,
} from '../../components/admin/AdminStates';
import { useAdminConfirm } from '../../components/admin/useAdminConfirm';
import type { AdminTone } from '../../components/admin/adminConstants';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { getIconComponent } from '../../utils/roles';
import {
  fetchAdminSessions,
  deleteAdminSession,
  releaseAdminSessionClaim,
  logSessionJoin,
  fetchEventMode,
  setEventMode,
  type AdminSession,
  type EventModeState,
} from '../../utils/fetch/admin';

type ViewMode = 'grid' | 'list';
type SortBy = 'date' | 'airport' | 'creator' | 'controllers' | 'flights';
type SessionKind = 'standard' | 'pfatc' | 'advanced_atc';

const sortOptions = [
  { value: 'date', label: 'Sort by Date' },
  { value: 'airport', label: 'Sort by Airport' },
  { value: 'creator', label: 'Sort by Creator' },
  { value: 'controllers', label: 'Sort by Controllers' },
  { value: 'flights', label: 'Sort by Flights' },
];

function adminNetworkSessionKind(session: AdminSession): SessionKind {
  if (session.is_advanced_atc) return 'advanced_atc';
  if (session.is_pfatc) return 'pfatc';
  return 'standard';
}

const SESSION_KIND: Record<
  SessionKind,
  { label: string; tone: AdminTone; icon: LucideIcon }
> = {
  pfatc: { label: 'PFATC', tone: 'info', icon: RadioTower },
  advanced_atc: { label: 'Advanced ATC', tone: 'purple', icon: Sparkles },
  standard: { label: 'Standard', tone: 'success', icon: TowerControl },
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
  const [total, setTotal] = useState<number | null>(null);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const { confirm, confirmDialog } = useAdminConfirm();

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
        message: `${field === 'pfatcEventMode' ? 'PFATC' : 'AATC'} event mode ${updated[field] ? 'enabled' : 'disabled'}`,
        type: 'success',
      });
    } catch {
      setToast({ message: 'Failed to update event mode', type: 'error' });
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
      setTotal(
        typeof data.pagination.total === 'number' ? data.pagination.total : null
      );
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
      const url = `${window.location.origin}/view/${session.session_id}/?accessId=${session.access_id}`;
      window.open(url, '_blank');
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (
      !(await confirm({
        title: 'Delete this session?',
        description:
          'Are you sure you want to delete this session? This action cannot be undone.',
        confirmText: 'Delete session',
        destructive: true,
      }))
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

  const mergeSession = (sessionId: string, patch: Partial<AdminSession>) => {
    setSessions((prev) =>
      prev.map((s) => (s.session_id === sessionId ? { ...s, ...patch } : s))
    );
    setSelectedSession((prev) =>
      prev && prev.session_id === sessionId ? { ...prev, ...patch } : prev
    );
  };

  const handleSessionSaved = (
    sessionId: string,
    updated: Partial<AdminSession>
  ) => {
    mergeSession(sessionId, updated);
    setToast({ message: 'Session updated', type: 'success' });
  };

  const handleReleaseClaim = async (session: AdminSession) => {
    if (
      !(await confirm({
        title: 'Release external claim?',
        description: `The developer app holding ${session.airport_icao} (${session.session_id}) will lose its claim. Pilots will get the built-in ACARS panel again unless the session is flagged external.`,
        confirmText: 'Release claim',
        destructive: true,
      }))
    ) {
      return;
    }
    try {
      await releaseAdminSessionClaim(session.session_id);
      mergeSession(session.session_id, { external_claim: null });
      setToast({ message: 'Claim released', type: 'success' });
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Failed to release claim',
        type: 'error',
      });
    }
  };

  const formatTimeUntil = (dateString: string) => {
    const diffMins = Math.round(
      (new Date(dateString).getTime() - Date.now()) / 60000
    );
    if (isNaN(diffMins)) return 'unknown';
    if (diffMins <= 0) return 'now';
    if (diffMins < 60) return `in ${diffMins}m`;
    return `in ${Math.floor(diffMins / 60)}h ${diffMins % 60}m`;
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

    if (avatar.startsWith('http')) {
      return avatar;
    }

    const isAnimated = avatar.startsWith('a_');
    const extension = isAnimated ? 'gif' : 'png';
    return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.${extension}?size=${size}`;
  };

  const openDetails = (session: AdminSession) => {
    setSelectedSession(session);
    setShowModal(true);
  };

  const renderUserAvatar = (
    userId: string,
    avatar: string | null,
    username: string | undefined,
    size: number,
    className?: string,
    style?: CSSProperties
  ) => {
    const url = getAvatarUrl(userId, avatar, size);
    return (
      <Avatar className={className} style={style}>
        {url ? <AvatarImage src={url} alt={username} /> : null}
        <AvatarFallback>
          <User className="size-1/2" />
        </AvatarFallback>
      </Avatar>
    );
  };

  const renderKindBadge = (session: AdminSession, showLabel = false) => {
    const kind = SESSION_KIND[adminNetworkSessionKind(session)];
    return (
      <AdminStatusBadge tone={kind.tone} icon={kind.icon} showLabel={showLabel}>
        {kind.label}
      </AdminStatusBadge>
    );
  };

  const describeClaimHolder = (session: AdminSession) => {
    const claim = session.external_claim;
    if (!claim) return null;
    const key = claim.keyName || `key ${claim.keyId}`;
    return claim.username ? `${key} (${claim.username})` : key;
  };

  const renderExternalBadges = (session: AdminSession, showLabel = false) => {
    const claim = session.external_claim;
    return (
      <>
        {session.external_session === true && (
          <AdminStatusBadge tone="orange" icon={Plug} showLabel={showLabel}>
            {showLabel
              ? 'External'
              : 'External: pilots use the external ACARS panel'}
          </AdminStatusBadge>
        )}
        {claim && (
          <AdminStatusBadge
            tone={claim.active ? 'warning' : 'neutral'}
            icon={Lock}
            showLabel={showLabel}
          >
            {showLabel
              ? claim.active
                ? 'Claimed'
                : 'Stale claim'
              : claim.active
                ? `Claimed by ${describeClaimHolder(session)} · expires ${formatTimeUntil(claim.expiresAt)}`
                : `Stale claim by ${describeClaimHolder(session)} (key revoked or scope removed)`}
          </AdminStatusBadge>
        )}
      </>
    );
  };

  const renderSessionGrid = () => (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {filteredSessions.map((session) => (
        <div
          key={session.session_id}
          className="flex flex-col gap-4 rounded-2xl border bg-card p-4 text-card-foreground"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <h3 className="text-base font-semibold">
                  {session.airport_icao}
                </h3>
                {renderExternalBadges(session)}
              </div>
              <p className="truncate font-mono text-xs text-muted-foreground">
                {session.session_id}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {renderKindBadge(session)}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Session details"
                    onClick={() => openDetails(session)}
                  >
                    <Info />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Session details</TooltipContent>
              </Tooltip>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {renderUserAvatar(
              session.created_by,
              session.avatar,
              session.username,
              40,
              'size-8'
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {session.username || 'Unknown User'}
              </p>
              <p className="truncate font-mono text-xs text-muted-foreground">
                {session.created_by}
              </p>
            </div>
          </div>

          <dl className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <dt className="text-muted-foreground">Flights</dt>
              <dd className="font-medium tabular-nums">
                {session.flight_count || 0}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Controllers</dt>
              <dd className="font-medium tabular-nums">
                {session.active_user_count || 0}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Created</dt>
              <dd className="font-medium">
                {formatTimeAgo(session.created_at)}
              </dd>
            </div>
          </dl>

          <Button
            onClick={() => handleJoinSession(session)}
            className="mt-auto w-full"
            size="sm"
            variant="outline"
          >
            <ExternalLink />
            Join Session
          </Button>
        </div>
      ))}
    </div>
  );

  const renderSessionList = () => (
    <AdminTable minWidth="800px">
      <TableHeader>
        <TableRow>
          <TableHead>Session</TableHead>
          <TableHead>Creator</TableHead>
          <TableHead>Created</TableHead>
          <TableHead className="text-right">Controllers</TableHead>
          <TableHead className="text-right">Flights</TableHead>
          <TableHead className="w-24 text-right">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filteredSessions.map((session) => (
          <TableRow key={session.session_id}>
            <TableCell>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{session.airport_icao}</span>
                  {renderKindBadge(session)}
                  {renderExternalBadges(session)}
                </div>
                <div className="font-mono text-xs text-muted-foreground">
                  {session.session_id}
                </div>
              </div>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-3">
                {renderUserAvatar(
                  session.created_by,
                  session.avatar,
                  session.username,
                  32
                )}
                <div className="min-w-0">
                  <div className="font-medium">
                    {session.username || 'Unknown User'}
                  </div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {session.created_by}
                  </div>
                </div>
              </div>
            </TableCell>
            <TableCell>
              <div className="font-medium">
                {formatTimeAgo(session.created_at)}
              </div>
              <div className="text-xs text-muted-foreground">
                {formatDateTime(session.created_at)}
              </div>
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {session.active_user_count || 0}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {session.flight_count || 0}
            </TableCell>
            <TableCell>
              <div className="flex items-center justify-end gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Join session"
                      onClick={() => handleJoinSession(session)}
                    >
                      <ExternalLink />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Join session</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Session details"
                      onClick={() => openDetails(session)}
                    >
                      <Info />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Session details</TooltipContent>
                </Tooltip>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </AdminTable>
  );

  const eventModeActive = eventMode.pfatcEventMode || eventMode.aatcEventMode;

  return (
    <AdminLayout toast={toast} onToastClose={() => setToast(null)}>
      <AdminPage
        title="Sessions"
        icon={Server}
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => setEventModeOpen((o) => !o)}
              aria-expanded={eventModeOpen}
              className={cn(eventModeOpen && 'bg-accent')}
            >
              <RadioTower />
              Event Mode
              {eventModeActive ? (
                <span
                  className="size-1.5 shrink-0 rounded-full bg-blue-400"
                  aria-label="Event mode active"
                />
              ) : null}
              <ChevronDown
                className={cn(
                  'transition-transform duration-200',
                  eventModeOpen && 'rotate-180'
                )}
              />
            </Button>
            <AdminRefreshButton onClick={fetchSessions} loading={loading} />
          </>
        }
      >
        {eventModeOpen && (
          <AdminSection title="Event mode">
            <div className="grid gap-3">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      PFATC Event Mode
                    </span>
                    {eventMode.pfatcEventMode && (
                      <AdminStatusBadge tone="success" icon={RadioTower}>
                        Active
                      </AdminStatusBadge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {eventMode.pfatcEventMode
                      ? 'Only PFATC Sector Controllers can create PFATC sessions'
                      : 'Anyone can create PFATC sessions'}
                  </p>
                </div>
                <AdminToggleSwitch
                  checked={eventMode.pfatcEventMode}
                  onChange={() => handleToggleEventMode('pfatcEventMode')}
                  disabled={eventModeLoading}
                  aria-label="Toggle PFATC event mode"
                />
              </div>

              {/* AATC disabled — AATC event mode toggle hidden
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      AATC Event Mode
                    </span>
                    {eventMode.aatcEventMode && (
                      <AdminStatusBadge tone="success" icon={RadioTower}>
                        Active
                      </AdminStatusBadge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {eventMode.aatcEventMode
                      ? 'Only AATC Sector Controllers can create Advanced ATC sessions'
                      : 'Anyone can create Advanced ATC sessions'}
                  </p>
                </div>
                <AdminToggleSwitch
                  checked={eventMode.aatcEventMode}
                  onChange={() => handleToggleEventMode('aatcEventMode')}
                  disabled={eventModeLoading}
                  aria-label="Toggle AATC event mode"
                />
              </div>
              */}
            </div>
          </AdminSection>
        )}

        <AdminToolbar>
          <AdminSearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by session ID, airport, or creator..."
            loading={loading}
          />
          <div className="flex items-center gap-2 sm:ml-auto">
            <ToggleGroup
              type="single"
              variant="outline"
              value={viewMode}
              onValueChange={(v) => {
                if (v) setViewMode(v as ViewMode);
              }}
              aria-label="View mode"
              className="shrink-0"
            >
              <ToggleGroupItem value="grid" aria-label="Grid view">
                <LayoutGrid />
                <span className="hidden sm:inline">Grid</span>
              </ToggleGroupItem>
              <ToggleGroupItem value="list" aria-label="List view">
                <List />
                <span className="hidden sm:inline">List</span>
              </ToggleGroupItem>
            </ToggleGroup>
            <AdminSelect
              options={sortOptions}
              value={sortBy}
              onChange={(value) => setSortBy(value as SortBy)}
              aria-label="Sort sessions"
              className="min-w-0 flex-1 sm:w-48 sm:flex-none"
            />
          </div>
        </AdminToolbar>

        {loading ? (
          <AdminLoading label="Loading sessions…" />
        ) : error ? (
          <AdminErrorState
            title="Error loading sessions"
            message={error}
            onRetry={fetchSessions}
          />
        ) : filteredSessions.length === 0 ? (
          <AdminEmptyState
            icon={Server}
            title={search ? 'No sessions found' : 'No active sessions'}
          />
        ) : (
          <>{viewMode === 'grid' ? renderSessionGrid() : renderSessionList()}</>
        )}

        <div className="flex flex-col items-center justify-end gap-2 sm:flex-row sm:gap-4">
          <p className="text-sm text-muted-foreground tabular-nums">
            Page {page} of {totalPages}
            {total !== null ? ` · ${total.toLocaleString()} total` : ''}
          </p>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              variant="outline"
              size="sm"
            >
              <ChevronLeft />
              Previous
            </Button>
            <Button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              variant="outline"
              size="sm"
            >
              Next
              <ChevronRight />
            </Button>
          </div>
        </div>
      </AdminPage>

      <AdminModal
        open={showModal && !!selectedSession}
        onClose={() => {
          setShowModal(false);
          setSelectedSession(null);
        }}
        title="Session Details"
        size="lg"
        footer={
          selectedSession ? (
            <>
              <Button
                onClick={() => handleDeleteSession(selectedSession.session_id)}
                variant="destructive"
                className="sm:mr-auto"
              >
                <Trash2 />
                Delete Session
              </Button>
              <Button onClick={() => handleJoinSession(selectedSession)}>
                <ExternalLink />
                Join Session
              </Button>
            </>
          ) : undefined
        }
      >
        {selectedSession && (
          <>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              <div className="grid gap-1">
                <dt className="text-xs text-muted-foreground">Airport</dt>
                <dd className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium">
                  {selectedSession.airport_icao}
                  {renderKindBadge(selectedSession, true)}
                  {renderExternalBadges(selectedSession, true)}
                </dd>
              </div>
              <div className="grid min-w-0 gap-1">
                <dt className="text-xs text-muted-foreground">Session ID</dt>
                <dd className="truncate font-mono text-xs leading-5">
                  {selectedSession.session_id}
                </dd>
              </div>
              <div className="grid gap-1">
                <dt className="text-xs text-muted-foreground">Flights</dt>
                <dd className="text-sm tabular-nums">
                  {selectedSession.flight_count}
                </dd>
              </div>
              <div className="grid gap-1">
                <dt className="text-xs text-muted-foreground">Created</dt>
                <dd className="text-sm">
                  {formatDateTime(selectedSession.created_at)}
                </dd>
              </div>
              <div className="grid gap-1">
                <dt className="text-xs text-muted-foreground">Active Runway</dt>
                <dd className="text-sm">
                  {selectedSession.active_runway || 'N/A'}
                </dd>
              </div>
              <div className="grid gap-1">
                <dt className="text-xs text-muted-foreground">
                  Arrival Runway
                </dt>
                <dd className="text-sm">
                  {selectedSession.arrival_runway || 'N/A'}
                </dd>
              </div>
              <div className="grid min-w-0 gap-1">
                <dt className="text-xs text-muted-foreground">Custom Name</dt>
                <dd className="truncate text-sm">
                  {selectedSession.custom_name || 'N/A'}
                </dd>
              </div>
              <div className="grid gap-1">
                <dt className="text-xs text-muted-foreground">External</dt>
                <dd className="text-sm">
                  {selectedSession.external_session === true
                    ? 'Yes'
                    : selectedSession.external_session === false
                      ? 'No'
                      : 'Not set'}
                  {selectedSession.developer_api_key_id ? (
                    <span className="text-muted-foreground">
                      {' '}
                      · created via API key{' '}
                      {selectedSession.developer_api_key_id}
                    </span>
                  ) : null}
                </dd>
              </div>
              <div className="grid min-w-0 gap-1">
                <dt className="text-xs text-muted-foreground">Creator</dt>
                <dd className="flex min-w-0 items-center gap-3 text-sm">
                  {renderUserAvatar(
                    selectedSession.created_by,
                    selectedSession.avatar,
                    selectedSession.username,
                    48,
                    'size-8'
                  )}
                  <div className="min-w-0">
                    <div className="font-medium">
                      {selectedSession.username || 'Unknown User'}
                    </div>
                    <div className="truncate font-mono text-xs text-muted-foreground">
                      {selectedSession.created_by}
                    </div>
                  </div>
                </dd>
              </div>
              <div className="grid min-w-0 gap-1">
                <dt className="text-xs text-muted-foreground">Claim</dt>
                <dd className="text-sm">
                  {selectedSession.external_claim ? (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate">
                          {describeClaimHolder(selectedSession)}
                          {!selectedSession.external_claim.active && (
                            <span className="text-muted-foreground">
                              {' '}
                              (inactive)
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Since{' '}
                          {formatDateTime(
                            selectedSession.external_claim.claimedAt
                          )}{' '}
                          · expires{' '}
                          {formatTimeUntil(
                            selectedSession.external_claim.expiresAt
                          )}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReleaseClaim(selectedSession)}
                      >
                        <Unlock />
                        Release
                      </Button>
                    </div>
                  ) : (
                    'Not claimed'
                  )}
                </dd>
              </div>
            </dl>

            <div className="grid gap-3">
              <h3 className="text-sm font-medium">Edit Session</h3>
              <AdminSessionEditor
                session={selectedSession}
                onSaved={(updated) =>
                  handleSessionSaved(selectedSession.session_id, updated)
                }
                onError={(message) => setToast({ message, type: 'error' })}
              />
            </div>

            <div className="grid gap-3">
              <h3 className="text-sm font-medium">
                Active Controllers{' '}
                <span className="text-muted-foreground tabular-nums">
                  {selectedSession.active_user_count || 0}
                </span>
              </h3>
              {!selectedSession.active_users ||
              selectedSession.active_user_count === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No controllers currently active
                </p>
              ) : (
                <div className="grid gap-3">
                  {selectedSession.active_users.map((user) => {
                    const highestRole = getHighestRole(user.roles);
                    const RoleIcon = highestRole
                      ? getIconComponent(highestRole.icon)
                      : null;

                    const avatar = renderUserAvatar(
                      user.id,
                      user.avatar,
                      user.username,
                      32,
                      'border-2',
                      {
                        borderColor: highestRole?.color || 'var(--border)',
                      }
                    );

                    return (
                      <div key={user.id} className="flex items-center gap-3">
                        {highestRole && RoleIcon ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex">{avatar}</span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <span className="flex items-center gap-2">
                                <RoleIcon
                                  className="size-3.5"
                                  style={{ color: highestRole.color }}
                                />
                                {highestRole.name}
                              </span>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          avatar
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">
                            {user.username}{' '}
                            <span className="font-mono text-xs font-normal text-muted-foreground">
                              ({user.id})
                            </span>
                          </div>
                          {user.position && user.position !== 'POSITION' && (
                            <div className="text-xs text-muted-foreground">
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
          </>
        )}
      </AdminModal>

      {confirmDialog}
    </AdminLayout>
  );
}
