import { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  MessageSquareText,
  MessagesSquare,
  Star,
  Trash2,
  UserRound,
} from 'lucide-react';
import AdminRefreshButton from '../../components/admin/AdminRefreshButton';
import AdminLayout from '../../components/admin/AdminLayout';
import AdminPage from '../../components/admin/AdminPage';
import AdminSelect from '../../components/admin/AdminSelect';
import AdminStatCards from '../../components/admin/AdminStatCards';
import AdminToolbar from '../../components/admin/AdminToolbar';
import AdminSearchInput from '../../components/admin/AdminSearchInput';
import {
  AdminEmptyState,
  AdminErrorState,
  AdminLoading,
} from '../../components/admin/AdminStates';
import { ADMIN_CHART_COLORS } from '../../components/admin/adminConstants';
import { useAdminConfirm } from '../../components/admin/useAdminConfirm';
import {
  fetchFeedback,
  fetchFeedbackStats,
  deleteFeedback,
  type Feedback,
  type FeedbackStats,
} from '../../utils/fetch/feedback';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

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
            'size-3.5',
            star <= rating
              ? 'fill-amber-400 text-amber-400'
              : 'text-muted-foreground/40'
          )}
          aria-hidden
        />
      ))}
    </div>
  );
}

function CommentText({ children }: { children: string }) {
  return <p className="text-sm break-words whitespace-pre-wrap">{children}</p>;
}

const PAGE_SIZE = 25;

export default function AdminFeedback() {
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [feedbackStats, setFeedbackStats] = useState<FeedbackStats | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterRating, setFilterRating] = useState<string>('all');
  const [onlyWithText, setOnlyWithText] = useState(false);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);
  const { confirm, confirmDialog } = useAdminConfirm();

  const filterOptions = [
    { value: 'all', label: 'All ratings' },
    { value: '5', label: '5 stars' },
    { value: '4', label: '4 stars' },
    { value: '3', label: '3 stars' },
    { value: '2', label: '2 stars' },
    { value: '1', label: '1 star' },
  ];

  useEffect(() => {
    if (search === debouncedSearch) return;
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, debouncedSearch]);

  const fetchStats = useCallback(async () => {
    try {
      setFeedbackStats(await fetchFeedbackStats());
    } catch (err) {
      setToast({
        message:
          err instanceof Error ? err.message : 'Failed to fetch feedback stats',
        type: 'error',
      });
    }
  }, []);

  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchFeedback({
        page,
        limit: PAGE_SIZE,
        search: debouncedSearch,
        rating: filterRating === 'all' ? undefined : Number(filterRating),
        withText: onlyWithText,
      });
      setFeedback(result.feedback);
      setPages(result.pagination.pages);
      setTotal(result.pagination.total);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch feedback';
      setError(errorMessage);
      setToast({
        message: errorMessage,
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, filterRating, onlyWithText]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const fetchData = () => {
    fetchStats();
    fetchList();
  };

  const parseCategoryRatings = (comment: string | null | undefined) => {
    if (!comment) return null;
    const categoryRegex =
      /UI:\s*(\d+)\/5,\s*Performance:\s*(\d+)\/5,\s*Features:\s*(\d+)\/5,\s*Ease of Use:\s*(\d+)\/5,\s*Overall:\s*(\d+)\/5/;
    const match = comment.match(categoryRegex);

    if (match) {
      return {
        ui: parseInt(match[1]),
        performance: parseInt(match[2]),
        features: parseInt(match[3]),
        easeOfUse: parseInt(match[4]),
        overall: parseInt(match[5]),
        additionalComment: comment.split('\n\n')[1] || null,
      };
    }

    return null;
  };

  const handleDeleteFeedback = async (id: number) => {
    if (
      !(await confirm({
        title: 'Delete feedback?',
        description:
          'Are you sure you want to delete this feedback? This action cannot be undone.',
        confirmText: 'Delete',
        destructive: true,
      }))
    )
      return;

    try {
      await deleteFeedback(id);
      setToast({
        message: 'Feedback deleted successfully',
        type: 'success',
      });
      fetchData();
    } catch (err) {
      setToast({
        message:
          err instanceof Error ? err.message : 'Failed to delete feedback',
        type: 'error',
      });
    }
  };

  const distribution = feedbackStats
    ? [
        { label: '5 stars', value: feedbackStats.five_star },
        { label: '4 stars', value: feedbackStats.four_star },
        { label: '3 stars', value: feedbackStats.three_star },
        { label: '2 stars', value: feedbackStats.two_star },
        { label: '1 star', value: feedbackStats.one_star },
      ]
    : [];
  const maxBucket = Math.max(1, ...distribution.map((d) => Number(d.value)));

  return (
    <AdminLayout toast={toast} onToastClose={() => setToast(null)}>
      <AdminPage
        title="Feedback"
        icon={MessagesSquare}
        actions={<AdminRefreshButton onClick={fetchData} loading={loading} />}
      >
        <AdminToolbar>
          <AdminSearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by username or comment…"
            loading={search !== debouncedSearch || loading}
          />
          <AdminSelect
            options={filterOptions}
            value={filterRating}
            onChange={(value) => {
              setFilterRating(value);
              setPage(1);
            }}
            aria-label="Filter by rating"
            className="sm:w-40"
          />
          <Toggle
            variant="outline"
            pressed={onlyWithText}
            onPressedChange={(pressed) => {
              setOnlyWithText(pressed);
              setPage(1);
            }}
            aria-label="Only show feedback with text"
          >
            <MessageSquareText />
            With text
          </Toggle>
        </AdminToolbar>

        {feedbackStats && (
          <div className="grid items-center gap-4 lg:grid-cols-3">
            <AdminStatCards
              columns={2}
              className="lg:col-span-2"
              items={[
                {
                  label: 'Average rating',
                  value: (
                    <>
                      {Number(feedbackStats.average_rating)?.toFixed(1) ||
                        '0.0'}
                      <span className="text-sm font-normal text-muted-foreground">
                        {' '}
                        / 5
                      </span>
                    </>
                  ),
                },
                {
                  label: 'Total feedback',
                  value: feedbackStats.total_feedback,
                },
              ]}
            />
            <div className="grid gap-2" aria-label="Rating distribution">
              {distribution.map((d) => (
                <div
                  key={d.label}
                  className="grid grid-cols-[3.5rem_1fr_2.5rem] items-center gap-2 text-xs"
                >
                  <span className="text-muted-foreground">{d.label}</span>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(Number(d.value) / maxBucket) * 100}%`,
                        backgroundColor: ADMIN_CHART_COLORS.amber,
                      }}
                    />
                  </div>
                  <span className="text-right font-medium tabular-nums">
                    {Number(d.value).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <AdminLoading label="Loading feedback…" />
        ) : error ? (
          <AdminErrorState
            title="Error loading feedback"
            message={error}
            onRetry={fetchList}
          />
        ) : feedback.length === 0 ? (
          <AdminEmptyState icon={MessagesSquare} title="No feedback found" />
        ) : (
          <>
            <div className="divide-y overflow-hidden rounded-2xl border">
              {feedback.map((item) => {
                const categoryData = parseCategoryRatings(item.comment);

                return (
                  <div key={item.id} className="flex flex-col gap-2 px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar>
                          {item.avatar ? (
                            <AvatarImage
                              src={`https://cdn.discordapp.com/avatars/${item.user_id}/${item.avatar}.png`}
                              alt={item.username}
                            />
                          ) : null}
                          <AvatarFallback>
                            <UserRound className="size-4" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {item.username}
                          </p>
                          <p className="truncate font-mono text-xs text-muted-foreground">
                            {item.user_id}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {new Date(item.created_at).toLocaleDateString()}
                        </span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => handleDeleteFeedback(item.id)}
                              className="text-destructive hover:text-destructive"
                              aria-label="Delete feedback"
                            >
                              <Trash2 />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete feedback</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>

                    {categoryData ? (
                      <>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Overall</span>
                            <Stars rating={categoryData.overall} />
                          </div>
                          {[
                            { label: 'UI', value: categoryData.ui },
                            {
                              label: 'Performance',
                              value: categoryData.performance,
                            },
                            {
                              label: 'Global Chat and ACARS',
                              value: categoryData.features,
                            },
                            {
                              label: 'Ease of Use',
                              value: categoryData.easeOfUse,
                            },
                          ].map((row) => (
                            <div
                              key={row.label}
                              className="flex items-center gap-2"
                            >
                              <span className="text-muted-foreground">
                                {row.label}
                              </span>
                              <Stars rating={row.value} />
                            </div>
                          ))}
                        </div>

                        {categoryData.additionalComment && (
                          <CommentText>
                            {categoryData.additionalComment}
                          </CommentText>
                        )}
                      </>
                    ) : (
                      <>
                        <Stars rating={item.rating} />
                        {item.comment && (
                          <CommentText>{item.comment}</CommentText>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col items-center justify-end gap-3 sm:flex-row">
              <p className="text-sm text-muted-foreground tabular-nums">
                Page {page} of {Math.max(1, pages)} · {total.toLocaleString()}{' '}
                total
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.min(pages, page + 1))}
                  disabled={page >= pages}
                >
                  Next
                  <ChevronRight />
                </Button>
              </div>
            </div>
          </>
        )}
      </AdminPage>
      {confirmDialog}
    </AdminLayout>
  );
}
