import { useState, useEffect } from 'react';
import {
  MdMonitorHeart,
  MdVisibility,
  MdClose,
  MdPerson,
  MdLink,
  MdCalendarToday,
} from 'react-icons/md';
import AdminLayout from '../../components/admin/AdminLayout';
import AdminModal from '../../components/admin/AdminModal';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminToolbar from '../../components/admin/AdminToolbar';
import AdminSearchInput from '../../components/admin/AdminSearchInput';
import AdminIconInput from '../../components/admin/AdminIconInput';
import AdminStatStrip from '../../components/admin/AdminStatStrip';
import AdminTable from '../../components/admin/AdminTable';
import {
  adminDownsizeButtonSize,
  ADMIN_TOOLBAR_HEIGHT,
  ADMIN_TH,
  ADMIN_TD,
  ADMIN_TABLE_HEAD,
  ADMIN_TOOLBAR_MOBILE_COL,
  ADMIN_TOOLBAR_MOBILE_PAIR,
  ADMIN_TOOLBAR_MOBILE_SEARCH,
  ADMIN_TOOLBAR_MOBILE_SPLIT_ITEM,
  ADMIN_TOOLBAR_MOBILE_STACK_ITEM,
} from '../../components/admin/adminConstants';
import Dropdown from '../../components/common/Dropdown';
import Button from '../../components/common/Button';
import ErrorScreen from '../../components/common/ErrorScreen';
import {
  fetchApiLogs,
  fetchApiLogStats,
  fetchApiLogById,
  type ApiLogsResponse,
  type ApiLog,
  type ApiLogStats,
} from '../../utils/fetch/admin';

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

  const getStatusColor = (statusCode: number) => {
    if (statusCode >= 200 && statusCode < 300) return 'text-green-400';
    if (statusCode >= 300 && statusCode < 400) return 'text-yellow-400';
    if (statusCode >= 400 && statusCode < 500) return 'text-orange-400';
    if (statusCode >= 500) return 'text-red-400';
    return 'text-gray-400';
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET':
        return 'text-blue-400 bg-blue-400/10 border border-blue-400/30';
      case 'POST':
        return 'text-green-400 bg-green-400/10 border border-green-400/30';
      case 'PUT':
        return 'text-yellow-400 bg-yellow-400/10 border border-yellow-400/30';
      case 'DELETE':
        return 'text-red-400 bg-red-400/10 border border-red-400/30';
      case 'PATCH':
        return 'text-purple-400 bg-purple-400/10 border border-purple-400/30';
      default:
        return 'text-gray-400 bg-gray-400/10 border border-gray-400/30';
    }
  };

  return (
    <AdminLayout toast={toast} onToastClose={() => setToast(null)}>
      <AdminPageHeader title="API Logs" icon={MdMonitorHeart} accent="blue" />

      {stats && (
        <AdminStatStrip
          items={[
            { label: 'Total Requests', value: stats.totalRequests },
            {
              label: 'Avg Response Time',
              value: `${stats.averageResponseTime}ms`,
            },
            { label: 'Error Rate', value: `${stats.errorRate.toFixed(1)}%` },
            {
              label: 'Top Endpoint',
              value: stats.topEndpoints[0]?.path.split('?')[0] || 'N/A',
            },
          ]}
        />
      )}

      <AdminToolbar className={ADMIN_TOOLBAR_MOBILE_COL}>
        <AdminSearchInput
          value={searchFilter}
          onChange={setSearchFilter}
          placeholder="Search logs..."
          grow={false}
          className={`w-40 sm:w-48 ${ADMIN_TOOLBAR_MOBILE_SEARCH}`}
        />
        <AdminIconInput
          icon={<MdPerson size={18} />}
          value={userFilter}
          onChange={setUserFilter}
          placeholder="Filter by user..."
          className={`w-36 sm:w-40 ${ADMIN_TOOLBAR_MOBILE_STACK_ITEM}`}
        />
        <AdminIconInput
          icon={<MdLink size={18} />}
          value={pathFilter}
          onChange={setPathFilter}
          placeholder="Filter by path..."
          className={`w-36 sm:w-44 ${ADMIN_TOOLBAR_MOBILE_STACK_ITEM}`}
        />
        <div className={ADMIN_TOOLBAR_MOBILE_PAIR}>
          <Dropdown
            options={methodOptions}
            value={methodFilter}
            onChange={setMethodFilter}
            placeholder="Method"
            size="sm"
            className={ADMIN_TOOLBAR_MOBILE_SPLIT_ITEM}
          />
          <Dropdown
            options={statusCodeOptions}
            value={statusCodeFilter}
            onChange={setStatusCodeFilter}
            placeholder="Status"
            size="sm"
            className={ADMIN_TOOLBAR_MOBILE_SPLIT_ITEM}
          />
        </div>
        <div className={ADMIN_TOOLBAR_MOBILE_PAIR}>
          <AdminIconInput
            icon={<MdCalendarToday size={18} />}
            type="date"
            value={dateFromFilter}
            onChange={setDateFromFilter}
            className={`w-48 ${ADMIN_TOOLBAR_MOBILE_SPLIT_ITEM}`}
            aria-label="From date"
          />
          <AdminIconInput
            icon={<MdCalendarToday size={18} />}
            type="date"
            value={dateToFilter}
            onChange={setDateToFilter}
            className={`w-48 ${ADMIN_TOOLBAR_MOBILE_SPLIT_ITEM}`}
            aria-label="To date"
          />
        </div>
        <Button
          onClick={clearFilters}
          variant="outline"
          size="sm"
          className={`shrink-0 ${ADMIN_TOOLBAR_HEIGHT} py-0 max-md:w-full max-md:basis-full`}
        >
          <MdClose size={16} className="mr-1" />
          Clear
        </Button>
      </AdminToolbar>

      {error ? (
        <ErrorScreen
          title="Error loading API logs"
          message={error}
          onRetry={fetchLogs}
        />
      ) : (
        <>
          <AdminTable className="hidden lg:block" minWidth="1000px">
            <thead className={ADMIN_TABLE_HEAD}>
              <tr>
                <th className={ADMIN_TH}>Timestamp</th>
                <th className={ADMIN_TH}>Method</th>
                <th className={ADMIN_TH}>Path</th>
                <th className={ADMIN_TH}>Status</th>
                <th className={ADMIN_TH}>Response Time</th>
                <th className={ADMIN_TH}>User</th>
                <th className={ADMIN_TH}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr
                  key={log.id}
                  className="border-t border-zinc-700/50 hover:bg-zinc-800/50"
                >
                  <td className={ADMIN_TD}>
                    <div className="text-sm text-white">
                      {formatTimeAgo(log.created_at)}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {formatDateTime(log.created_at)}
                    </div>
                  </td>
                  <td className={ADMIN_TD}>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getMethodColor(log.method)}`}
                    >
                      {log.method}
                    </span>
                  </td>
                  <td className={ADMIN_TD}>
                    <div className="text-sm text-white truncate max-w-xs">
                      {log.path}
                    </div>
                  </td>
                  <td className={ADMIN_TD}>
                    <span
                      className={`text-sm font-medium ${getStatusColor(log.status_code)}`}
                    >
                      {log.status_code}
                    </span>
                  </td>
                  <td className={ADMIN_TD}>
                    <span className="text-sm text-white">
                      {log.response_time}ms
                    </span>
                  </td>
                  <td className={ADMIN_TD}>
                    <div className="text-sm text-white">
                      {log.username || 'Unknown'}
                    </div>
                    {log.user_id && (
                      <div className="text-xs text-zinc-500">{log.user_id}</div>
                    )}
                  </td>
                  <td className={ADMIN_TD}>
                    <Button
                      onClick={() => handleLogClick(log)}
                      variant="ghost"
                      size={adminDownsizeButtonSize('sm')}
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

          <div className="lg:hidden divide-y divide-zinc-800/80 border-t border-zinc-800/80">
            {logs.map((log) => (
              <div key={log.id} className="py-4 first:pt-0">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getMethodColor(log.method)}`}
                    >
                      {log.method}
                    </span>
                    <span
                      className={`text-sm font-medium ${getStatusColor(log.status_code)}`}
                    >
                      {log.status_code}
                    </span>
                  </div>
                  <div className="text-zinc-300">
                    <p className="break-all text-sm">
                      <strong>Path:</strong> {log.path}
                    </p>
                  </div>
                  <div className="text-zinc-300 text-sm">
                    <p>
                      <strong>User:</strong> {log.username || 'Unknown'}
                    </p>
                    <p>
                      <strong>Response Time:</strong> {log.response_time}ms
                    </p>
                    <p>
                      <strong>Time:</strong> {formatTimeAgo(log.created_at)}
                    </p>
                  </div>
                  <Button
                    onClick={() => handleLogClick(log)}
                    variant="ghost"
                    size={adminDownsizeButtonSize('sm')}
                    className="w-full flex items-center justify-center space-x-2"
                  >
                    <MdVisibility size={16} />
                    <span>View Details</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {logs.length === 0 && (
            <div className="text-center py-12 text-zinc-400">
              No API logs found with the current filters.
            </div>
          )}

          <div className="flex justify-center mt-8 space-x-2">
            <Button
              onClick={() => setClientPage(Math.max(1, clientPage - 1))}
              disabled={clientPage === 1}
              variant="outline"
              size="xs"
            >
              Previous
            </Button>
            <span className="text-zinc-400 py-2">
              Page {clientPage} of {totalPages}
            </span>
            <Button
              onClick={() =>
                setClientPage(Math.min(totalPages, clientPage + 1))
              }
              disabled={clientPage === totalPages}
              variant="outline"
              size="xs"
            >
              Next
            </Button>
          </div>
        </>
      )}

      <AdminModal
        open={showDetails && !!selectedLog}
        onClose={() => setShowDetails(false)}
        title="API Log Details"
        size="xl"
      >
        {selectedLog && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-zinc-800 rounded-lg p-4">
                <h3 className="text-sm font-medium text-zinc-400 mb-2">
                  Timestamp
                </h3>
                <p className="text-white">
                  {formatDateTime(selectedLog.created_at)}
                </p>
              </div>
              <div className="bg-zinc-800 rounded-lg p-4">
                <h3 className="text-sm font-medium text-zinc-400 mb-2">
                  Method
                </h3>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getMethodColor(selectedLog.method)}`}
                >
                  {selectedLog.method}
                </span>
              </div>
              <div className="bg-zinc-800 rounded-lg p-4">
                <h3 className="text-sm font-medium text-zinc-400 mb-2">Path</h3>
                <p className="text-white break-all">{selectedLog.path}</p>
              </div>
              <div className="bg-zinc-800 rounded-lg p-4">
                <h3 className="text-sm font-medium text-zinc-400 mb-2">
                  Status Code
                </h3>
                <span
                  className={`text-sm font-medium ${getStatusColor(selectedLog.status_code)}`}
                >
                  {selectedLog.status_code}
                </span>
              </div>
              <div className="bg-zinc-800 rounded-lg p-4">
                <h3 className="text-sm font-medium text-zinc-400 mb-2">
                  Response Time
                </h3>
                <p className="text-white">{selectedLog.response_time}ms</p>
              </div>
              <div className="bg-zinc-800 rounded-lg p-4">
                <h3 className="text-sm font-medium text-zinc-400 mb-2">User</h3>
                <p className="text-white">
                  {selectedLog.username || 'Unknown'}
                </p>
                {selectedLog.user_id && (
                  <p className="text-xs text-zinc-500">{selectedLog.user_id}</p>
                )}
              </div>
            </div>

            {selectedLog.ip_address && (
              <div className="bg-zinc-800 rounded-lg p-4">
                <h3 className="text-sm font-medium text-zinc-400 mb-2">
                  IP Address
                </h3>
                <p className="text-white font-mono">{selectedLog.ip_address}</p>
              </div>
            )}

            {selectedLog.user_agent && (
              <div className="bg-zinc-800 rounded-lg p-4">
                <h3 className="text-sm font-medium text-zinc-400 mb-2">
                  User Agent
                </h3>
                <p className="text-white break-all">{selectedLog.user_agent}</p>
              </div>
            )}

            {selectedLog.request_body && (
              <div className="bg-zinc-800 rounded-lg p-4">
                <h3 className="text-sm font-medium text-zinc-400 mb-2">
                  Request Body
                </h3>
                <pre className="bg-zinc-900 p-4 rounded-lg text-sm overflow-x-auto">
                  <code className="text-white">
                    {typeof selectedLog.request_body === 'string'
                      ? (() => {
                          try {
                            return JSON.stringify(
                              JSON.parse(selectedLog.request_body),
                              null,
                              2
                            );
                          } catch {
                            return selectedLog.request_body;
                          }
                        })()
                      : JSON.stringify(selectedLog.request_body, null, 2)}
                  </code>
                </pre>
              </div>
            )}

            {selectedLog.response_body && (
              <div className="bg-zinc-800 rounded-lg p-4">
                <h3 className="text-sm font-medium text-zinc-400 mb-2">
                  Response Body
                </h3>
                <pre className="bg-zinc-900 p-4 rounded-lg text-sm overflow-x-auto max-h-60">
                  <code className="text-white">
                    {typeof selectedLog.response_body === 'string'
                      ? (() => {
                          try {
                            return JSON.stringify(
                              JSON.parse(selectedLog.response_body),
                              null,
                              2
                            );
                          } catch {
                            return selectedLog.response_body;
                          }
                        })()
                      : JSON.stringify(selectedLog.response_body, null, 2)}
                  </code>
                </pre>
              </div>
            )}

            {selectedLog.error_message && (
              <div className="bg-zinc-800 rounded-lg p-4">
                <h3 className="text-sm font-medium text-zinc-400 mb-2">
                  Error Message
                </h3>
                <p className="text-red-400 p-4 bg-red-900/20 rounded-lg border-2 border-red-500/20">
                  {selectedLog.error_message}
                </p>
              </div>
            )}
          </div>
        )}
      </AdminModal>
    </AdminLayout>
  );
}
