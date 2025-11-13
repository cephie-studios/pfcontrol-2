import { useState, useEffect } from 'react';
import {
  Plane,
  Filter,
  Calendar,
  User,
  Eye,
  EyeOff,
  Clock,
  Menu,
  Database,
  X,
  NotebookPen,
  Search,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import AdminSidebar from '../../components/admin/AdminSidebar';
import Loader from '../../components/common/Loader';
import Dropdown from '../../components/common/Dropdown';
import {
  fetchFlightLogs,
  revealFlightLogIP,
  type FlightLogsResponse,
  type FlightLog,
} from '../../utils/fetch/admin';
import Button from '../../components/common/Button';
import Toast from '../../components/common/Toast';
import ErrorScreen from '../../components/common/ErrorScreen';

export default function AdminFlightLogs() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
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

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDateFilter(e.target.value);
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

  const formatActionType = (action: string) => {
    switch (action) {
      case 'add':
        return 'Add Flight';
      case 'update':
        return 'Update Flight';
      case 'delete':
        return 'Delete Flight';
      default:
        return action;
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'add':
        return <Plane className="w-4 h-4 text-green-400" />;
      case 'update':
        return <Database className="w-4 h-4 text-blue-400" />;
      case 'delete':
        return <EyeOff className="w-4 h-4 text-red-400" />;
      default:
        return <Plane className="w-4 h-4 text-zinc-400" />;
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
    if (log.action !== 'update' || !log.old_data || !log.new_data) return 'N/A';
    const oldData = log.old_data as Record<string, unknown>;
    const newData = log.new_data as Record<string, unknown>;
    const changedFields = Object.keys(newData).filter(
      (key) => oldData[key] !== newData[key]
    );
    if (changedFields.length === 0) return 'N/A';
    const primaryField = changedFields[0];
    return `${primaryField}: ${String(newData[primaryField])}`;
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

  return (
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
        <div className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mb-6 sm:mb-8">
            <div className="flex items-center mb-4">
              <div className="p-2 sm:p-3 bg-purple-500/20 rounded-xl mr-3 sm:mr-4">
                <NotebookPen className="h-6 w-6 sm:h-8 sm:w-8 text-purple-400" />
              </div>
              <h1
                className="text-3xl sm:text-4xl lg:text-5xl text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-rose-600 font-extrabold mb-2"
                style={{ lineHeight: 1.4 }}
              >
                Flight Audit Logs
              </h1>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* General Search */}
                <div className="relative md:col-span-2 lg:col-span-3">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Search users, sessions, flight IDs, or any data..."
                    value={generalSearch}
                    onChange={(e) => setGeneralSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-zinc-900 border-2 border-zinc-700 rounded-full text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                {/* User Filter */}
                <div className="relative">
                  <User className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Filter by username..."
                    value={userFilter}
                    onChange={(e) => setUserFilter(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-zinc-900 border-2 border-zinc-700 rounded-full text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                {/* Session Filter */}
                <div className="relative">
                  <Database className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Filter by session ID..."
                    value={sessionFilter}
                    onChange={(e) => setSessionFilter(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-zinc-900 border-2 border-zinc-700 rounded-full text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                {/* Flight ID Filter */}
                <div className="relative">
                  <Plane className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Filter by flight ID..."
                    value={flightIdFilter}
                    onChange={(e) => setFlightIdFilter(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-zinc-900 border-2 border-zinc-700 rounded-full text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                {/* Text Search Filter */}
                <div className="relative">
                  <NotebookPen className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Search in flight data..."
                    value={textFilter}
                    onChange={(e) => setTextFilter(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-zinc-900 border-2 border-zinc-700 rounded-full text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                {/* Single Date Filter */}
                <div>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input
                      type="date"
                      value={dateFilter}
                      onChange={handleDateChange}
                      className="w-full pl-10 pr-4 py-2 bg-zinc-900 border-2 border-zinc-700 rounded-full text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
                {/* Action Filter + Clear Button */}
                <div className="flex items-end space-x-2">
                  <div className="relative flex-1">
                    <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400 z-10 ml-3" />
                    <Dropdown
                      options={actionTypeOptions}
                      value={actionFilter}
                      onChange={(value) => setActionFilter(value)}
                      placeholder="Filter by action..."
                      className="pl-10 h-11"
                    />
                  </div>
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
              <div className="bg-zinc-900 border-2 border-zinc-700/50 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1000px]">
                    <thead className="bg-zinc-800">
                      <tr>
                        <th className="px-6 py-4 text-left text-zinc-400 font-medium">
                          Action
                        </th>
                        <th className="px-6 py-4 text-left text-zinc-400 font-medium">
                          User
                        </th>
                        <th className="px-6 py-4 text-left text-zinc-400 font-medium">
                          Session
                        </th>
                        <th className="px-6 py-4 text-left text-zinc-400 font-medium">
                          Flight ID
                        </th>
                        <th className="px-6 py-4 text-left text-zinc-400 font-medium">
                          Timestamp
                        </th>
                        <th className="px-6 py-4 text-left text-zinc-400 font-medium">
                          IP Address
                        </th>
                        <th className="px-6 py-4 text-left text-zinc-400 font-medium">
                          Updated Field
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
                              {getActionIcon(log.action)}
                              <div className="flex flex-col">
                                <span className="text-white font-medium">
                                  {formatActionType(log.action)}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-zinc-300">
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {log.username || `Unknown (${log.user_id})`}
                              </span>
                              <span className="text-xs text-zinc-500">
                                {log.user_id}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-zinc-300">
                            <Link
                              to={`/admin/sessions?search=${log.session_id}`}
                              className="text-purple-400 hover:text-purple-300 underline"
                            >
                              {log.session_id}
                            </Link>
                          </td>
                          <td className="px-6 py-4 text-zinc-300">
                            {log.flight_id}
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
                          <td className="px-6 py-4 text-zinc-300">
                            {getUpdatedField(log)}
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
              {filteredLogs.length === 0 && (
                <div className="text-center py-12 text-zinc-400">
                  {logs.length > 0
                    ? 'No flight logs found. All logs are filtered out.'
                    : 'No flight logs found with the current filters.'}
                </div>
              )}
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
          {showDetails && selectedLog && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    {getActionIcon(selectedLog.action)}
                    <h2 className="text-xl font-bold text-white">
                      Flight Log Details
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
                        {formatDate(selectedLog.timestamp)}
                      </p>
                    </div>
                    <div className="bg-zinc-800 rounded-lg p-4">
                      <h3 className="text-sm font-medium text-zinc-400 mb-2">
                        User
                      </h3>
                      <p className="text-white">
                        {selectedLog.username ||
                          `Unknown (${selectedLog.user_id})`}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {selectedLog.user_id}
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
                  <div className="bg-zinc-800 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-zinc-400 mb-2">
                      Old Data
                    </h3>
                    <pre className="text-sm text-zinc-300 whitespace-pre-wrap">
                      {selectedLog.old_data
                        ? JSON.stringify(selectedLog.old_data, null, 2)
                        : 'N/A'}
                    </pre>
                  </div>
                  <div className="bg-zinc-800 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-zinc-400 mb-2">
                      New Data
                    </h3>
                    <pre className="text-sm text-zinc-300 whitespace-pre-wrap">
                      {selectedLog.new_data
                        ? JSON.stringify(selectedLog.new_data, null, 2)
                        : 'N/A'}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <button
        onClick={() => setMobileSidebarOpen(true)}
        className="lg:hidden fixed bottom-6 right-6 z-30 p-4 bg-purple-600 hover:bg-purple-700 rounded-full shadow-lg transition-colors"
      >
        <Menu className="h-6 w-6 text-white" />
      </button>
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
