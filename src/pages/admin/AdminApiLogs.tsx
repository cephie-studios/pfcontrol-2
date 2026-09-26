import { useState, useEffect, type ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDownToLine,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  CornerUpRight,
  Eye,
  Pencil,
  PencilLine,
  Plus,
  Trash2,
  X,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import AdminLayout from '../../components/admin/AdminLayout';
import AdminModal from '../../components/admin/AdminModal';
import AdminPage from '../../components/admin/AdminPage';
import AdminToolbar from '../../components/admin/AdminToolbar';
import AdminSearchInput from '../../components/admin/AdminSearchInput';
import AdminTextInput from '../../components/admin/AdminTextInput';
import AdminStatCards from '../../components/admin/AdminStatCards';
import AdminTable from '../../components/admin/AdminTable';
import AdminSelect from '../../components/admin/AdminSelect';
import AdminStatusBadge from '../../components/admin/AdminStatusBadge';
import {
  AdminEmptyState,
  AdminErrorState,
} from '../../components/admin/AdminStates';
import {
  httpStatusTone,
  type AdminTone,
} from '../../components/admin/adminConstants';
import {
  fetchApiLogs,
  fetchApiLogStats,
  fetchApiLogById,
  type ApiLogsResponse,
  type ApiLog,
  type ApiLogStats,
} from '../../utils/fetch/admin';
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

const methodOptions = [
  { value: '', label: 'All Methods' },
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
  { value: 'PUT', label: 'PUT' },
  { value: 'DELETE', label: 'DELETE' },
  { value: 'PATCH', label: 'PATCH' },
];

const statusCodeOptions = [
  { value: '', label: 'All Status Codes' },
  { value: '200', label: '200 - OK' },
  { value: '304', label: '304 - Not Modified' },
  { value: '400', label: '400 - Bad Request' },
  { value: '401', label: '401 - Unauthorized' },
  { value: '403', label: '403 - Forbidden' },
  { value: '404', label: '404 - Not Found' },
  { value: '500', label: '500 - Internal Server Error' },
];

const METHOD_META: Record<string, { tone: AdminTone; icon: LucideIcon }> = {
  GET: { tone: 'info', icon: ArrowDownToLine },
  POST: { tone: 'success', icon: Plus },
  PUT: { tone: 'warning', icon: Pencil },
  DELETE: { tone: 'danger', icon: Trash2 },
  PATCH: { tone: 'purple', icon: PencilLine },
};

const HTTP_TONE_ICON: Record<AdminTone, LucideIcon> = {
  success: CheckCircle2,
  info: CornerUpRight,
  warning: AlertTriangle,
  danger: XCircle,
  purple: CircleDashed,
  orange: AlertTriangle,
  neutral: CircleDashed,
};

function MethodBadge({ method }: { method: string }) {
  const meta = METHOD_META[method];
  return (
    <AdminStatusBadge
      tone={meta?.tone ?? 'neutral'}
      icon={meta?.icon ?? CircleDashed}
      showLabel
      className="font-mono text-xs"
    >
      {method}
    </AdminStatusBadge>
  );
}

function StatusCodeBadge({ code }: { code: number }) {
  const tone = httpStatusTone(code);
  return (
    <AdminStatusBadge
      tone={tone}
      icon={HTTP_TONE_ICON[tone]}
      showLabel
      className="tabular-nums"
    >
      {code}
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

function formatBody(body: unknown) {
  if (typeof body === 'string') {
    try {
      return JSON.stringify(JSON.parse(body), null, 2);
    } catch {
      return body;
    }
  }
  return JSON.stringify(body, null, 2);
}

export default function AdminApiLogs() {
  const [logs, setLogs] = useState<ApiLog[]>([]);
  const [stats, setStats] = useState<ApiLogStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [pathFilter, setPathFilter] = useState('');
  const [statusCodeFilter, setStatusCodeFilter] = useState('');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState<ApiLog | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);
  const [clientPage, setClientPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const clientLimit = 50;

  useEffect(() => {
    setClientPage(1);
  }, [
    searchFilter,
    userFilter,
    methodFilter,
    pathFilter,
    statusCodeFilter,
    dateFromFilter,
    dateToFilter,
  ]);

  useEffect(() => {
    fetchLogs();
  }, [
    clientPage,
    searchFilter,
    userFilter,
    methodFilter,
    pathFilter,
    statusCodeFilter,
    dateFromFilter,
    dateToFilter,
  ]);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchLogs = async () => {
    try {
      setError(null);

      const filters = {
        userId: userFilter || undefined,
        method: methodFilter || undefined,
        path: pathFilter || undefined,
        statusCode: statusCodeFilter ? parseInt(statusCodeFilter) : undefined,
        dateFrom: dateFromFilter || undefined,
        dateTo: dateToFilter || undefined,
        search: searchFilter || undefined,
      };

      const data: ApiLogsResponse = await fetchApiLogs(
        clientPage,
        clientLimit,
        filters
      );

      setLogs(data.logs);
      setTotalPages(data.pagination.pages);
      setTotalLogs(data.pagination.total);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch API logs';
      setError(errorMessage);
      setToast({ message: errorMessage, type: 'error' });
    }
  };

  const fetchStats = async () => {
    try {
      const statsData = await fetchApiLogStats(7);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to fetch API log stats:', err);
      setToast({
        message:
          err instanceof Error ? err.message : 'Failed to fetch API log stats',
        type: 'error',
      });
    }
  };

  const handleLogClick = async (log: ApiLog) => {
    try {
      const detailedLog = await fetchApiLogById(log.id);
      setSelectedLog(detailedLog);
      setShowDetails(true);
    } catch {
      setToast({
        message: 'Failed to fetch log details',
        type: 'error',
      });
    }
  };

  const clearFilters = () => {
    setSearchFilter('');
    setUserFilter('');
    setMethodFilter('');
    setPathFilter('');
    setStatusCodeFilter('');
    setDateFromFilter('');
    setDateToFilter('');
    setClientPage(1);
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();

    if (isNaN(diffMs)) return 'Invalid date';

    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMins > 0) return `${diffMins}m ago`;
    return 'Just now';
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
      timeZoneName: 'short',
    });
  };

  return (
    <AdminLayout toast={toast} onToastClose={() => setToast(null)}>
      <AdminPage title="API Logs" icon={Activity}>
        {stats && (
          <AdminStatCards
            items={[
              { label: 'Requests (7d)', value: stats.totalRequests },
              {
                label: 'Avg response time',
                value: `${stats.averageResponseTime}ms`,
              },
              { label: 'Error rate', value: `${stats.errorRate.toFixed(1)}%` },
              {
                label: 'Top endpoint',
                value: (
                  <span className="font-mono text-base">
                    {stats.topEndpoints[0]?.path.split('?')[0] || 'N/A'}
                  </span>
                ),
              },
            ]}
          />
        )}

        <AdminToolbar>
          <AdminSearchInput
            value={searchFilter}
            onChange={setSearchFilter}
            placeholder="Search logs..."
            grow={false}
            className="sm:w-48"
          />
          <AdminTextInput
            value={userFilter}
            onChange={setUserFilter}
            placeholder="Filter by user..."
            aria-label="Filter by user"
            className="w-full sm:w-44"
          />
          <AdminTextInput
            value={pathFilter}
            onChange={setPathFilter}
            placeholder="Filter by path..."
            aria-label="Filter by path"
            className="w-full sm:w-44"
          />
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <AdminSelect
              options={methodOptions}
              value={methodFilter}
              onChange={setMethodFilter}
              placeholder="Method"
              aria-label="Method"
              className="sm:w-36"
            />
            <AdminSelect
              options={statusCodeOptions}
              value={statusCodeFilter}
              onChange={setStatusCodeFilter}
              placeholder="Status"
              aria-label="Status code"
              className="sm:w-48"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <AdminTextInput
              type="date"
              value={dateFromFilter}
              onChange={setDateFromFilter}
              className="sm:w-44"
              aria-label="From date"
            />
            <AdminTextInput
              type="date"
              value={dateToFilter}
              onChange={setDateToFilter}
              className="sm:w-44"
              aria-label="To date"
            />
          </div>
          <Button onClick={clearFilters} variant="outline">
            <X />
            Clear
          </Button>
        </AdminToolbar>

        {error ? (
          <AdminErrorState
            title="Error loading API logs"
            message={error}
            onRetry={fetchLogs}
          />
        ) : (
          <>
            {logs.length === 0 ? (
              <AdminEmptyState icon={Activity} title="No API logs found" />
            ) : (
              <>
                <AdminTable className="hidden lg:block" minWidth="1000px">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Path</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Response Time</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead className="text-right">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <div className="text-sm">
                            {formatTimeAgo(log.created_at)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDateTime(log.created_at)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <MethodBadge method={log.method} />
                        </TableCell>
                        <TableCell>
                          <div
                            className="max-w-xs truncate font-mono text-xs"
                            title={log.path}
                          >
                            {log.path}
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusCodeBadge code={log.status_code} />
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {log.response_time}ms
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {log.username || 'Unknown'}
                          </div>
                          {log.user_id && (
                            <div className="font-mono text-xs text-muted-foreground">
                              {log.user_id}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                onClick={() => handleLogClick(log)}
                                variant="ghost"
                                size="icon-sm"
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

                <div className="divide-y overflow-hidden rounded-2xl border lg:hidden">
                  {logs.map((log) => (
                    <div key={log.id} className="grid gap-3 p-4 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <MethodBadge method={log.method} />
                        <StatusCodeBadge code={log.status_code} />
                      </div>
                      <p className="font-mono text-xs break-all">{log.path}</p>
                      <div className="grid gap-1">
                        <p>
                          <span className="text-muted-foreground">User:</span>{' '}
                          {log.username || 'Unknown'}
                        </p>
                        <p>
                          <span className="text-muted-foreground">
                            Response Time:
                          </span>{' '}
                          <span className="tabular-nums">
                            {log.response_time}ms
                          </span>
                        </p>
                        <p>
                          <span className="text-muted-foreground">Time:</span>{' '}
                          {formatTimeAgo(log.created_at)}
                        </p>
                      </div>
                      <Button
                        onClick={() => handleLogClick(log)}
                        variant="outline"
                        size="sm"
                      >
                        <Eye />
                        View Details
                      </Button>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="flex flex-col items-center justify-end gap-2 sm:flex-row">
              <span className="text-sm text-muted-foreground tabular-nums sm:mr-2">
                Page {clientPage} of {totalPages} · {totalLogs.toLocaleString()}{' '}
                total
              </span>
              <div className="flex gap-2">
                <Button
                  onClick={() => setClientPage(Math.max(1, clientPage - 1))}
                  disabled={clientPage === 1}
                  variant="outline"
                  size="sm"
                >
                  <ChevronLeft />
                  Previous
                </Button>
                <Button
                  onClick={() =>
                    setClientPage(Math.min(totalPages, clientPage + 1))
                  }
                  disabled={clientPage === totalPages}
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
        onClose={() => setShowDetails(false)}
        title="API Log Details"
        size="xl"
        footer={
          <Button variant="outline" onClick={() => setShowDetails(false)}>
            Close
          </Button>
        }
      >
        {selectedLog && (
          <>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              <DetailField label="Timestamp">
                {formatDateTime(selectedLog.created_at)}
              </DetailField>
              <DetailField label="Method">
                <MethodBadge method={selectedLog.method} />
              </DetailField>
              <DetailField label="Path">
                <p className="font-mono text-xs break-all">
                  {selectedLog.path}
                </p>
              </DetailField>
              <DetailField label="Status Code">
                <StatusCodeBadge code={selectedLog.status_code} />
              </DetailField>
              <DetailField label="Response Time">
                <span className="tabular-nums">
                  {selectedLog.response_time}ms
                </span>
              </DetailField>
              <DetailField label="User">
                <p className="font-medium">
                  {selectedLog.username || 'Unknown'}
                </p>
                {selectedLog.user_id && (
                  <p className="font-mono text-xs text-muted-foreground">
                    {selectedLog.user_id}
                  </p>
                )}
              </DetailField>
              {selectedLog.ip_address && (
                <DetailField label="IP Address">
                  <span className="font-mono text-xs">
                    {selectedLog.ip_address}
                  </span>
                </DetailField>
              )}
              {selectedLog.user_agent && (
                <DetailField label="User Agent" className="sm:col-span-2">
                  <p className="font-mono text-xs break-all">
                    {selectedLog.user_agent}
                  </p>
                </DetailField>
              )}
              {selectedLog.error_message && (
                <DetailField label="Error Message" className="sm:col-span-2">
                  <p className="break-words text-destructive">
                    {selectedLog.error_message}
                  </p>
                </DetailField>
              )}
            </dl>

            {selectedLog.request_body && (
              <div className="grid gap-3">
                <h3 className="text-sm font-medium">Request Body</h3>
                <pre className="max-h-80 overflow-auto rounded-xl bg-muted/50 p-4 font-mono text-xs">
                  <code>{formatBody(selectedLog.request_body)}</code>
                </pre>
              </div>
            )}

            {selectedLog.response_body && (
              <div className="grid gap-3">
                <h3 className="text-sm font-medium">Response Body</h3>
                <pre className="max-h-80 overflow-auto rounded-xl bg-muted/50 p-4 font-mono text-xs">
                  <code>{formatBody(selectedLog.response_body)}</code>
                </pre>
              </div>
            )}
          </>
        )}
      </AdminModal>
    </AdminLayout>
  );
}
