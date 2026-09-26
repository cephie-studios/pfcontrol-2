import { useState, useEffect, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  Archive,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  PlaneTakeoff,
  Plane,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react';
import AdminLayout from '../../components/admin/AdminLayout';
import AdminModal from '../../components/admin/AdminModal';
import AdminPage from '../../components/admin/AdminPage';
import AdminTextInput from '../../components/admin/AdminTextInput';
import AdminSearchInput from '../../components/admin/AdminSearchInput';
import AdminToolbar from '../../components/admin/AdminToolbar';
import AdminNativeTable from '../../components/admin/AdminNativeTable';
import AdminSelect from '../../components/admin/AdminSelect';
import AdminStatusBadge from '../../components/admin/AdminStatusBadge';
import {
  AdminEmptyState,
  AdminErrorState,
  AdminLoading,
} from '../../components/admin/AdminStates';
import {
  ADMIN_NATIVE_TBODY,
  ADMIN_NATIVE_TD,
  ADMIN_NATIVE_TH,
  ADMIN_NATIVE_THEAD,
  ADMIN_NATIVE_TR,
  type AdminTone,
} from '../../components/admin/adminConstants';
import {
  fetchFlightLogs,
  revealFlightLogIP,
  type FlightLogsResponse,
  type FlightLog,
} from '../../utils/fetch/admin';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const ACTION_META: Record<
  string,
  { label: string; tone: AdminTone; icon: LucideIcon }
> = {
  add: { label: 'Add Flight', tone: 'success', icon: PlaneTakeoff },
  update: { label: 'Update Flight', tone: 'info', icon: Pencil },
  delete: { label: 'Delete Flight', tone: 'danger', icon: Trash2 },
};

function ActionBadge({ action }: { action: string }) {
  const meta = ACTION_META[action];
  return (
    <AdminStatusBadge
      tone={meta?.tone ?? 'neutral'}
      icon={meta?.icon ?? Plane}
      showLabel
      className="whitespace-nowrap"
    >
      {meta?.label ?? action}
    </AdminStatusBadge>
  );
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

export default function AdminFlightLogs() {
  const [logs, setLogs] = useState<FlightLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generalSearch, setGeneralSearch] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [sessionFilter, setSessionFilter] = useState('');
  const [flightIdFilter, setFlightIdFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [textFilter, setTextFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState<FlightLog | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);
  const [revealedIPs, setRevealedIPs] = useState<Set<number>>(new Set());
  const [revealingIP, setRevealingIP] = useState<number | null>(null);
  const [clientPage, setClientPage] = useState(1);

  const actionTypeOptions = [
    { value: '', label: 'All Actions' },
    { value: 'add', label: 'Add Flight' },
    { value: 'update', label: 'Update Flight' },
    { value: 'delete', label: 'Delete Flight' },
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
        err instanceof Error ? err.message : 'Failed to fetch flight logs';
      setError(errorMessage);
      setToast({ message: errorMessage, type: 'error' });
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
    setGeneralSearch('');
    setUserFilter('');
    setActionFilter('');
    setSessionFilter('');
    setFlightIdFilter('');
    setDateFilter('');
    setTextFilter('');
  };

  const getFlightOwner = (
    log: FlightLog
  ): { userId: string | null; username: string | null } => {
    const data = (log.action === 'add' ? log.new_data : log.old_data) as Record<
      string,
      unknown
    > | null;
    return {
      userId: (data?.flight_owner_user_id as string) || null,
      username: (data?.flight_owner_username as string) || null,
    };
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
      await revealFlightLogIP(logId);
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
    if (!ip) return '***.***.***.**';
    if (revealedIPs.has(logId)) return ip;
    const parts = ip.split('.');
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.***.**`;
    return '***.***.***.**';
  };

  const getUpdatedField = (log: FlightLog): string => {
    if (log.action !== 'update' || !log.new_data) return 'N/A';

    const newData = log.new_data as Record<string, unknown>;
    const fields = Object.keys(newData);

    if (fields.length === 0) return 'N/A';

    if (fields.length > 1) {
      const firstField = fields[0];
      return `${firstField}: ${String(newData[firstField])} (+${fields.length - 1} more)`;
    }

    const field = fields[0];
    return `${field}: ${String(newData[field])}`;
  };

  const filteredLogs = logs.filter(() => true);
  const clientLimit = 50;
  const filteredTotalPages = Math.max(
    1,
    Math.ceil(filteredLogs.length / clientLimit)
  );
  const paginatedLogs = filteredLogs.slice(
    (clientPage - 1) * clientLimit,
    clientPage * clientLimit
  );

  const hasFilters =
    generalSearch ||
    userFilter ||
    actionFilter ||
    sessionFilter ||
    flightIdFilter ||
    dateFilter ||
    textFilter;

  const displayPage = filteredLogs.length === 0 ? 0 : clientPage;
  const displayTotalPages = filteredLogs.length === 0 ? 0 : filteredTotalPages;

  const renderIP = (log: FlightLog) => {
    const revealed = revealedIPs.has(log.id);
    const revealing = revealingIP === log.id;
    return (
      <div className="flex items-center gap-1">
        <span
          className={cn(
            'font-mono text-xs',
            !revealed && 'blur-sm select-none'
          )}
        >
          {formatIPAddress(log.ip_address, log.id)}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
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

  const sessionLink = (sessionId: string) => (
    <Link
      to={`/admin/sessions?search=${sessionId}`}
      className="font-mono text-xs underline underline-offset-4 hover:text-muted-foreground"
    >
      {sessionId}
    </Link>
  );

  return (
    <AdminLayout toast={toast} onToastClose={() => setToast(null)}>
      <AdminPage title="Flight Archive" icon={Archive}>
        <AdminToolbar>
          <AdminSearchInput
            value={generalSearch}
            onChange={setGeneralSearch}
            placeholder="Search users, sessions, flight IDs…"
            className="sm:max-w-xs"
          />
          <AdminTextInput
            value={userFilter}
            onChange={setUserFilter}
            placeholder="Username"
            aria-label="Username"
            className="w-full sm:w-36"
          />
          <AdminTextInput
            value={sessionFilter}
            onChange={setSessionFilter}
            placeholder="Session ID"
            aria-label="Session ID"
            className="w-full sm:w-36"
          />
          <AdminTextInput
            value={flightIdFilter}
            onChange={setFlightIdFilter}
            placeholder="Flight ID"
            aria-label="Flight ID"
            className="w-full sm:w-36"
          />
          <AdminTextInput
            value={textFilter}
            onChange={setTextFilter}
            placeholder="Callsign, route…"
            aria-label="Flight data"
            className="w-full sm:w-40"
          />
          <AdminTextInput
            type="date"
            value={dateFilter}
            onChange={setDateFilter}
            aria-label="Date"
            className="w-full sm:w-40"
          />
          <AdminSelect
            options={actionTypeOptions}
            value={actionFilter}
            onChange={(value) => setActionFilter(value)}
            placeholder="All actions"
            aria-label="Action"
            className="sm:w-40"
          />
          <Button
            onClick={clearFilters}
            variant="outline"
            disabled={!hasFilters}
          >
            <X />
            Clear
          </Button>
        </AdminToolbar>

        {loading ? (
          <AdminLoading label="Loading flight logs…" />
        ) : error ? (
          <AdminErrorState
            title="Error loading flight logs"
            message={error}
            onRetry={fetchLogs}
          />
        ) : (
          <>
            {filteredLogs.length === 0 ? (
              <AdminEmptyState icon={Plane} title="No flight logs found" />
            ) : (
              <>
                <AdminNativeTable minWidth="1000px" className="hidden lg:block">
                  <thead className={ADMIN_NATIVE_THEAD}>
                    <tr className={ADMIN_NATIVE_TR}>
                      <th className={ADMIN_NATIVE_TH}>Action</th>
                      <th className={ADMIN_NATIVE_TH}>User</th>
                      <th className={ADMIN_NATIVE_TH}>Session</th>
                      <th className={ADMIN_NATIVE_TH}>Flight ID</th>
                      <th className={ADMIN_NATIVE_TH}>Timestamp</th>
                      <th className={ADMIN_NATIVE_TH}>IP Address</th>
                      <th className={ADMIN_NATIVE_TH}>Updated Field</th>
                      <th className={cn(ADMIN_NATIVE_TH, 'text-right')}>
                        <span className="sr-only">Details</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className={ADMIN_NATIVE_TBODY}>
                    {paginatedLogs.map((log) => (
                      <tr key={log.id} className={ADMIN_NATIVE_TR}>
                        <td className={ADMIN_NATIVE_TD}>
                          <ActionBadge action={log.action} />
                        </td>
                        <td className={ADMIN_NATIVE_TD}>
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {log.username || `Unknown (${log.user_id})`}
                            </span>
                            <span className="font-mono text-xs text-muted-foreground">
                              {log.user_id}
                            </span>
                          </div>
                        </td>
                        <td className={ADMIN_NATIVE_TD}>
                          {sessionLink(log.session_id)}
                        </td>
                        <td
                          className={cn(ADMIN_NATIVE_TD, 'font-mono text-xs')}
                        >
                          {log.flight_id}
                        </td>
                        <td className={ADMIN_NATIVE_TD}>
                          <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                            {formatDate(log.created_at)}
                          </span>
                        </td>
                        <td className={ADMIN_NATIVE_TD}>{renderIP(log)}</td>
                        <td
                          className={cn(
                            ADMIN_NATIVE_TD,
                            'max-w-xs truncate text-muted-foreground'
                          )}
                          title={getUpdatedField(log)}
                        >
                          {getUpdatedField(log)}
                        </td>
                        <td className={cn(ADMIN_NATIVE_TD, 'text-right')}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
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
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </AdminNativeTable>

                <div className="divide-y overflow-hidden rounded-2xl border lg:hidden">
                  {paginatedLogs.map((log) => {
                    const owner =
                      log.action !== 'add' ? getFlightOwner(log) : null;
                    return (
                      <div key={log.id} className="grid gap-3 p-4 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <ActionBadge action={log.action} />
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {formatDate(log.created_at)}
                          </span>
                        </div>

                        <div className="grid gap-1">
                          <p>
                            <span className="text-muted-foreground">
                              {log.action === 'add'
                                ? 'Submitted by'
                                : 'Changed by'}
                              :
                            </span>{' '}
                            {log.username || `Unknown (${log.user_id})`}
                          </p>
                          <p className="font-mono text-xs text-muted-foreground">
                            {log.user_id}
                          </p>
                          {owner && (owner.username || owner.userId) ? (
                            <p>
                              <span className="text-muted-foreground">
                                Flight owner:
                              </span>{' '}
                              {owner.username || owner.userId}
                            </p>
                          ) : null}
                        </div>

                        <div className="grid gap-1">
                          <p>
                            <span className="text-muted-foreground">
                              Session:
                            </span>{' '}
                            {sessionLink(log.session_id)}
                          </p>
                          <p>
                            <span className="text-muted-foreground">
                              Flight ID:
                            </span>{' '}
                            <span className="font-mono text-xs">
                              {log.flight_id}
                            </span>
                          </p>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">IP:</span>
                            {renderIP(log)}
                          </div>
                          <p className="break-words">
                            <span className="text-muted-foreground">
                              Updated:
                            </span>{' '}
                            {getUpdatedField(log)}
                          </p>
                        </div>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewDetails(log)}
                        >
                          <Eye />
                          View details
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            <div className="flex flex-col items-center justify-end gap-2 sm:flex-row">
              <span className="text-sm text-muted-foreground tabular-nums sm:mr-2">
                Page {displayPage} of {displayTotalPages} ·{' '}
                {filteredLogs.length.toLocaleString()} total
              </span>
              <div className="flex gap-2">
                <Button
                  onClick={() => setClientPage(Math.max(1, clientPage - 1))}
                  disabled={clientPage === 1 || filteredLogs.length === 0}
                  variant="outline"
                  size="sm"
                >
                  <ChevronLeft />
                  Previous
                </Button>
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
                  <ChevronRight />
                </Button>
              </div>
            </div>
          </>
        )}
      </AdminPage>

      <AdminModal
        open={showDetails && !!selectedLog}
        onClose={closeDetailsModal}
        title="Flight Log Details"
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
                <ActionBadge action={selectedLog.action} />
              </DetailField>
              <DetailField label="Timestamp">
                <span className="tabular-nums">
                  {formatDate(selectedLog.created_at)}
                </span>
              </DetailField>
              <DetailField label="Flight ID">
                <span className="font-mono text-xs">
                  {selectedLog.flight_id}
                </span>
              </DetailField>
              <DetailField label="Session">
                {sessionLink(selectedLog.session_id)}
              </DetailField>
              <DetailField
                label={
                  selectedLog.action === 'add' ? 'Submitted By' : 'Changed By'
                }
              >
                <p className="font-medium">
                  {selectedLog.username || `Unknown (${selectedLog.user_id})`}
                </p>
                <p className="font-mono text-xs text-muted-foreground">
                  {selectedLog.user_id}
                </p>
              </DetailField>
              {selectedLog.action !== 'add' &&
                (() => {
                  const owner = getFlightOwner(selectedLog);
                  return (
                    <DetailField label="Flight Owner">
                      <p className="font-medium">
                        {owner.username ||
                          owner.userId ||
                          'Anonymous (public submit)'}
                      </p>
                      {owner.userId && (
                        <p className="font-mono text-xs text-muted-foreground">
                          {owner.userId}
                        </p>
                      )}
                    </DetailField>
                  );
                })()}
              <DetailField label="IP Address">
                {renderIP(selectedLog)}
              </DetailField>
            </dl>
            <div className="grid gap-3">
              <h3 className="text-sm font-medium">Old Data</h3>
              <pre className="max-h-80 overflow-auto rounded-xl bg-muted/50 p-4 font-mono text-xs whitespace-pre-wrap">
                {selectedLog.old_data
                  ? JSON.stringify(selectedLog.old_data, null, 2)
                  : 'N/A'}
              </pre>
            </div>
            <div className="grid gap-3">
              <h3 className="text-sm font-medium">New Data</h3>
              <pre className="max-h-80 overflow-auto rounded-xl bg-muted/50 p-4 font-mono text-xs whitespace-pre-wrap">
                {selectedLog.new_data
                  ? JSON.stringify(selectedLog.new_data, null, 2)
                  : 'N/A'}
              </pre>
            </div>
          </>
        )}
      </AdminModal>
    </AdminLayout>
  );
}
