import { useState, useEffect, useCallback } from 'react';
import { Star, Users, Calendar, Menu, ThumbsUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import AdminSidebar from '../../components/admin/AdminSidebar';
import Loader from '../../components/common/Loader';
import Button from '../../components/common/Button';
import { Line } from '../../lib/chartJs';
import {
  fetchControllerRatingStats,
  fetchControllerDailyRatingStats,
  type ControllerRatingStats,
  type DailyRatingStats,
} from '../../utils/fetch/admin';
import Toast from '../../components/common/Toast';
import ErrorScreen from '../../components/common/ErrorScreen';

const getAvatarUrl = (userId: string, avatar: string | null) => {
  if (!avatar) return null;
  return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.png?size=128`;
};

export default function AdminRatings() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [stats, setStats] = useState<ControllerRatingStats | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyRatingStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [statsData, dailyData] = await Promise.all([
        fetchControllerRatingStats(),
        fetchControllerDailyRatingStats(timeRange),
      ]);
      setStats(statsData);
      setDailyStats(dailyData);
    } catch (error) {
      console.error('Error fetching rating statistics:', error);
      setError('Failed to fetch rating statistics');
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const chartData = {
    labels: dailyStats.map((d) =>
      new Date(d.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    ),
    datasets: [
      {
        label: 'Ratings Count',
        data: dailyStats.map((d) => d.count),
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
      {
        label: 'Avg Rating',
        data: dailyStats.map((d) => d.avg_rating),
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
        yAxisID: 'y1',
      },
    ],
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
        beginAtZero: true,
      },
      y1: {
        position: 'right' as const,
        beginAtZero: true,
        max: 5,
        grid: {
          drawOnChartArea: false,
        },
        ticks: {
          color: '#F59E0B',
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
              <ThumbsUp className="h-8 w-8 sm:h-10 sm:w-10 text-blue-400 mr-4" />
              <div>
                <h1
                  className="text-3xl sm:text-4xl lg:text-5xl text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-600 font-extrabold mb-2"
                  style={{ lineHeight: 1.2 }}
                >
                  Controller Ratings
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
              onRetry={fetchData}
            />
          ) : stats ? (
            <>
              {/* Daily Graph */}
              <div className="bg-zinc-900 border-2 border-zinc-700/50 rounded-2xl p-4 sm:p-6 mb-6 sm:mb-8">
                <h3 className="text-lg sm:text-xl font-semibold text-white mb-4 sm:mb-6">
                  Ratings Over Time
                </h3>
                <div className="h-64 sm:h-80">
                  <Line data={chartData} options={chartOptions} />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
                {/* Top Rated Controllers */}
                <div className="bg-zinc-900 border-2 border-zinc-700/50 rounded-2xl p-4 sm:p-6">
                  <div className="flex items-center mb-4 sm:mb-6">
                    <div className="p-2 sm:p-3 bg-yellow-500/20 rounded-xl mr-3">
                      <Star className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-400" />
                    </div>
                    <h2 className="text-lg sm:text-xl font-semibold text-white">
                      Highest Rated Controllers
                    </h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-zinc-500 text-xs sm:text-sm border-b border-zinc-800">
                          <th className="pb-3 sm:pb-4 font-medium uppercase tracking-wider">
                            Controller
                          </th>
                          <th className="pb-3 sm:pb-4 font-medium uppercase tracking-wider">
                            Avg Rating
                          </th>
                          <th className="pb-3 sm:pb-4 font-medium uppercase tracking-wider text-right">
                            Count
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/50">
                        {stats?.topRated.map((c, i) => (
                          <tr
                            key={c.controller_id}
                            className="hover:bg-zinc-800/30 transition-colors group"
                          >
                            <td className="py-3 sm:py-4">
                              <div className="flex items-center space-x-2 sm:space-x-3">
                                <span className="text-zinc-500 text-xs sm:text-sm w-4">
                                  {i + 1}
                                </span>
                                <Link
                                  to={`/user/${c.username}`}
                                  className="flex items-center space-x-2 sm:space-x-3 group/link"
                                >
                                  {getAvatarUrl(c.controller_id, c.avatar) ? (
                                    <img
                                      src={getAvatarUrl(c.controller_id, c.avatar)!}
                                      alt={c.username}
                                      className="w-8 h-8 rounded-full border-2 border-zinc-700 group-hover/link:border-blue-400 transition-colors"
                                    />
                                  ) : (
                                    <div className="w-8 h-8 rounded-full bg-zinc-800 border-2 border-zinc-700 group-hover/link:border-blue-400 flex items-center justify-center text-zinc-400 font-bold text-sm transition-colors">
                                      {c.username.charAt(0).toUpperCase()}
                                    </div>
                                  )}
                                  <span className="font-medium group-hover/link:text-blue-400 transition-colors text-sm sm:text-base">
                                    {c.username}
                                  </span>
                                </Link>
                              </div>
                            </td>
                            <td className="py-3 sm:py-4 text-zinc-300">
                              <div className="flex items-center space-x-1">
                                <span className="text-yellow-400 font-bold text-sm sm:text-base">
                                  {Number(c.avg_rating).toFixed(1)}
                                </span>
                                <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                              </div>
                            </td>
                            <td className="py-3 sm:py-4 text-zinc-500 text-right text-sm sm:text-base">
                              {c.rating_count}
                            </td>
                          </tr>
                        ))}
                        {stats?.topRated.length === 0 && (
                          <tr>
                            <td
                              colSpan={3}
                              className="py-8 text-center text-zinc-500"
                            >
                              No ratings found yet
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Most Rated Controllers */}
                <div className="bg-zinc-900 border-2 border-zinc-700/50 rounded-2xl p-4 sm:p-6">
                  <div className="flex items-center mb-4 sm:mb-6">
                    <div className="p-2 sm:p-3 bg-blue-500/20 rounded-xl mr-3">
                      <Users className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
                    </div>
                    <h2 className="text-lg sm:text-xl font-semibold text-white">
                      Most Rated Controllers
                    </h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-zinc-500 text-xs sm:text-sm border-b border-zinc-800">
                          <th className="pb-3 sm:pb-4 font-medium uppercase tracking-wider">
                            Controller
                          </th>
                          <th className="pb-3 sm:pb-4 font-medium uppercase tracking-wider">
                            Count
                          </th>
                          <th className="pb-3 sm:pb-4 font-medium uppercase tracking-wider text-right">
                            Avg Rating
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/50">
                        {stats?.mostRated.map((c) => (
                          <tr
                            key={c.controller_id}
                            className="hover:bg-zinc-800/30 transition-colors group"
                          >
                            <td className="py-3 sm:py-4">
                              <Link
                                to={`/user/${c.username}`}
                                className="flex items-center space-x-2 sm:space-x-3 group/link"
                              >
                                {getAvatarUrl(c.controller_id, c.avatar) ? (
                                  <img
                                    src={getAvatarUrl(c.controller_id, c.avatar)!}
                                    alt={c.username}
                                    className="w-8 h-8 rounded-full border-2 border-zinc-700 group-hover/link:border-blue-400 transition-colors"
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-zinc-800 border-2 border-zinc-700 group-hover/link:border-blue-400 flex items-center justify-center text-zinc-400 font-bold text-sm transition-colors">
                                    {c.username.charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <span className="font-medium group-hover/link:text-blue-400 transition-colors text-sm sm:text-base">
                                  {c.username}
                                </span>
                              </Link>
                            </td>
                            <td className="py-3 sm:py-4">
                              <span className="px-2.5 py-1 bg-blue-500/10 text-blue-400 rounded-full text-xs sm:text-sm font-bold border border-blue-500/20">
                                {c.rating_count}
                              </span>
                            </td>
                            <td className="py-3 sm:py-4 text-zinc-500 text-right text-sm sm:text-base">
                              {Number(c.avg_rating).toFixed(1)}
                            </td>
                          </tr>
                        ))}
                        {stats?.mostRated.length === 0 && (
                          <tr>
                            <td
                              colSpan={3}
                              className="py-8 text-center text-zinc-500"
                            >
                              No ratings found yet
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Top Pilots */}
                <div className="bg-zinc-900 border-2 border-zinc-700/50 rounded-2xl p-4 sm:p-6 lg:col-span-2">
                  <div className="flex items-center mb-4 sm:mb-6">
                    <div className="p-2 sm:p-3 bg-green-500/20 rounded-xl mr-3">
                      <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-green-400" />
                    </div>
                    <h2 className="text-lg sm:text-xl font-semibold text-white">
                      Pilots Who Rated the Most
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {stats?.topPilots.map((p) => (
                      <Link
                        key={p.pilot_id}
                        to={`/user/${p.username}`}
                        className="flex items-center justify-between p-4 bg-zinc-800/30 border border-zinc-800 rounded-2xl hover:border-zinc-700 transition-all group"
                      >
                        <div className="flex items-center space-x-3">
                          {getAvatarUrl(p.pilot_id, p.avatar) ? (
                            <img
                              src={getAvatarUrl(p.pilot_id, p.avatar)!}
                              alt={p.username}
                              className="w-10 h-10 rounded-full border-2 border-zinc-700 group-hover:border-blue-400 transition-colors"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-zinc-800 border-2 border-zinc-700 group-hover:border-blue-400 flex items-center justify-center text-zinc-400 font-bold group-hover:bg-zinc-700 transition-colors">
                              {p.username.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="font-medium group-hover:text-blue-400 transition-colors">
                            {p.username}
                          </div>
                        </div>
                        <div className="text-zinc-500 text-sm">
                          <span className="font-bold text-white">
                            {p.rating_count}
                          </span>{' '}
                          ratings
                        </div>
                      </Link>
                    ))}
                    {stats?.topPilots.length === 0 && (
                      <div className="col-span-full py-8 text-center text-zinc-500">
                        No ratings submitted yet
                      </div>
                    )}
                  </div>
                </div>
              </div>
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
