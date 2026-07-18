import { useState, useEffect } from 'react';
import {
  MdStar,
  MdMessage,
  MdDelete,
  MdPeople,
  MdOutlineChatBubbleOutline,
} from 'react-icons/md';
import AdminRefreshButton from '../../components/admin/AdminRefreshButton';
import AdminLayout from '../../components/admin/AdminLayout';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminStatStrip from '../../components/admin/AdminStatStrip';
import AdminToolbar from '../../components/admin/AdminToolbar';
import AdminSearchInput from '../../components/admin/AdminSearchInput';
import {
  adminDownsizeButtonSize,
  adminSectionClass,
  ADMIN_TOOLBAR_MOBILE_COL,
  ADMIN_TOOLBAR_MOBILE_SEARCH,
  ADMIN_TOOLBAR_MOBILE_SPLIT_ITEM,
  ADMIN_TOOLBAR_MOBILE_SPLIT_ROW,
  ADMIN_SEGMENT_ACTIVE,
  ADMIN_SEGMENT_INACTIVE,
} from '../../components/admin/adminConstants';
import Loader from '../../components/common/Loader';
import Button from '../../components/common/Button';
import ErrorScreen from '../../components/common/ErrorScreen';
import Dropdown from '../../components/common/Dropdown';
import {
  fetchFeedback,
  fetchFeedbackStats,
  deleteFeedback,
  type Feedback,
  type FeedbackStats,
} from '../../utils/fetch/feedback';

export default function AdminFeedback() {
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [feedbackStats, setFeedbackStats] = useState<FeedbackStats | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterRating, setFilterRating] = useState<string>('all');
  const [onlyWithText, setOnlyWithText] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  const filterOptions = [
    { value: 'all', label: 'All Ratings' },
    { value: '5', label: '5 Stars' },
    { value: '4', label: '4 Stars' },
    { value: '3', label: '3 Stars' },
    { value: '2', label: '2 Stars' },
    { value: '1', label: '1 Star' },
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [stats, feedbackData] = await Promise.all([
        fetchFeedbackStats(),
        fetchFeedback(),
      ]);
      setFeedbackStats(stats);
      setFeedback(feedbackData);
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

  const feedbackHasText = (item: Feedback) => {
    const categoryData = parseCategoryRatings(item.comment);
    if (categoryData) return Boolean(categoryData.additionalComment);
    return Boolean(item.comment && item.comment.trim().length > 0);
  };

  const filteredFeedback = feedback.filter((item) => {
    const matchesSearch =
      item.username.toLowerCase().includes(search.toLowerCase()) ||
      (item.comment &&
        item.comment.toLowerCase().includes(search.toLowerCase()));
    const matchesRating =
      filterRating === 'all' || item.rating.toString() === filterRating;
    const matchesText = !onlyWithText || feedbackHasText(item);
    return matchesSearch && matchesRating && matchesText;
  });

  const handleDeleteFeedback = async (id: number) => {
    if (!confirm('Are you sure you want to delete this feedback?')) return;

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

  const renderStars = (rating: number) => {
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
  };

  return (
    <AdminLayout toast={toast} onToastClose={() => setToast(null)}>
      <AdminPageHeader
        title="Feedback Management"
        icon={MdStar}
        accent="yellow"
        actions={
          <AdminRefreshButton
            onClick={fetchData}
            loading={loading}
            className="max-md:hidden"
          />
        }
      />

      <AdminToolbar className={ADMIN_TOOLBAR_MOBILE_COL}>
        <AdminSearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by username or comment…"
          loading={loading}
          className={ADMIN_TOOLBAR_MOBILE_SEARCH}
        />
        <div className={ADMIN_TOOLBAR_MOBILE_SPLIT_ROW}>
          <Dropdown
            options={filterOptions}
            value={filterRating}
            onChange={setFilterRating}
            size="sm"
            className={ADMIN_TOOLBAR_MOBILE_SPLIT_ITEM}
          />
          <button
            type="button"
            onClick={() => setOnlyWithText((v) => !v)}
            aria-pressed={onlyWithText}
            className={`flex items-center justify-center gap-1.5 h-full px-3 py-2 rounded-full text-sm whitespace-nowrap transition-colors ${ADMIN_TOOLBAR_MOBILE_SPLIT_ITEM} ${
              onlyWithText
                ? ADMIN_SEGMENT_ACTIVE
                : `border-2 border-blue-600 bg-gray-800 ${ADMIN_SEGMENT_INACTIVE}`
            }`}
          >
            <MdOutlineChatBubbleOutline size={16} />
            <span>With text</span>
          </button>
          <AdminRefreshButton
            onClick={fetchData}
            loading={loading}
            className={`md:hidden shrink-0 ${ADMIN_TOOLBAR_MOBILE_SPLIT_ITEM}`}
          />
        </div>
      </AdminToolbar>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader />
        </div>
      ) : error ? (
        <ErrorScreen
          title="Error loading feedback"
          message={error}
          onRetry={fetchData}
        />
      ) : (
        <>
          {feedbackStats && (
            <AdminStatStrip
              columns={4}
              items={[
                {
                  label: 'Average',
                  value:
                    Number(feedbackStats.average_rating)?.toFixed(1) || '0.0',
                },
                { label: 'Total', value: feedbackStats.total_feedback },
                { label: '5 stars', value: feedbackStats.five_star },
                { label: '4 stars', value: feedbackStats.four_star },
                { label: '3 stars', value: feedbackStats.three_star },
                { label: '2 stars', value: feedbackStats.two_star },
                { label: '1 star', value: feedbackStats.one_star },
              ]}
            />
          )}

          <div className={adminSectionClass('!mt-0 !pt-0 !border-t-0')}>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredFeedback.length === 0 ? (
                <div className="col-span-full text-center py-8 text-zinc-400">
                  No feedback found matching your criteria.
                </div>
              ) : (
                filteredFeedback.map((item) => {
                  const categoryData = parseCategoryRatings(item.comment);

                  return (
                    <div
                      key={item.id}
                      className="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-3"
                    >
                      <div className="flex flex-col space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            {item.avatar ? (
                              <img
                                src={`https://cdn.discordapp.com/avatars/${item.user_id}/${item.avatar}.png`}
                                alt={item.username}
                                className="w-8 h-8 rounded-full"
                              />
                            ) : (
                              <div className="w-8 h-8 bg-zinc-600 rounded-full flex items-center justify-center">
                                <MdPeople size={16} className="text-zinc-400" />
                              </div>
                            )}
                            <div>
                              <div className="font-medium text-white">
                                {item.username}
                              </div>
                              <div className="text-xs text-zinc-500">
                                {item.user_id}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="text-xs text-zinc-500">
                              {new Date(item.created_at).toLocaleDateString()}
                            </div>
                            <Button
                              variant="ghost"
                              size={adminDownsizeButtonSize('sm')}
                              onClick={() => handleDeleteFeedback(item.id)}
                              className="p-1 text-red-400 hover:text-red-300"
                            >
                              <MdDelete size={16} />
                            </Button>
                          </div>
                        </div>

                        {categoryData ? (
                          <>
                            <div className="bg-zinc-800/50 rounded-lg p-2 space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-zinc-400">UI</span>
                                {renderStars(categoryData.ui)}
                              </div>
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-zinc-400">
                                  Performance
                                </span>
                                {renderStars(categoryData.performance)}
                              </div>
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-zinc-400">
                                  Global Chat and ACARS
                                </span>
                                {renderStars(categoryData.features)}
                              </div>
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-zinc-400">
                                  Ease of Use
                                </span>
                                {renderStars(categoryData.easeOfUse)}
                              </div>
                              <div className="flex items-center justify-between text-xs border-t border-zinc-700 pt-1 mt-1">
                                <span className="text-zinc-300 font-semibold">
                                  Overall
                                </span>
                                {renderStars(categoryData.overall)}
                              </div>
                            </div>

                            {categoryData.additionalComment && (
                              <div className="flex items-start space-x-2">
                                <MdMessage
                                  size={18}
                                  className="text-zinc-400 mt-0.5 shrink-0"
                                />
                                <p className="text-sm text-zinc-300 break-words">
                                  {categoryData.additionalComment}
                                </p>
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <div className="flex justify-left">
                              {renderStars(item.rating)}
                            </div>
                            {item.comment && (
                              <div className="flex items-start space-x-2">
                                <MdMessage
                                  size={18}
                                  className="text-zinc-400 mt-0.5 shrink-0"
                                />
                                <p className="text-sm text-zinc-300 break-words">
                                  {item.comment}
                                </p>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  );
}
