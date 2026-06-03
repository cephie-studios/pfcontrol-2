import { useState, useEffect, useCallback, useMemo } from 'react';
import { MdStar, MdThumbUp } from 'react-icons/md';
import { Link } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminSectionTitle from '../../components/admin/AdminSectionTitle';
import AdminTable from '../../components/admin/AdminTable';
import {
  adminDownsizeButtonSize,
  adminSectionClass,
  ADMIN_HEADER_ACTIONS_MOBILE,
  ADMIN_TH,
  ADMIN_TD,
  ADMIN_TABLE_HEAD,
} from '../../components/admin/adminConstants';
import {
  AdminAreaChart,
  AdminMultiSeriesAreaChart,
} from '../../components/admin/AdminChart';
import Loader from '../../components/common/Loader';
import Button from '../../components/common/Button';
import {
  fetchControllerRatingStats,
  fetchControllerDailyRatingStats,
  type ControllerRatingStats,
  type DailyRatingStats,
} from '../../utils/fetch/admin';
import ErrorScreen from '../../components/common/ErrorScreen';

const getAvatarUrl = (userId: string, avatar: string | null) => {
  if (!avatar) return null;
  return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.png?size=128`;
};

export default function AdminRatings() {
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

  const multiSeriesData = useMemo(
    () =>
      dailyStats.map((d) => ({
        label: d.date,
        count: d.count,
        avg_rating: Number(d.avg_rating),
      })),
    [dailyStats]
  );

  const avgRatingData = useMemo(
    () =>
      dailyStats.map((d) => ({
        label: d.date,
        value: Number(d.avg_rating),
      })),
    [dailyStats]
  );

  return (
    <AdminLayout toast={toast} onToastClose={() => setToast(null)}>
      <AdminPageHeader
        title="Controller Ratings"
        icon={MdThumbUp}
        accent="blue"
        actionsClassName={ADMIN_HEADER_ACTIONS_MOBILE}
        actions={
          <div className="flex flex-wrap gap-2 max-md:w-full">
            {[7, 30, 90].map((days) => (
              <Button
                key={days}
                onClick={() => setTimeRange(days)}
                variant={timeRange === days ? 'primary' : 'outline'}
                size={adminDownsizeButtonSize('sm')}
              >
                {days} days
              </Button>
            ))}
          </div>
        }
      />

      {loading ? (
        <div className="flex justify-center py-16">
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
          <div
            className={`space-y-8 ${adminSectionClass('!mt-0 !pt-0 !border-t-0')}`}
          >
            <div>
              <AdminSectionTitle>Ratings count</AdminSectionTitle>
              <p className="text-xs text-zinc-500 mb-2">
                Hover for daily values
              </p>
              <AdminMultiSeriesAreaChart
                data={multiSeriesData}
                series={[
                  { key: 'count', label: 'Ratings count', color: '#3B82F6' },
                ]}
                height={200}
                showLegend
              />
            </div>

            <div>
              <AdminSectionTitle>Average rating</AdminSectionTitle>
              <p className="text-xs text-zinc-500 mb-2">
                Hover for daily values
              </p>
              <AdminAreaChart
                data={avgRatingData}
                color="#F59E0B"
                valueLabel="Avg rating"
                height={200}
              />
            </div>
          </div>

          <div
            className={`grid grid-cols-1 lg:grid-cols-2 gap-8 ${adminSectionClass()}`}
          >
            <div>
              <AdminSectionTitle>Highest Rated Controllers</AdminSectionTitle>
              <AdminTable minWidth="480px">
                <thead className={ADMIN_TABLE_HEAD}>
                  <tr>
                    <th className={ADMIN_TH}>Controller</th>
                    <th className={ADMIN_TH}>Avg Rating</th>
                    <th className={`${ADMIN_TH} text-right`}>Count</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {stats.topRated.map((c, i) => (
                    <tr
                      key={c.controller_id}
                      className="hover:bg-zinc-800/30 transition-colors group"
                    >
                      <td className={ADMIN_TD}>
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
                                className="w-8 h-8 rounded-full border border-zinc-700 group-hover/link:border-blue-400 transition-colors"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 group-hover/link:border-blue-400 flex items-center justify-center text-zinc-400 font-bold text-sm transition-colors">
                                {c.username.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <span className="font-medium group-hover/link:text-blue-400 transition-colors text-sm sm:text-base">
                              {c.username}
                            </span>
                          </Link>
                        </div>
                      </td>
                      <td className={ADMIN_TD}>
                        <div className="flex items-center space-x-1">
                          <span className="text-yellow-400 font-bold text-sm sm:text-base">
                            {Number(c.avg_rating).toFixed(1)}
                          </span>
                          <MdStar size={12} className="text-yellow-400" />
                        </div>
                      </td>
                      <td className={`${ADMIN_TD} text-right`}>
                        {c.rating_count}
                      </td>
                    </tr>
                  ))}
                  {stats.topRated.length === 0 && (
                    <tr>
                      <td
                        colSpan={3}
                        className={`${ADMIN_TD} text-center text-zinc-500`}
                      >
                        No ratings found yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </AdminTable>
            </div>

            <div>
              <AdminSectionTitle>Most Rated Controllers</AdminSectionTitle>
              <AdminTable minWidth="480px">
                <thead className={ADMIN_TABLE_HEAD}>
                  <tr>
                    <th className={ADMIN_TH}>Controller</th>
                    <th className={ADMIN_TH}>Count</th>
                    <th className={`${ADMIN_TH} text-right`}>Avg Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {stats.mostRated.map((c) => (
                    <tr
                      key={c.controller_id}
                      className="hover:bg-zinc-800/30 transition-colors group"
                    >
                      <td className={ADMIN_TD}>
                        <Link
                          to={`/user/${c.username}`}
                          className="flex items-center space-x-2 sm:space-x-3 group/link"
                        >
                          {getAvatarUrl(c.controller_id, c.avatar) ? (
                            <img
                              src={getAvatarUrl(c.controller_id, c.avatar)!}
                              alt={c.username}
                              className="w-8 h-8 rounded-full border border-zinc-700 group-hover/link:border-blue-400 transition-colors"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 group-hover/link:border-blue-400 flex items-center justify-center text-zinc-400 font-bold text-sm transition-colors">
                              {c.username.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="font-medium group-hover/link:text-blue-400 transition-colors text-sm sm:text-base">
                            {c.username}
                          </span>
                        </Link>
                      </td>
                      <td className={ADMIN_TD}>
                        <span className="px-2.5 py-1 bg-blue-500/10 text-blue-400 rounded-full text-xs sm:text-sm font-bold border border-blue-500/20">
                          {c.rating_count}
                        </span>
                      </td>
                      <td className={`${ADMIN_TD} text-right`}>
                        {Number(c.avg_rating).toFixed(1)}
                      </td>
                    </tr>
                  ))}
                  {stats.mostRated.length === 0 && (
                    <tr>
                      <td
                        colSpan={3}
                        className={`${ADMIN_TD} text-center text-zinc-500`}
                      >
                        No ratings found yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </AdminTable>
            </div>
          </div>

          <div className={adminSectionClass()}>
            <AdminSectionTitle>Pilots Who Rated the Most</AdminSectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {stats.topPilots.map((p) => (
                <Link
                  key={p.pilot_id}
                  to={`/user/${p.username}`}
                  className="flex items-center justify-between p-3 rounded-lg border border-zinc-800/60 bg-zinc-900/30 hover:border-zinc-700 transition-colors group"
                >
                  <div className="flex items-center space-x-3">
                    {getAvatarUrl(p.pilot_id, p.avatar) ? (
                      <img
                        src={getAvatarUrl(p.pilot_id, p.avatar)!}
                        alt={p.username}
                        className="w-9 h-9 rounded-full border border-zinc-700 group-hover:border-blue-400 transition-colors"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700 group-hover:border-blue-400 flex items-center justify-center text-zinc-400 font-bold group-hover:bg-zinc-700 transition-colors">
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
              {stats.topPilots.length === 0 && (
                <div className="col-span-full py-8 text-center text-zinc-500">
                  No ratings submitted yet
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-12 text-zinc-400">
          No statistics available
        </div>
      )}
    </AdminLayout>
  );
}
