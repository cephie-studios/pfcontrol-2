import { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Search,
  Eye,
  Trash2,
  Ban,
  ExternalLink,
  X,
  RefreshCw,
  Menu,
  TicketCheck,
} from 'lucide-react';
import Navbar from '../../components/Navbar';
import AdminSidebar from '../../components/admin/AdminSidebar';
import Loader from '../../components/common/Loader';
import Button from '../../components/common/Button';
import Dropdown from '../../components/common/Dropdown';
import {
  fetchChatReports,
  updateChatReportStatus,
  deleteChatReport,
  type ChatReport,
} from '../../utils/fetch/admin';
import Toast from '../../components/common/Toast';
import ErrorScreen from '../../components/common/ErrorScreen';

export default function AdminChatReports() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [reports, setReports] = useState<ChatReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [filterReporter, setFilterReporter] = useState<string>('all');
  const [selectedReport, setSelectedReport] = useState<ChatReport | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  const filterOptions = [
    { value: 'all', label: 'All Reports' },
    { value: 'automod', label: 'Automod Only' },
    { value: 'user', label: 'User Reports Only' },
  ];

  useEffect(() => {
    fetchReports();
  }, [page, filterReporter]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchChatReports(
        page,
        limit,
        filterReporter === 'all' ? undefined : filterReporter
      );
      setReports(data.reports);
      setTotalPages(data.pagination.pages);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch reports';
      setError(errorMessage);
      setToast({ message: errorMessage, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleViewReport = (report: ChatReport) => {
    setSelectedReport(report);
    setShowModal(true);
  };

  const handleDismissReport = async (reportId: number) => {
    if (!confirm('Are you sure you want to dismiss this report?')) return;
    try {
      await deleteChatReport(reportId);
      setToast({ message: 'Report dismissed', type: 'success' });
      fetchReports();
    } catch (err) {
      setToast({ message: 'Failed to dismiss report', type: 'error' });
    }
  };

  const handleMarkResolved = async (reportId: number) => {
    try {
      await updateChatReportStatus(reportId, 'resolved');
      setToast({ message: 'Report marked as resolved', type: 'success' });
      fetchReports();
    } catch (err) {
      setToast({ message: 'Failed to update report', type: 'error' });
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <>
      <div className="min-h-screen bg-black text-white">
        <Navbar />
        <div className="flex pt-16">
          {/* Mobile Overlay */}
          {mobileSidebarOpen && (
            <div
              className="fixed inset-0 bg-black/60 z-40 lg:hidden"
              onClick={() => setMobileSidebarOpen(false)}
            />
          )}

          {/* Desktop Sidebar */}
          <div className="hidden lg:block">
            <AdminSidebar
              collapsed={sidebarCollapsed}
              onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
            />
          </div>

          {/* Mobile Sidebar */}
          <div
            className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 lg:hidden ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
          >
            <AdminSidebar
              collapsed={false}
              onToggle={() => setMobileSidebarOpen(false)}
            />
          </div>

          <div className="flex-1 p-4 sm:p-6 lg:p-8">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden fixed bottom-6 right-6 z-30 p-4 bg-red-600 hover:bg-red-700 rounded-full shadow-lg transition-colors"
            >
              <Menu className="h-6 w-6 text-white" />
            </button>

            {/* Header */}
            <div className="mb-6 sm:mb-8">
              <div className="flex items-center mb-4">
                <ShieldAlert className="h-8 w-8 sm:h-10 sm:w-10 text-red-400 mr-4 mb-1" />
                <div>
                  <h1
                    className="text-3xl sm:text-4xl lg:text-5xl text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-red-600 font-extrabold mb-2"
                    style={{ lineHeight: 1.2 }}
                  >
                    Chat Reports
                  </h1>
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <div className="flex-1 relative group">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Search by message or user..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-zinc-900/50 border-2 border-zinc-700 rounded-full text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500"
                  />
                </div>
                <Dropdown
                  options={filterOptions}
                  value={filterReporter}
                  onChange={setFilterReporter}
                  placeholder="Filter by reporter..."
                />
                <Button
                  onClick={fetchReports}
                  variant="outline"
                  className="px-4 py-3"
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Content */}
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader />
              </div>
            ) : error ? (
              <ErrorScreen
                title="Error loading reports"
                message={error}
                onRetry={fetchReports}
              />
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden lg:block bg-zinc-900 border-2 border-zinc-700/50 rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[800px]">
                      <thead className="bg-zinc-800">
                        <tr>
                          <th className="px-6 py-4 text-left text-zinc-400 font-medium">
                            Reporter
                          </th>
                          <th className="px-6 py-4 text-left text-zinc-400 font-medium">
                            Reported User
                          </th>
                          <th className="px-6 py-4 text-left text-zinc-400 font-medium">
                            Message
                          </th>
                          <th className="px-6 py-4 text-left text-zinc-400 font-medium">
                            Reason
                          </th>
                          <th className="px-6 py-4 text-left text-zinc-400 font-medium">
                            Status
                          </th>
                          <th className="px-6 py-4 text-left text-zinc-400 font-medium">
                            Timestamp
                          </th>
                          <th className="px-6 py-4 text-left text-zinc-400 font-medium">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {reports
                          .filter(
                            (r) =>
                              !search ||
                              r.message
                                .toLowerCase()
                                .includes(search.toLowerCase()) ||
                              r.reported_user_id.includes(search)
                          )
                          .map((report) => (
                            <tr
                              key={report.id}
                              className="border-t border-zinc-700/50 hover:bg-zinc-800/50"
                            >
                              <td className="px-6 py-4 text-zinc-300">
                                <div className="flex items-center space-x-2">
                                  <img
                                    src={
                                      report.avatar ||
                                      '/assets/app/default/avatar.webp'
                                    }
                                    alt={
                                      report.reporter_user_id === 'automod'
                                        ? 'Automod'
                                        : report.reporter_username ||
                                          report.reporter_user_id
                                    }
                                    className="w-8 h-8 rounded-full"
                                  />
                                  <div className="flex flex-col">
                                    <span className="text-white font-medium">
                                      {report.reporter_user_id === 'automod'
                                        ? 'Automod'
                                        : report.reporter_username || 'Unknown'}
                                    </span>
                                    {report.reporter_user_id !== 'automod' && (
                                      <span className="text-zinc-400 text-xs">
                                        {report.reporter_user_id}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-zinc-300">
                                <div className="flex items-center space-x-2">
                                  <img
                                    src={
                                      report.reported_avatar ||
                                      '/assets/app/default/avatar.webp'
                                    }
                                    alt={
                                      report.reported_username ||
                                      report.reported_user_id
                                    }
                                    className="w-8 h-8 rounded-full"
                                  />
                                  <div className="flex flex-col">
                                    <span className="text-white font-medium">
                                      {report.reported_username || 'Unknown'}
                                    </span>
                                    <span className="text-zinc-400 text-xs">
                                      {report.reported_user_id}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-zinc-300 truncate max-w-xs">
                                {report.message}
                              </td>
                              <td className="px-6 py-4 text-zinc-300">
                                {report.reason}
                              </td>
                              <td className="px-6 py-4">
                                <span
                                  className={`px-2 py-1 rounded-full text-xs ${report.status === 'resolved' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}
                                >
                                  {report.status || 'pending'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-zinc-300">
                                {formatTimestamp(report.timestamp)}
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center space-x-3">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleViewReport(report)}
                                  >
                                    <Eye className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="success"
                                    onClick={() =>
                                      handleMarkResolved(report.id)
                                    }
                                  >
                                    <TicketCheck className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="danger"
                                    onClick={() =>
                                      handleDismissReport(report.id)
                                    }
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Mobile Card View */}
                <div className="lg:hidden space-y-4">
                  {reports
                    .filter(
                      (r) =>
                        !search ||
                        r.message
                          .toLowerCase()
                          .includes(search.toLowerCase()) ||
                        r.reported_user_id.includes(search)
                    )
                    .map((report) => (
                      <div
                        key={report.id}
                        className="bg-zinc-900 border-2 border-zinc-700/50 rounded-2xl p-4"
                      >
                        <div className="space-y-3">
                          {/* Reporter */}
                          <div className="flex items-center space-x-2">
                            <img
                              src={
                                report.avatar ||
                                '/assets/app/default/avatar.webp'
                              }
                              alt={
                                report.reporter_user_id === 'automod'
                                  ? 'Automod'
                                  : report.reporter_username ||
                                    report.reporter_user_id
                              }
                              className="w-8 h-8 rounded-full"
                            />
                            <div>
                              <p className="text-white font-medium">
                                {report.reporter_user_id === 'automod'
                                  ? 'Automod'
                                  : report.reporter_username || 'Unknown'}
                              </p>
                              {report.reporter_user_id !== 'automod' && (
                                <p className="text-zinc-400 text-xs">
                                  {report.reporter_user_id}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Reported User */}
                          <div className="flex items-center space-x-2">
                            <img
                              src={
                                report.reported_avatar ||
                                '/assets/app/default/avatar.webp'
                              }
                              alt={
                                report.reported_username ||
                                report.reported_user_id
                              }
                              className="w-8 h-8 rounded-full"
                            />
                            <div>
                              <p className="text-white font-medium">
                                {report.reported_username || 'Unknown'}
                              </p>
                              <p className="text-zinc-400 text-xs">
                                {report.reported_user_id}
                              </p>
                            </div>
                          </div>

                          {/* Message */}
                          <p className="text-zinc-300">
                            <strong>Message:</strong> {report.message}
                          </p>

                          {/* Reason */}
                          <p className="text-zinc-300">
                            <strong>Reason:</strong> {report.reason}
                          </p>

                          {/* Status and Timestamp */}
                          <div className="flex justify-between items-center">
                            <span
                              className={`px-2 py-1 rounded-full text-xs ${
                                report.status === 'resolved'
                                  ? 'bg-green-500/20 text-green-400'
                                  : 'bg-yellow-500/20 text-yellow-400'
                              }`}
                            >
                              {report.status || 'pending'}
                            </span>
                            <p className="text-zinc-400 text-xs">
                              {formatTimestamp(report.timestamp)}
                            </p>
                          </div>

                          {/* Actions */}
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleViewReport(report)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="success"
                              onClick={() => handleMarkResolved(report.id)}
                            >
                              <TicketCheck className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => handleDismissReport(report.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>

                {/* Pagination - Keep this for both views */}
                <div className="flex justify-center mt-8 space-x-2">
                  <Button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    variant="outline"
                  >
                    Previous
                  </Button>
                  <span className="text-zinc-400 justify-center flex items-center px-2">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                    variant="outline"
                  >
                    Next
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Details Modal */}
        {showModal && selectedReport && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-zinc-900 border-2 border-zinc-700 rounded-2xl p-6 max-w-2xl w-full mx-4">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Report Details</h2>
                <Button variant="ghost" onClick={() => setShowModal(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <img
                    src={
                      selectedReport.avatar || '/assets/app/default/avatar.webp'
                    }
                    alt={
                      selectedReport.reporter_user_id === 'automod'
                        ? 'Automod'
                        : selectedReport.reporter_username ||
                          selectedReport.reporter_user_id
                    }
                    className="w-10 h-10 rounded-full"
                  />
                  <p>
                    <strong>Reporter:</strong>{' '}
                    {selectedReport.reporter_user_id === 'automod'
                      ? 'Automod'
                      : `${selectedReport.reporter_username || 'Unknown'} (${selectedReport.reporter_user_id})`}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <img
                    src={
                      selectedReport.reported_avatar ||
                      '/assets/app/default/avatar.webp'
                    }
                    alt={
                      selectedReport.reported_username ||
                      selectedReport.reported_user_id
                    }
                    className="w-10 h-10 rounded-full"
                  />
                  <p>
                    <strong>Reported User:</strong>{' '}
                    {selectedReport.reported_username || 'Unknown'} (
                    {selectedReport.reported_user_id})
                  </p>
                </div>
                <p>
                  <strong>Message:</strong> {selectedReport.message}
                </p>
                <p>
                  <strong>Reason:</strong> {selectedReport.reason}
                </p>
                <p>
                  <strong>Session:</strong>{' '}
                  <a
                    href={`/admin/sessions?search=${selectedReport.session_id}`}
                    className="text-blue-400"
                  >
                    {selectedReport.session_id}{' '}
                    <ExternalLink className="inline w-4 h-4" />
                  </a>
                </p>
                <p>
                  <strong>Timestamp:</strong>{' '}
                  {formatTimestamp(selectedReport.timestamp)}
                </p>
                <div className="flex space-x-2">
                  <Button
                    onClick={() => {
                      setShowModal(false);
                      window.location.href = `/admin/bans?userId=${selectedReport.reported_user_id}&username=${encodeURIComponent(selectedReport.reported_username || '')}&reason=${encodeURIComponent(selectedReport.reason)}`;
                    }}
                    variant="danger"
                  >
                    <Ban className="w-4 h-4 mr-2" /> Ban User
                  </Button>
                  <Button
                    onClick={() => handleMarkResolved(selectedReport.id)}
                    variant="primary"
                  >
                    Mark Resolved
                  </Button>
                </div>
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
      </div>
    </>
  );
}
