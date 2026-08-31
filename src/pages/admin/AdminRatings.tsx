import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  MdStar,
  MdThumbUp,
  MdDelete,
  MdPeople,
  MdFlag,
  MdExpandMore,
} from 'react-icons/md';
import { Link } from 'react-router';
import AdminLayout from '../../components/admin/AdminLayout';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminSectionTitle from '../../components/admin/AdminSectionTitle';
import AdminTable from '../../components/admin/AdminTable';
import AdminSearchInput from '../../components/admin/AdminSearchInput';
import AdminToolbar from '../../components/admin/AdminToolbar';
import {
  adminDownsizeButtonSize,
  adminSectionClass,
  ADMIN_HEADER_ACTIONS_MOBILE,
  ADMIN_TH,
  ADMIN_TD,
  ADMIN_TABLE_HEAD,
  ADMIN_TOOLBAR_MOBILE_COL,
  ADMIN_TOOLBAR_MOBILE_SEARCH,
  ADMIN_TOOLBAR_MOBILE_SPLIT_ITEM,
  ADMIN_TOOLBAR_MOBILE_SPLIT_ROW,
} from '../../components/admin/adminConstants';
import {
  AdminAreaChart,
  AdminMultiSeriesAreaChart,
} from '../../components/admin/AdminChart';
import Loader from '../../components/common/Loader';
import Button from '../../components/common/Button';
import Dropdown from '../../components/common/Dropdown';
import {
  fetchControllerRatingStats,
  fetchControllerDailyRatingStats,
  fetchAdminControllerRatings,
  deleteAdminControllerRating,
  dismissControllerRatingReport,
  dismissAutomodFlag,
  type ControllerRatingStats,
  type DailyRatingStats,
  type AdminControllerRating,
} from '../../utils/fetch/admin';
import ErrorScreen from '../../components/common/ErrorScreen';

const RATING_FILTER_OPTIONS = [
  { value: 'all', label: 'All Ratings' },
  { value: '5', label: '5 Stars' },
  { value: '4', label: '4 Stars' },
  { value: '3', label: '3 Stars' },
  { value: '2', label: '2 Stars' },
  { value: '1', label: '1 Star' },
];

const FLAG_FILTER_OPTIONS = [
  { value: 'all', label: 'All Feedback' },
  { value: 'reported', label: 'Reported' },
  { value: 'automod', label: 'Automod Flagged' },
];

function renderStars(rating: number) {
  return (
    <div className="flex items-center space-x-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <MdStar
          key={star}
          size={16}
          className={star <= rating ? 'text-yellow-400' : 'text-zinc-600'}
        />
      ))}
    </div>
  );
}

const getAvatarUrl = (userId: string, avatar: string | null) => {
  if (!avatar) return null;
  return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.png?size=128`;
};

export default function AdminRatings() {
  const [view, setView] = useState<'overview' | 'individual'>('overview');

  const [stats, setStats] = useState<ControllerRatingStats | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyRatingStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  const [ratings, setRatings] = useState<AdminControllerRating[]>([]);
  const [ratingsLoading, setRatingsLoading] = useState(true);
  const [ratingsError, setRatingsError] = useState<string | null>(null);
  const [ratingsSearch, setRatingsSearch] = useState('');
  const [ratingsFilter, setRatingsFilter] = useState('all');
  const [ratingsFlagFilter, setRatingsFlagFilter] = useState('all');
  const [ratingsHasCommentOnly, setRatingsHasCommentOnly] = useState(false);
  const [ratingsPage, setRatingsPage] = useState(1);
  const [ratingsPages, setRatingsPages] = useState(1);
  const [expandedReportIds, setExpandedReportIds] = useState<Set<number>>(
    new Set()
  );

  const toggleReportExpanded = (id: number) => {
    setExpandedReportIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const fetchRatingsList = useCallback(async () => {
    try {
      setRatingsLoading(true);
      setRatingsError(null);
      const rating =
        ratingsFilter === 'all' ? undefined : Number(ratingsFilter);
      const flagged =
        ratingsFlagFilter === 'reported' || ratingsFlagFilter === 'automod'
          ? ratingsFlagFilter
          : undefined;
      const result = await fetchAdminControllerRatings(
        ratingsPage,
        25,
        ratingsSearch,
        rating,
        flagged,
        ratingsHasCommentOnly
      );
      setRatings(result.ratings);
      setRatingsPages(result.pagination.pages);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to fetch ratings';
      setRatingsError(message);
      setToast({ message, type: 'error' });
    } finally {
      setRatingsLoading(false);
    }
  }, [
    ratingsPage,
    ratingsSearch,
    ratingsFilter,
    ratingsFlagFilter,
    ratingsHasCommentOnly,
  ]);

  useEffect(() => {
    if (view === 'individual') {
      fetchRatingsList();
    }
  }, [view, fetchRatingsList]);

  useEffect(() => {
    setRatingsPage(1);
  }, [ratingsSearch, ratingsFilter, ratingsFlagFilter, ratingsHasCommentOnly]);

  const handleDeleteRating = async (id: number) => {
    if (!confirm('Are you sure you want to delete this rating?')) return;
    try {
      await deleteAdminControllerRating(id);
      setToast({ message: 'Rating deleted successfully', type: 'success' });
      fetchRatingsList();
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Failed to delete rating',
        type: 'error',
      });
    }
  };

  const handleDismissReport = async (id: number) => {
    try {
      await dismissControllerRatingReport(id);
      setToast({ message: 'Report dismissed', type: 'success' });
      setRatings((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, reported: false, report_reason: null } : r
        )
      );
    } catch (err) {
      setToast({
        message:
          err instanceof Error ? err.message : 'Failed to dismiss report',
        type: 'error',
      });
    }
  };

  const handleDismissAutomod = async (id: number) => {
    try {
      await dismissAutomodFlag(id);
      setToast({ message: 'Automod flag dismissed', type: 'success' });
      setRatings((prev) =>
        prev.map((r) =>
          r.id === id
            ? { ...r, automod_flagged: false, automod_reason: null }
            : r
        )
      );
    } catch (err) {
      setToast({
        message:
          err instanceof Error ? err.message : 'Failed to dismiss automod flag',
        type: 'error',
      });
    }
  };

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
      setError(
        error instanceof Error
          ? error.message
          : 'Failed to fetch rating statistics'
      );
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
            <Button
              onClick={() => setView('overview')}
              variant={view === 'overview' ? 'primary' : 'outline'}
              size={adminDownsizeButtonSize('sm')}
            >
              Overview
            </Button>
            <Button
              onClick={() => setView('individual')}
              variant={view === 'individual' ? 'primary' : 'outline'}
              size={adminDownsizeButtonSize('sm')}
            >
              Individual Feedback
            </Button>
          </div>
        }
      />

      {view === 'overview' && (
        <>
          <div className="flex flex-wrap gap-2 mb-4">
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
                      {
                        key: 'count',
                        label: 'Ratings count',
                        color: '#3B82F6',
                      },
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
                  <AdminSectionTitle>
                    Highest Rated Controllers
                  </AdminSectionTitle>
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
                                    src={
                                      getAvatarUrl(c.controller_id, c.avatar)!
                                    }
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
        </>
      )}

      {view === 'individual' && (
        <>
          <AdminToolbar className={ADMIN_TOOLBAR_MOBILE_COL}>
            <AdminSearchInput
              value={ratingsSearch}
              onChange={setRatingsSearch}
              placeholder="Search by controller or pilot username…"
              loading={ratingsLoading}
              className={ADMIN_TOOLBAR_MOBILE_SEARCH}
            />
            <div className={ADMIN_TOOLBAR_MOBILE_SPLIT_ROW}>
              <Dropdown
                options={RATING_FILTER_OPTIONS}
                value={ratingsFilter}
                onChange={setRatingsFilter}
                size="sm"
                className={ADMIN_TOOLBAR_MOBILE_SPLIT_ITEM}
              />
              <Dropdown
                options={FLAG_FILTER_OPTIONS}
                value={ratingsFlagFilter}
                onChange={setRatingsFlagFilter}
                size="sm"
                className={ADMIN_TOOLBAR_MOBILE_SPLIT_ITEM}
              />
              <Button
                onClick={() => setRatingsHasCommentOnly((prev) => !prev)}
                variant={ratingsHasCommentOnly ? 'primary' : 'outline'}
                size={adminDownsizeButtonSize('sm')}
                className={ADMIN_TOOLBAR_MOBILE_SPLIT_ITEM}
              >
                Has comment
              </Button>
            </div>
          </AdminToolbar>

          {ratingsLoading ? (
            <div className="flex justify-center py-16">
              <Loader />
            </div>
          ) : ratingsError ? (
            <ErrorScreen
              title="Error loading ratings"
              message={ratingsError}
              onRetry={fetchRatingsList}
            />
          ) : (
            <div className={adminSectionClass('!mt-0 !pt-0 !border-t-0')}>
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {ratings.length === 0 ? (
                  <div className="col-span-full text-center py-8 text-zinc-400">
                    No ratings found matching your criteria.
                  </div>
                ) : (
                  ratings.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-3"
                    >
                      <div className="flex flex-col space-y-2">
                        <div className="flex items-center justify-between">
                          <Link
                            to={`/user/${item.controller_username}`}
                            className="flex items-center space-x-2 group/link"
                          >
                            {getAvatarUrl(
                              item.controller_id,
                              item.controller_avatar
                            ) ? (
                              <img
                                src={
                                  getAvatarUrl(
                                    item.controller_id,
                                    item.controller_avatar
                                  )!
                                }
                                alt={item.controller_username ?? 'Controller'}
                                className="w-8 h-8 rounded-full"
                              />
                            ) : (
                              <div className="w-8 h-8 bg-zinc-600 rounded-full flex items-center justify-center">
                                <MdPeople size={16} className="text-zinc-400" />
                              </div>
                            )}
                            <div>
                              <div className="font-medium text-white group-hover/link:text-blue-400 transition-colors">
                                {item.controller_username ?? 'Unknown'}
                              </div>
                              <div className="text-xs text-zinc-500">
                                Controller
                              </div>
                            </div>
                          </Link>
                          <div className="text-xs text-zinc-500">
                            {new Date(item.created_at).toLocaleDateString()}
                          </div>
                        </div>

                        <div className="flex justify-left">
                          {renderStars(item.rating)}
                        </div>

                        {item.comment && (
                          <p className="text-sm text-zinc-300 break-words">
                            {item.comment}
                          </p>
                        )}

                        {(item.reported || item.automod_flagged) && (
                          <div className="flex flex-wrap gap-1.5">
                            {item.reported && (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20"
                                title={item.report_reason ?? undefined}
                              >
                                <MdFlag size={12} />
                                Reported
                              </span>
                            )}
                            {item.automod_flagged && (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20"
                                title={item.automod_reason ?? undefined}
                              >
                                <img
                                  src="/assets/images/automod.webp"
                                  alt=""
                                  className="w-3 h-3 rounded-full"
                                />
                                Automod
                              </span>
                            )}
                          </div>
                        )}

                        {expandedReportIds.has(item.id) && (
                          <div className="p-2.5 rounded-lg bg-zinc-950/50 border border-zinc-800/60 space-y-2">
                            {item.reported && (
                              <>
                                <p className="text-xs text-zinc-400">
                                  <span className="text-zinc-500">
                                    Report reason:
                                  </span>{' '}
                                  {item.report_reason || 'No reason provided'}
                                </p>
                                <Button
                                  variant="outline"
                                  size="xs"
                                  onClick={() => handleDismissReport(item.id)}
                                  className="text-green-400 ring-green-700/50 hover:bg-none hover:bg-green-900/20"
                                >
                                  Dismiss report
                                </Button>
                              </>
                            )}
                            {item.automod_flagged && (
                              <>
                                <p className="text-xs text-zinc-400">
                                  <span className="text-zinc-500">
                                    Automod reason:
                                  </span>{' '}
                                  {item.automod_reason || 'No reason provided'}
                                </p>
                                <Button
                                  variant="outline"
                                  size="xs"
                                  onClick={() => handleDismissAutomod(item.id)}
                                  className="text-green-400 ring-green-700/50 hover:bg-none hover:bg-green-900/20"
                                >
                                  Dismiss automod flag
                                </Button>
                              </>
                            )}
                            <Button
                              variant="outline"
                              size="xs"
                              onClick={() =>
                                (window.location.href = `/admin/bans?userId=${
                                  item.pilot_id
                                }&username=${encodeURIComponent(
                                  item.pilot_username ?? ''
                                )}`)
                              }
                              className="text-zinc-300 ring-zinc-600 hover:bg-none hover:bg-zinc-800"
                            >
                              Moderate pilot
                            </Button>
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60">
                          <Link
                            to={`/user/${item.pilot_username}`}
                            className="flex items-center space-x-2 group/link"
                          >
                            {getAvatarUrl(item.pilot_id, item.pilot_avatar) ? (
                              <img
                                src={
                                  getAvatarUrl(
                                    item.pilot_id,
                                    item.pilot_avatar
                                  )!
                                }
                                alt={item.pilot_username ?? 'Pilot'}
                                className="w-6 h-6 rounded-full"
                              />
                            ) : (
                              <div className="w-6 h-6 bg-zinc-600 rounded-full flex items-center justify-center">
                                <MdPeople size={12} className="text-zinc-400" />
                              </div>
                            )}
                            <span className="text-xs text-zinc-400 group-hover/link:text-blue-400 transition-colors">
                              {item.pilot_username ?? 'Unknown'} (pilot)
                            </span>
                          </Link>
                          <div className="flex items-center space-x-1">
                            <Button
                              variant="ghost"
                              size={adminDownsizeButtonSize('sm')}
                              onClick={() => toggleReportExpanded(item.id)}
                              className="p-1 text-zinc-400 hover:text-white"
                              aria-label="More options"
                              aria-expanded={expandedReportIds.has(item.id)}
                              title="More options"
                            >
                              <MdExpandMore
                                size={16}
                                className={`transition-transform ${
                                  expandedReportIds.has(item.id)
                                    ? 'rotate-180'
                                    : ''
                                }`}
                              />
                            </Button>
                            <Button
                              variant="ghost"
                              size={adminDownsizeButtonSize('sm')}
                              onClick={() => handleDeleteRating(item.id)}
                              className="p-1 text-red-400 hover:text-red-300"
                              aria-label="Delete rating"
                            >
                              <MdDelete size={16} />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {ratingsPages > 1 && (
                <div className="flex justify-center mt-8 space-x-2">
                  <Button
                    onClick={() => setRatingsPage(Math.max(1, ratingsPage - 1))}
                    disabled={ratingsPage === 1}
                    variant="outline"
                    size="xs"
                  >
                    Previous
                  </Button>
                  <span className="text-zinc-400 py-2">
                    Page {ratingsPage} of {ratingsPages}
                  </span>
                  <Button
                    onClick={() =>
                      setRatingsPage(Math.min(ratingsPages, ratingsPage + 1))
                    }
                    disabled={ratingsPage === ratingsPages}
                    variant="outline"
                    size="xs"
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </AdminLayout>
  );
}
