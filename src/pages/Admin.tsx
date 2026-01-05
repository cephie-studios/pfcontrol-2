import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Activity,
  Database,
  TrendingUp,
  LayoutDashboard,
  Settings,
  Save,
  RefreshCw,
  Menu,
  Gift,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import AdminSidebar from '../components/admin/AdminSidebar';
import Loader from '../components/common/Loader';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  BarElement,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useAuth } from '../hooks/auth/useAuth';
import {
  fetchAdminStatistics,
  fetchAppVersion,
  updateAppVersion,
  fetchApiLogStats24h,
  type AdminStats,
  type DailyStats,
  type AppVersion,
} from '../utils/fetch/admin';
import Toast from '../components/common/Toast';
import Button from '../components/common/Button';
import ErrorScreen from '../components/common/ErrorScreen';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  BarElement
);

export default function Admin() {
  const { user } = useAuth();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);
  const [appVersion, setAppVersion] = useState<AppVersion | null>(null);
  const [newVersion, setNewVersion] = useState('');
  const [isUpdatingVersion, setIsUpdatingVersion] = useState(false);
  const [versionLoading, setVersionLoading] = useState(false);
  const [apiLogStats24h, setApiLogStats24h] = useState<
    Array<{
      hour: string;
      successful: number;
      clientErrors: number;
      serverErrors: number;
      other: number;
    }>
  >([]);

  const hasPermission = (permission: string) =>
    Boolean(user?.isAdmin || user?.rolePermissions?.[permission]);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await fetchAdminStatistics(timeRange);

      const periodTotals = data.daily.reduce(
        (acc, day) => ({
          total_logins: acc.total_logins + day.logins_count,
          total_sessions: acc.total_sessions + day.new_sessions_count,
          total_flights: acc.total_flights + day.new_flights_count,
          total_users: acc.total_users + day.new_users_count,
        }),
        {
          total_logins: 0,
          total_sessions: 0,
          total_flights: 0,
          total_users: 0,
        }
      );

      setStats({
        ...data,
        periodTotals,
        totals: data.totals,
      });
    } catch (error) {
      console.error('Error fetching admin statistics:', error);
      setError(
        error instanceof Error ? error.message : 'Failed to fetch statistics'
      );
      setToast({
        message: 'Failed to fetch statistics',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  const fetchVersion = useCallback(async () => {
    if (!user?.isAdmin) return;

    try {
      setVersionLoading(true);
      const version = await fetchAppVersion();
      setAppVersion(version);
      setNewVersion(version.version);
    } catch (error) {
      console.error('Error fetching app version:', error);
      setToast({
        message: 'Failed to fetch app version',
        type: 'error',
      });
    } finally {
      setVersionLoading(false);
    }
  }, [user?.isAdmin]);

  useEffect(() => {
    fetchVersion();
  }, [fetchVersion]);

  const fetchApiLogStats24hData = useCallback(async () => {
    try {
      const data = await fetchApiLogStats24h();
      setApiLogStats24h(data);
    } catch (error) {
      console.error('Error fetching API log stats for last 24 hours:', error);
      setToast({
        message: 'Failed to fetch API log stats for last 24 hours',
        type: 'error',
      });
    }
  }, []);

  const handleUpdateVersion = async () => {
    if (!newVersion.trim() || !user?.isAdmin) return;

    const versionRegex = /^\d+\.\d+\.\d+(\.\d+)?$/;
    if (!versionRegex.test(newVersion.trim())) {
      setToast({
        message: 'Please enter a valid version format (e.g., 2.0.0.4)',
        type: 'error',
      });
      return;
    }

    try {
      setIsUpdatingVersion(true);
      const updatedVersion = await updateAppVersion(newVersion.trim());
      setAppVersion(updatedVersion);
      setToast({
        message: 'App version updated successfully',
        type: 'success',
      });
    } catch (error) {
      console.error('Error updating app version:', error);
      setToast({
        message:
          error instanceof Error
            ? error.message
            : 'Failed to update app version',
        type: 'error',
      });
    } finally {
      setIsUpdatingVersion(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchApiLogStats24hData();
  }, [fetchApiLogStats24hData]);

  const formatLoginsData = (daily: DailyStats[]) => {
    const labels = daily.map((item) =>
      new Date(item.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    );

    return {
      labels,
      datasets: [
        {
          label: 'Logins',
          data: daily.map((item) => item.logins_count),
          borderColor: '#3B82F6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#3B82F6',
          pointBorderColor: '#1E40AF',
          pointHoverBackgroundColor: '#60A5FA',
          pointHoverBorderColor: '#1E40AF',
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    };
  };

  const formatSessionsData = (daily: DailyStats[]) => {
    const labels = daily.map((item) =>
      new Date(item.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    );

    return {
      labels,
      datasets: [
        {
          label: 'Sessions',
          data: daily.map((item) => item.new_sessions_count),
          borderColor: '#10B981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#10B981',
          pointBorderColor: '#047857',
          pointHoverBackgroundColor: '#34D399',
          pointHoverBorderColor: '#047857',
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    };
  };

  const formatFlightsData = (daily: DailyStats[]) => {
    const labels = daily.map((item) =>
      new Date(item.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    );

    return {
      labels,
      datasets: [
        {
          label: 'Flights',
          data: daily.map((item) => item.new_flights_count),
          borderColor: '#8B5CF6',
          backgroundColor: 'rgba(139, 92, 246, 0.1)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#8B5CF6',
          pointBorderColor: '#7C3AED',
          pointHoverBackgroundColor: '#A78BFA',
          pointHoverBorderColor: '#7C3AED',
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    };
  };

  const formatApiLogStats24hData = (
    stats: Array<{
      hour: string;
      successful: number;
      clientErrors: number;
      serverErrors: number;
      other: number;
    }>
  ) => {
    const labels = stats.map((item) =>
      new Date(item.hour).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })
    );

    return {
      labels,
      datasets: [
        {
          label: 'Successful (2xx)',
          data: stats.map((item) => item.successful),
          borderColor: '#10B981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#10B981',
          pointBorderColor: '#047857',
          pointHoverBackgroundColor: '#34D399',
          pointHoverBorderColor: '#047857',
          pointRadius: 4,
          pointHoverRadius: 6,
        },
        {
          label: 'Client Errors (4xx)',
          data: stats.map((item) => item.clientErrors),
          borderColor: '#F59E0B',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#F59E0B',
          pointBorderColor: '#D97706',
          pointHoverBackgroundColor: '#FCD34D',
          pointHoverBorderColor: '#D97706',
          pointRadius: 4,
          pointHoverRadius: 6,
        },
        {
          label: 'Server Errors (5xx)',
          data: stats.map((item) => item.serverErrors),
          borderColor: '#EF4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#EF4444',
          pointBorderColor: '#DC2626',
          pointHoverBackgroundColor: '#F87171',
          pointHoverBorderColor: '#DC2626',
          pointRadius: 4,
          pointHoverRadius: 6,
        },
        {
          label: 'Other (1xx/3xx)',
          data: stats.map((item) => item.other),
          borderColor: '#6B7280',
          backgroundColor: 'rgba(107, 114, 128, 0.1)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#6B7280',
          pointBorderColor: '#4B5563',
          pointHoverBackgroundColor: '#9CA3AF',
          pointHoverBorderColor: '#4B5563',
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        titleColor: '#F9FAFB',
        bodyColor: '#D1D5DB',
        borderColor: '#374151',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: true,
        mode: 'index' as const,
        intersect: false,
      },
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(55, 65, 81, 0.3)',
          drawBorder: false,
        },
        ticks: {
          color: '#9CA3AF',
          font: {
            size: 11,
          },
        },
      },
      y: {
        grid: {
          color: 'rgba(55, 65, 81, 0.3)',
          drawBorder: false,
        },
        ticks: {
          color: '#9CA3AF',
          font: {
            size: 11,
          },
        },
      },
    },
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    elements: {
      line: {
        borderWidth: 3,
      },
    },
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar mobileSidebarOpen={mobileSidebarOpen} />

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
          <AdminSidebar />
        </div>

        {/* Mobile Sidebar */}
        <div
          className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 lg:hidden ${
            mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <AdminSidebar onToggle={() => setMobileSidebarOpen(false)} />
        </div>

        <div className="flex-1 p-4 sm:p-6 lg:p-8">
          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="lg:hidden fixed bottom-6 right-6 z-30 p-4 bg-blue-600 hover:bg-blue-700 rounded-full shadow-lg transition-colors"
          >
            <Menu className="h-6 w-6 text-white" />
          </button>

          {/* Header */}
          <div className="mb-6 sm:mb-8">
            <div className="flex items-center mb-4">
              <LayoutDashboard className="h-8 w-8 sm:h-10 sm:w-10 text-blue-400 mr-4" />
              <div>
                <h1
                  className="text-3xl sm:text-4xl lg:text-5xl text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-600 font-extrabold mb-2"
                  style={{ lineHeight: 1.2 }}
                >
                  Admin Overview
                </h1>
              </div>
              <div className="flex flex-wrap gap-2 ml-auto">
                {[7, 30, 90].map((days) => (
                  <Button
                    key={days}
                    onClick={() => setTimeRange(days)}
                    variant={timeRange === days ? 'primary' : 'outline'}
                    size="sm"
                  >
                    {days} days
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader />
            </div>
          ) : error ? (
            <ErrorScreen
              title="Error loading statistics"
              message={error}
              onRetry={fetchStats}
            />
          ) : stats ? (
            <>
              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
                <div className="bg-zinc-900 border-2 border-zinc-700/50 rounded-2xl p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <div className="p-2 sm:p-3 bg-blue-500/20 rounded-xl">
                      <Users className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
                    </div>
                    <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-white mb-1">
                    {stats.totals?.total_users?.toLocaleString() || '0'}
                  </h3>
                  <p className="text-zinc-400 text-xs sm:text-sm">
                    Total Users
                  </p>
                </div>

                <div className="bg-zinc-900 border-2 border-zinc-700/50 rounded-2xl p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <div className="p-2 sm:p-3 bg-green-500/20 rounded-xl">
                      <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-green-400" />
                    </div>
                    <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-white mb-1">
                    {stats.totals?.total_sessions?.toLocaleString() || '0'}
                  </h3>
                  <p className="text-zinc-400 text-xs sm:text-sm">
                    Total Sessions
                  </p>
                </div>

                <div className="bg-zinc-900 border-2 border-zinc-700/50 rounded-2xl p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <div className="p-2 sm:p-3 bg-purple-500/20 rounded-xl">
                      <Database className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
                    </div>
                    <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-white mb-1">
                    {stats.totals?.total_flights?.toLocaleString() || '0'}
                  </h3>
                  <p className="text-zinc-400 text-xs sm:text-sm">
                    Total Flights
                  </p>
                </div>

                <div className="bg-zinc-900 border-2 border-zinc-700/50 rounded-2xl p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <div className="p-2 sm:p-3 bg-orange-500/20 rounded-xl">
                      <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-orange-400" />
                    </div>
                    <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-white mb-1">
                    {stats.totals?.total_logins?.toLocaleString() || '0'}
                  </h3>
                  <p className="text-zinc-400 text-xs sm:text-sm">
                    Total Logins
                  </p>
                </div>
              </div>

              {/* Charts */}
              <div className="space-y-6 sm:space-y-8">
                <div className="bg-zinc-900 border-2 border-zinc-700/50 rounded-2xl p-4 sm:p-6">
                  <h3 className="text-lg sm:text-xl font-semibold text-white mb-4 sm:mb-6">
                    Flights
                  </h3>
                  <div className="h-64 sm:h-80">
                    <Line
                      data={formatFlightsData(stats.daily)}
                      options={chartOptions}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
                  <div className="bg-zinc-900 border-2 border-zinc-700/50 rounded-2xl p-4 sm:p-6">
                    <h3 className="text-lg sm:text-xl font-semibold text-white mb-4 sm:mb-6">
                      Sessions
                    </h3>
                    <div className="h-64 sm:h-80">
                      <Line
                        data={formatSessionsData(stats.daily)}
                        options={chartOptions}
                      />
                    </div>
                  </div>

                  <div className="bg-zinc-900 border-2 border-zinc-700/50 rounded-2xl p-4 sm:p-6">
                    <h3 className="text-lg sm:text-xl font-semibold text-white mb-4 sm:mb-6">
                      Logins
                    </h3>
                    <div className="h-64 sm:h-80">
                      <Line
                        data={formatLoginsData(stats.daily)}
                        options={chartOptions}
                      />
                    </div>
                  </div>
                </div>

                {hasPermission('audit') && (
                  <div className="bg-zinc-900 border-2 border-zinc-700/50 rounded-2xl p-4 sm:p-6">
                    <h3 className="text-lg sm:text-xl font-semibold text-white mb-4 sm:mb-6">
                      API Calls
                    </h3>
                    <div className="h-64 sm:h-80">
                      <Line
                        data={formatApiLogStats24hData(apiLogStats24h)}
                        options={chartOptions}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Developer Controls */}
              {user?.isAdmin && (
                <div className="mt-6 sm:mt-8">
                  <div className="bg-zinc-900 border-2 border-zinc-700/50 rounded-2xl p-4 sm:p-6">
                    <div className="flex items-center mb-3 sm:mb-4">
                      <div className="p-2 bg-blue-500/20 rounded-lg mr-3">
                        <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
                      </div>
                      <h2 className="text-lg sm:text-xl font-semibold text-white">
                        Application Settings
                      </h2>
                    </div>

                    {/* Version Management */}
                    <div className="bg-zinc-900 rounded-lg p-3 sm:p-4 border-2 border-zinc-700/50">
                      <div className="flex items-start justify-between mb-3 sm:mb-4 gap-2">
                        <div className="flex-1">
                          <h3 className="text-base sm:text-lg font-medium text-white mb-1">
                            App Version
                          </h3>
                          <p className="text-xs sm:text-sm text-zinc-400">
                            Manage the application version displayed in the
                            footer
                          </p>
                        </div>
                        <Button
                          onClick={fetchVersion}
                          variant="ghost"
                          size="sm"
                          disabled={versionLoading}
                          className="p-2 flex-shrink-0"
                        >
                          <RefreshCw
                            className={`w-4 h-4 ${
                              versionLoading ? 'animate-spin' : ''
                            }`}
                          />
                        </Button>
                      </div>

                      {versionLoading ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader />
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {appVersion && (
                            <div className="bg-zinc-800/50 rounded-lg p-3">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-zinc-400">
                                  Current Version:
                                </span>
                                <span className="text-white font-medium">
                                  {appVersion.version}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-sm mt-1">
                                <span className="text-zinc-400">
                                  Last Updated:
                                </span>
                                <span className="text-zinc-500">
                                  {new Date(
                                    appVersion.updated_at
                                  ).toLocaleString()}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-sm mt-1">
                                <span className="text-zinc-400">
                                  Updated By:
                                </span>
                                <span className="text-zinc-500">
                                  {appVersion.updated_by}
                                </span>
                              </div>
                            </div>
                          )}

                          <div className="space-y-3 sm:space-y-0 flex flex-col sm:flex-row sm:space-x-4">
                            <div className="flex-1">
                              <input
                                type="text"
                                value={newVersion}
                                onChange={(e) => setNewVersion(e.target.value)}
                                placeholder="e.g., 2.0.0.4"
                                className="w-full px-3 py-2 text-sm sm:text-base bg-zinc-700 border-2 border-zinc-600 rounded-full text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              />
                            </div>
                            <button
                              onClick={handleUpdateVersion}
                              disabled={
                                !newVersion.trim() ||
                                isUpdatingVersion ||
                                newVersion === appVersion?.version
                              }
                              className="flex items-center justify-center space-x-2 w-full sm:w-auto text-blue-600 border-2 border-blue-600 p-2 px-4 rounded-full hover:bg-blue-600 hover:text-white transition-colors"
                            >
                              {isUpdatingVersion ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                              ) : (
                                <Save className="w-4 h-4" />
                              )}
                              <span>Update</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-zinc-400">
              No statistics available
            </div>
          )}
        </div>
      </div>

      {/* Toast Notification */}
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
