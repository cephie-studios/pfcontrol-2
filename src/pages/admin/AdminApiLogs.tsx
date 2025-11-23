import { useState, useEffect } from 'react';
import {
  HeartPulse,
  Eye,
  Clock,
  Menu,
  Search,
  Server,
  AlertCircle,
  TrendingUp,
  X,
} from 'lucide-react';
import Navbar from '../../components/Navbar';
import AdminSidebar from '../../components/admin/AdminSidebar';
import Dropdown from '../../components/common/Dropdown';
import Button from '../../components/common/Button';
import Toast from '../../components/common/Toast';
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
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
    <>
      <div className="min-h-screen bg-black text-white">
        <Navbar />
        <div className="flex pt-16">
          {mobileSidebarOpen && (
            <div
              className="fixed inset-0 bg-black/60 z-40 lg:hidden"
              onClick={() => setMobileSidebarOpen(false)}
            />
          )}

          <div className="hidden lg:block">
            <AdminSidebar
              collapsed={sidebarCollapsed}
              onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
            />
          </div>

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

          {/* Main Content */}
          <main className="flex-1 min-w-0 px-2 py-4 sm:px-4 sm:py-6 lg:px-8 lg:py-8">
            <div className="max-w-full">
              <div className="mb-6 sm:mb-8">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                  <div className="flex items-center min-w-0 flex-1">
                    <HeartPulse className="h-8 w-8 sm:h-10 sm:w-10 text-blue-400 mr-4 mb-1" />
                    <div>
                      <h1
                        className="text-3xl sm:text-4xl lg:text-5xl text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-600 font-extrabold mb-2"
                        style={{ lineHeight: 1.4 }}
                      >
                        API Logs
                      </h1>
                    </div>
                  </div>
                </div>

                {/* Stats Cards */}
                {stats && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="bg-zinc-900 border-2 border-zinc-700/50 rounded-2xl p-4 sm:p-6">
                      <div className="flex items-center justify-between mb-3 sm:mb-4">
                        <div className="p-2 sm:p-3 bg-blue-500/20 rounded-xl">
                          <Server className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
                        </div>
                        <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
                      </div>
                      <h3 className="text-xl sm:text-2xl font-bold text-white mb-1">
                        {stats.totalRequests.toLocaleString()}
                      </h3>
                      <p className="text-zinc-400 text-xs sm:text-sm">
                        Total Requests
                      </p>
                    </div>
                    <div className="bg-zinc-900 border-2 border-zinc-700/50 rounded-2xl p-4 sm:p-6">
                      <div className="flex items-center justify-between mb-3 sm:mb-4">
                        <div className="p-2 sm:p-3 bg-green-500/20 rounded-xl">
                          <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-green-400" />
                        </div>
                        <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />
                      </div>
                      <h3 className="text-xl sm:text-2xl font-bold text-white mb-1">
                        {stats.averageResponseTime}ms
                      </h3>
                      <p className="text-zinc-400 text-xs sm:text-sm">
                        Avg Response Time
                      </p>
                    </div>
                    <div className="bg-zinc-900 border-2 border-zinc-700/50 rounded-2xl p-4 sm:p-6">
                      <div className="flex items-center justify-between mb-3 sm:mb-4">
                        <div className="p-2 sm:p-3 bg-red-500/20 rounded-xl">
                          <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 text-red-400" />
                        </div>
                        <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
                      </div>
                      <h3 className="text-xl sm:text-2xl font-bold text-white mb-1">
                        {stats.errorRate.toFixed(1)}%
                      </h3>
                      <p className="text-zinc-400 text-xs sm:text-sm">
                        Error Rate
                      </p>
                    </div>
                    <div className="bg-zinc-900 border-2 border-zinc-700/50 rounded-2xl p-4 sm:p-6">
                      <div className="flex items-center justify-between mb-3 sm:mb-4">
                        <div className="p-2 sm:p-3 bg-yellow-500/20 rounded-xl">
                          <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-400" />
                        </div>
                        <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />
                      </div>
                      <h3 className="text-lg sm:text-xl font-bold text-white mb-1 truncate">
                        {stats.topEndpoints[0]?.path.split('?')[0] || 'N/A'}
                      </h3>
                      <p className="text-zinc-400 text-xs sm:text-sm">
                        Top Endpoint
                      </p>
                    </div>
                  </div>
                )}

                {/* Filters */}
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Search Filter */}
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
                      <input
                        type="text"
                        placeholder="Search logs..."
                        value={searchFilter}
                        onChange={(e) => setSearchFilter(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-zinc-900 border-2 border-zinc-700 rounded-full text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    {/* User Filter */}
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Filter by user..."
                        value={userFilter}
                        onChange={(e) => setUserFilter(e.target.value)}
                        className="w-full px-4 py-2 bg-zinc-900 border-2 border-zinc-700 rounded-full text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    {/* Method Filter */}
                    <div>
                      <Dropdown
                        options={methodOptions}
                        value={methodFilter}
                        onChange={setMethodFilter}
                        placeholder="Filter by method"
                        className="h-11"
                      />
                    </div>
                    {/* Path Filter */}
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Filter by path..."
                        value={pathFilter}
                        onChange={(e) => setPathFilter(e.target.value)}
                        className="w-full px-4 py-2 bg-zinc-900 border-2 border-zinc-700 rounded-full text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Status Code Filter */}
                    <div>
                      <Dropdown
                        options={statusCodeOptions}
                        value={statusCodeFilter}
                        onChange={setStatusCodeFilter}
                        placeholder="Filter by status"
                        className="h-11"
                      />
                    </div>
                    {/* Date From Filter */}
                    <div className="relative">
                      <input
                        type="date"
                        value={dateFromFilter}
                        onChange={(e) => setDateFromFilter(e.target.value)}
                        className="w-full px-4 py-2 bg-zinc-900 border-2 border-zinc-700 rounded-full text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    {/* Date To Filter */}
                    <div className="relative">
                      <input
                        type="date"
                        value={dateToFilter}
                        onChange={(e) => setDateToFilter(e.target.value)}
                        className="w-full px-4 py-2 bg-zinc-900 border-2 border-zinc-700 rounded-full text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    {/* Clear Filters Button */}
                    <Button
                      onClick={clearFilters}
                      variant="outline"
                      size="sm"
                      className="p-2 h-11 flex items-center justify-center pr-2"
                    >
                      <span className="pr-1">Clear filters</span>
                      <X className="w-6 h-6" />
                    </Button>
                  </div>
                </div>
              </div>

              {error ? (
                <ErrorScreen
                  title="Error loading API logs"
                  message={error}
                  onRetry={fetchLogs}
                />
              ) : (
                <>
                  {/* Desktop Table */}
                  <div className="hidden lg:block bg-zinc-900 border-2 border-zinc-700/50 rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[1000px]">
                        <thead className="bg-zinc-800">
                          <tr>
                            <th className="px-6 py-4 text-left text-zinc-400 font-medium">
                              Timestamp
                            </th>
                            <th className="px-6 py-4 text-left text-zinc-400 font-medium">
                              Method
                            </th>
                            <th className="px-6 py-4 text-left text-zinc-400 font-medium">
                              Path
                            </th>
                            <th className="px-6 py-4 text-left text-zinc-400 font-medium">
                              Status
                            </th>
                            <th className="px-6 py-4 text-left text-zinc-400 font-medium">
                              Response Time
                            </th>
                            <th className="px-6 py-4 text-left text-zinc-400 font-medium">
                              User
                            </th>
                            <th className="px-6 py-4 text-left text-zinc-400 font-medium">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {logs.map((log) => (
                            <tr
                              key={log.id}
                              className="border-t border-zinc-700/50 hover:bg-zinc-800/50"
                            >
                              <td className="px-6 py-4">
                                <div className="text-sm text-white">
                                  {formatTimeAgo(log.timestamp)}
                                </div>
                                <div className="text-xs text-zinc-500">
                                  {formatDateTime(log.timestamp)}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getMethodColor(log.method)}`}
                                >
                                  {log.method}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <div className="text-sm text-white truncate max-w-xs">
                                  {log.path}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span
                                  className={`text-sm font-medium ${getStatusColor(log.status_code)}`}
                                >
                                  {log.status_code}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <span className="text-sm text-white">
                                  {log.response_time}ms
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <div className="text-sm text-white">
                                  {log.username || 'Unknown'}
                                </div>
                                {log.user_id && (
                                  <div className="text-xs text-zinc-500">
                                    {log.user_id}
                                  </div>
                                )}
                              </td>
                              <td className="px-6 py-4">
                                <Button
                                  onClick={() => handleLogClick(log)}
                                  variant="ghost"
                                  size="sm"
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
                    {logs.map((log) => (
                      <div
                        key={log.id}
                        className="bg-zinc-900 border-2 border-zinc-700/50 rounded-2xl p-4"
                      >
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
                              <strong>Response Time:</strong>{' '}
                              {log.response_time}ms
                            </p>
                            <p>
                              <strong>Time:</strong>{' '}
                              {formatTimeAgo(log.timestamp)}
                            </p>
                          </div>

                          <Button
                            onClick={() => handleLogClick(log)}
                            variant="ghost"
                            size="sm"
                            className="w-full flex items-center justify-center space-x-2"
                          >
                            <Eye className="w-4 h-4" />
                            <span>View Details</span>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* No Results Message */}
                  {logs.length === 0 && (
                    <div className="text-center py-12 text-zinc-400">
                      {logs.length > 0
                        ? 'No logs found with current page.'
                        : 'No API logs found with the current filters.'}
                    </div>
                  )}

                  {/* Pagination */}
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
            </div>
          </main>
        </div>

        {/* Floating Mobile Menu Button */}
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="lg:hidden fixed bottom-6 right-6 z-30 p-4 bg-blue-600 hover:bg-blue-700 rounded-full shadow-lg transition-colors"
        >
          <Menu className="h-6 w-6 text-white" />
        </button>
      </div>

      {/* Log Details Modal */}
      {showDetails && selectedLog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border-2 border-zinc-700 rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">API Log Details</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDetails(false)}
                className="p-2"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-zinc-800 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-zinc-400 mb-2">
                    Timestamp
                  </h3>
                  <p className="text-white">
                    {formatDateTime(selectedLog.timestamp)}
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
                  <h3 className="text-sm font-medium text-zinc-400 mb-2">
                    Path
                  </h3>
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
                  <h3 className="text-sm font-medium text-zinc-400 mb-2">
                    User
                  </h3>
                  <p className="text-white">
                    {selectedLog.username || 'Unknown'}
                  </p>
                  {selectedLog.user_id && (
                    <p className="text-xs text-zinc-500">
                      {selectedLog.user_id}
                    </p>
                  )}
                </div>
              </div>

              {/* IP Address */}
              {selectedLog.ip_address && (
                <div className="bg-zinc-800 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-zinc-400 mb-2">
                    IP Address
                  </h3>
                  <p className="text-white font-mono">
                    {selectedLog.ip_address}
                  </p>
                </div>
              )}

              {/* User Agent */}
              {selectedLog.user_agent && (
                <div className="bg-zinc-800 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-zinc-400 mb-2">
                    User Agent
                  </h3>
                  <p className="text-white break-all">
                    {selectedLog.user_agent}
                  </p>
                </div>
              )}

              {/* Request Body */}
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

              {/* Response Body */}
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

              {/* Error Message */}
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
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}
