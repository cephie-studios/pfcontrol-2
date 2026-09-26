import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { Link } from 'react-router';
import {
  Bot,
  BotOff,
  ChevronLeft,
  ChevronRight,
  Flag,
  FlagOff,
  Gavel,
  MessageSquare,
  Star,
  ThumbsUp,
  Trash2,
  User,
  Users,
} from 'lucide-react';
import AdminLayout from '../../components/admin/AdminLayout';
import AdminPage from '../../components/admin/AdminPage';
import AdminSection from '../../components/admin/AdminSection';
import AdminStatCards from '../../components/admin/AdminStatCards';
import AdminTable from '../../components/admin/AdminTable';
import AdminSearchInput from '../../components/admin/AdminSearchInput';
import AdminSelect from '../../components/admin/AdminSelect';
import AdminStatusBadge from '../../components/admin/AdminStatusBadge';
import AdminToolbar from '../../components/admin/AdminToolbar';
import {
  AdminEmptyState,
  AdminErrorState,
  AdminLoading,
} from '../../components/admin/AdminStates';
import { useAdminConfirm } from '../../components/admin/useAdminConfirm';
import { ADMIN_CHART_COLORS } from '../../components/admin/adminConstants';
import {
  AdminAreaChart,
  AdminMultiSeriesAreaChart,
} from '../../components/admin/AdminChart';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Toggle } from '@/components/ui/toggle';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
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

const TIME_RANGES = [7, 30, 90];

function Stars({ rating }: { rating: number }) {
  return (
    <div
      className="flex items-center gap-0.5"
      aria-label={`${rating} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            'size-4',
            star <= rating
              ? 'fill-amber-400 text-amber-400'
              : 'text-muted-foreground/40'
          )}
        />
      ))}
    </div>
  );
}

const getAvatarUrl = (userId: string, avatar: string | null) => {
  if (!avatar) return null;
  return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.png?size=128`;
};

function UserAvatar({
  userId,
  avatar,
  name,
  size = 'default',
  iconFallback = false,
}: {
  userId: string;
  avatar: string | null;
  name: string;
  size?: 'default' | 'sm' | 'lg';
  iconFallback?: boolean;
}) {
  const url = getAvatarUrl(userId, avatar);
  return (
    <Avatar size={size} className="border">
      {url ? <AvatarImage src={url} alt={name} /> : null}
      <AvatarFallback className="font-medium">
        {iconFallback ? (
          <User className="size-3.5" />
        ) : (
          name.charAt(0).toUpperCase()
        )}
      </AvatarFallback>
    </Avatar>
  );
}

function RowAction({
  label,
  onClick,
  destructive = false,
  children,
}: {
  label: string;
  onClick: () => void;
  destructive?: boolean;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          onClick={onClick}
          className={cn(
            destructive && 'text-destructive hover:text-destructive'
          )}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export default function AdminRatings() {
  const [view, setView] = useState<'overview' | 'individual'>('overview');
  const { confirm, confirmDialog } = useAdminConfirm();

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
  const [ratingsTotal, setRatingsTotal] = useState(0);

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
      setRatingsTotal(result.pagination.total);
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
    if (
      !(await confirm({
        title: 'Delete this rating?',
        description:
          'The rating and its comment will be permanently removed. This action cannot be undone.',
        confirmText: 'Delete',
        destructive: true,
      }))
    )
      return;
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

  const handleModeratePilot = (item: AdminControllerRating) => {
    window.location.href = `/admin/bans?userId=${
      item.pilot_id
    }&username=${encodeURIComponent(item.pilot_username ?? '')}`;
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

  const periodSummary = useMemo(() => {
    let count = 0;
    let weighted = 0;
    for (const d of dailyStats) {
      const c = Number(d.count) || 0;
      count += c;
      weighted += c * (Number(d.avg_rating) || 0);
    }
    return { count, avg: count > 0 ? weighted / count : null };
  }, [dailyStats]);

  const renderOverview = () => {
    if (loading) return <AdminLoading label="Loading rating statistics…" />;
    if (error) {
      return (
        <AdminErrorState
          title="Error loading statistics"
          message={error}
          onRetry={fetchData}
        />
      );
    }
    if (!stats) {
      return <AdminEmptyState icon={Star} title="No statistics available" />;
    }

    return (
      <>
        <AdminStatCards
          columns={2}
          items={[
            {
              label: `Ratings (last ${timeRange} days)`,
              value: periodSummary.count,
            },
            {
              label: `Average rating (last ${timeRange} days)`,
              value:
                periodSummary.avg !== null
                  ? periodSummary.avg.toFixed(2)
                  : 'N/A',
            },
          ]}
        />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <AdminSection title="Ratings count">
            <AdminMultiSeriesAreaChart
              data={multiSeriesData}
              series={[
                {
                  key: 'count',
                  label: 'Ratings count',
                  color: ADMIN_CHART_COLORS.blue,
                },
              ]}
              height={200}
              showLegend
            />
          </AdminSection>

          <AdminSection title="Average rating">
            <AdminAreaChart
              data={avgRatingData}
              color={ADMIN_CHART_COLORS.amber}
              valueLabel="Avg rating"
              height={200}
            />
          </AdminSection>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <AdminSection title="Highest rated controllers">
            <AdminTable minWidth="420px">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Controller</TableHead>
                  <TableHead>Avg rating</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.topRated.map((c, i) => (
                  <TableRow key={c.controller_id}>
                    <TableCell className="text-xs text-muted-foreground tabular-nums">
                      {i + 1}
                    </TableCell>
                    <TableCell>
                      <Link
                        to={`/user/${c.username}`}
                        className="flex items-center gap-2.5 font-medium hover:underline"
                      >
                        <UserAvatar
                          userId={c.controller_id}
                          avatar={c.avatar}
                          name={c.username}
                        />
                        {c.username}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium tabular-nums">
                      {Number(c.avg_rating).toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.rating_count}
                    </TableCell>
                  </TableRow>
                ))}
                {stats.topRated.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No ratings found yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </AdminTable>
          </AdminSection>

          <AdminSection title="Most rated controllers">
            <AdminTable minWidth="420px">
              <TableHeader>
                <TableRow>
                  <TableHead>Controller</TableHead>
                  <TableHead>Count</TableHead>
                  <TableHead className="text-right">Avg rating</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.mostRated.map((c) => (
                  <TableRow key={c.controller_id}>
                    <TableCell>
                      <Link
                        to={`/user/${c.username}`}
                        className="flex items-center gap-2.5 font-medium hover:underline"
                      >
                        <UserAvatar
                          userId={c.controller_id}
                          avatar={c.avatar}
                          name={c.username}
                        />
                        {c.username}
                      </Link>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {c.rating_count}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {Number(c.avg_rating).toFixed(1)}
                    </TableCell>
                  </TableRow>
                ))}
                {stats.mostRated.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No ratings found yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </AdminTable>
          </AdminSection>
        </div>

        <AdminSection title="Pilots who rated the most">
          {stats.topPilots.length === 0 ? (
            <AdminEmptyState
              icon={Users}
              title="No ratings submitted yet"
              className="py-8"
            />
          ) : (
            <ul className="divide-y rounded-2xl border">
              {stats.topPilots.map((p) => (
                <li key={p.pilot_id}>
                  <Link
                    to={`/user/${p.username}`}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-accent/50"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <UserAvatar
                        userId={p.pilot_id}
                        avatar={p.avatar}
                        name={p.username}
                      />
                      <span className="truncate text-sm font-medium">
                        {p.username}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                      {p.rating_count} ratings
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </AdminSection>
      </>
    );
  };

  const renderRatingRow = (item: AdminControllerRating) => (
    <li key={item.id} className="flex flex-col gap-2 px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
          <Link
            to={`/user/${item.controller_username}`}
            className="flex min-w-0 items-center gap-2.5"
          >
            <UserAvatar
              userId={item.controller_id}
              avatar={item.controller_avatar}
              name={item.controller_username ?? 'Controller'}
              size="sm"
              iconFallback
            />
            <span className="truncate text-sm font-medium hover:underline">
              {item.controller_username ?? 'Unknown'}
            </span>
          </Link>
          <Stars rating={item.rating} />
          {item.reported && (
            <AdminStatusBadge tone="danger" icon={Flag}>
              Reported
            </AdminStatusBadge>
          )}
          {item.automod_flagged && (
            <AdminStatusBadge tone="warning" icon={Bot}>
              Flagged by automod
            </AdminStatusBadge>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <span className="mr-1 text-xs text-muted-foreground tabular-nums">
            {new Date(item.created_at).toLocaleDateString()}
          </span>
          {item.reported && (
            <RowAction
              label="Dismiss report"
              onClick={() => handleDismissReport(item.id)}
            >
              <FlagOff />
            </RowAction>
          )}
          {item.automod_flagged && (
            <RowAction
              label="Dismiss automod flag"
              onClick={() => handleDismissAutomod(item.id)}
            >
              <BotOff />
            </RowAction>
          )}
          <RowAction
            label="Moderate pilot"
            onClick={() => handleModeratePilot(item)}
          >
            <Gavel />
          </RowAction>
          <RowAction
            label="Delete rating"
            destructive
            onClick={() => handleDeleteRating(item.id)}
          >
            <Trash2 />
          </RowAction>
        </div>
      </div>

      {item.comment && <p className="text-sm break-words">{item.comment}</p>}

      {item.reported && (
        <p className="text-xs break-words">
          <span className="text-muted-foreground">Report reason:</span>{' '}
          {item.report_reason || 'No reason provided'}
        </p>
      )}
      {item.automod_flagged && (
        <p className="text-xs break-words">
          <span className="text-muted-foreground">Automod reason:</span>{' '}
          {item.automod_reason || 'No reason provided'}
        </p>
      )}

      <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
        Rated by
        <Link
          to={`/user/${item.pilot_username}`}
          className="flex min-w-0 items-center gap-1.5 text-foreground hover:underline"
        >
          <UserAvatar
            userId={item.pilot_id}
            avatar={item.pilot_avatar}
            name={item.pilot_username ?? 'Pilot'}
            size="sm"
            iconFallback
          />
          <span className="truncate">{item.pilot_username ?? 'Unknown'}</span>
        </Link>
      </p>
    </li>
  );

  const renderIndividual = () => (
    <>
      <AdminToolbar>
        <AdminSearchInput
          value={ratingsSearch}
          onChange={setRatingsSearch}
          placeholder="Search by controller or pilot username…"
          loading={ratingsLoading}
        />
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <AdminSelect
            options={RATING_FILTER_OPTIONS}
            value={ratingsFilter}
            onChange={setRatingsFilter}
            aria-label="Filter by rating"
            className="sm:w-40"
          />
          <AdminSelect
            options={FLAG_FILTER_OPTIONS}
            value={ratingsFlagFilter}
            onChange={setRatingsFlagFilter}
            aria-label="Filter by flag"
            className="sm:w-44"
          />
          <Toggle
            variant="outline"
            pressed={ratingsHasCommentOnly}
            onPressedChange={setRatingsHasCommentOnly}
            aria-label="Only show ratings with a comment"
            className="col-span-2 px-3 sm:col-span-1"
          >
            <MessageSquare />
            Has comment
          </Toggle>
        </div>
      </AdminToolbar>

      {ratingsLoading ? (
        <AdminLoading label="Loading ratings…" />
      ) : ratingsError ? (
        <AdminErrorState
          title="Error loading ratings"
          message={ratingsError}
          onRetry={fetchRatingsList}
        />
      ) : ratings.length === 0 ? (
        <AdminEmptyState icon={Star} title="No ratings found" />
      ) : (
        <>
          <ul className="divide-y rounded-2xl border">
            {ratings.map(renderRatingRow)}
          </ul>

          <div className="flex flex-col items-center justify-end gap-3 sm:flex-row">
            <p className="text-sm text-muted-foreground tabular-nums">
              Page {ratingsPage} of {Math.max(1, ratingsPages)} ·{' '}
              {ratingsTotal.toLocaleString()} total
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRatingsPage(Math.max(1, ratingsPage - 1))}
                disabled={ratingsPage === 1}
              >
                <ChevronLeft />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setRatingsPage(Math.min(ratingsPages, ratingsPage + 1))
                }
                disabled={ratingsPage >= ratingsPages}
              >
                Next
                <ChevronRight />
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  );

  return (
    <AdminLayout toast={toast} onToastClose={() => setToast(null)}>
      <AdminPage
        title="Controller Ratings"
        icon={ThumbsUp}
        actions={
          <Tabs
            value={view}
            onValueChange={(v) => setView(v as 'overview' | 'individual')}
          >
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="individual">Individual feedback</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      >
        {view === 'overview' && (
          <>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={String(timeRange)}
              onValueChange={(v) => {
                if (v) setTimeRange(Number(v));
              }}
              aria-label="Time range"
            >
              {TIME_RANGES.map((days) => (
                <ToggleGroupItem
                  key={days}
                  value={String(days)}
                  className="px-3"
                >
                  {days} days
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            {renderOverview()}
          </>
        )}

        {view === 'individual' && renderIndividual()}
      </AdminPage>
      {confirmDialog}
    </AdminLayout>
  );
}
