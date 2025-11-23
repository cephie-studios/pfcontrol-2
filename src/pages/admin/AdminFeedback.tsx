import { useState, useEffect } from 'react';
import {
  Star,
  MessageCircle,
  Trash2,
  Search,
  RefreshCw,
  Menu,
} from 'lucide-react';
import { Users } from 'lucide-react';
import Navbar from '../../components/Navbar';
import AdminSidebar from '../../components/admin/AdminSidebar';
import Loader from '../../components/common/Loader';
import Button from '../../components/common/Button';
import Toast from '../../components/common/Toast';
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [feedbackStats, setFeedbackStats] = useState<FeedbackStats | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterRating, setFilterRating] = useState<string>('all');
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

  const filteredFeedback = feedback.filter((item) => {
    const matchesSearch =
      item.username.toLowerCase().includes(search.toLowerCase()) ||
      (item.comment &&
        item.comment.toLowerCase().includes(search.toLowerCase()));
    const matchesRating =
      filterRating === 'all' || item.rating.toString() === filterRating;
    return matchesSearch && matchesRating;
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
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= rating
                ? 'text-yellow-400 fill-yellow-400'
                : 'text-zinc-600'
            }`}
          />
        ))}
      </div>
    );
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

  return (
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
          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="lg:hidden fixed bottom-6 right-6 z-30 p-4 bg-yellow-600 hover:bg-yellow-700 rounded-full shadow-lg transition-colors"
          >
            <Menu className="h-6 w-6 text-white" />
          </button>

          {/* Header */}
          <div className="mb-6 sm:mb-8">
            <div className="flex items-center mb-4">
              <Star className="h-8 w-8 sm:h-10 sm:w-10 text-yellow-400 mr-4 mb-1" />
              <div>
                <h1
                  className="text-3xl sm:text-4xl lg:text-5xl text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600 font-extrabold mb-2"
                  style={{ lineHeight: 1.4 }}
                >
                  Feedback Management
                </h1>
              </div>
            </div>

            {/* Search and Filter */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <div className="flex-1 relative group">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-zinc-400 group-focus-within:text-yellow-400 transition-colors" />
                <input
                  type="text"
                  placeholder="Search by username or comment..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-zinc-900/50 border-2 border-zinc-700 rounded-full text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 transition-all duration-200 hover:border-zinc-600"
                />
              </div>
              <Dropdown
                options={filterOptions}
                value={filterRating}
                onChange={setFilterRating}
                size="md"
              />
              <Button
                onClick={fetchData}
                variant="outline"
                size="sm"
                className="px-4 py-3 flex items-center space-x-2"
                disabled={loading}
              >
                <RefreshCw
                  className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
                />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
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
              {/* Stats Cards */}
              {feedbackStats && (
                <div className="space-y-4 mb-6">
                  {/* Star Ratings */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-4">
                    <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-yellow-400">
                        {Number(feedbackStats.average_rating)?.toFixed(1) ||
                          '0.0'}
                      </div>
                      <div className="text-xs text-zinc-400">Average</div>
                    </div>
                    <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-white">
                        {feedbackStats.total_feedback}
                      </div>
                      <div className="text-xs text-zinc-400">Total</div>
                    </div>
                    <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                      <div className="flex flex-col items-center space-y-1">
                        {renderStars(5)}
                        <div className="text-lg font-bold text-green-400">
                          {feedbackStats.five_star}
                        </div>
                      </div>
                    </div>
                    <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                      <div className="flex flex-col items-center space-y-1">
                        {renderStars(4)}
                        <div className="text-lg font-bold text-blue-400">
                          {feedbackStats.four_star}
                        </div>
                      </div>
                    </div>
                    <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                      <div className="flex flex-col items-center space-y-1">
                        {renderStars(3)}
                        <div className="text-lg font-bold text-yellow-400">
                          {feedbackStats.three_star}
                        </div>
                      </div>
                    </div>
                    <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                      <div className="flex flex-col items-center space-y-1">
                        {renderStars(2)}
                        <div className="text-lg font-bold text-orange-400">
                          {feedbackStats.two_star}
                        </div>
                      </div>
                    </div>
                    <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                      <div className="flex flex-col items-center space-y-1">
                        {renderStars(1)}
                        <div className="text-lg font-bold text-red-400">
                          {feedbackStats.one_star}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Feedback List */}
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
                        className="bg-zinc-900 border-2 border-zinc-700/50 rounded-xl p-3"
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
                                  <Users className="w-4 h-4 text-zinc-400" />
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
                                size="sm"
                                onClick={() => handleDeleteFeedback(item.id)}
                                className="p-1 text-red-400 hover:text-red-300"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>

                          {categoryData ? (
                            <>
                              {/* Category Ratings */}
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

                              {/* Additional Comment */}
                              {categoryData.additionalComment && (
                                <div className="flex items-start space-x-2">
                                  <MessageCircle className="w-4 h-4 text-zinc-400 mt-0.5 flex-shrink-0" />
                                  <p className="text-sm text-zinc-300 break-words">
                                    {categoryData.additionalComment}
                                  </p>
                                </div>
                              )}
                            </>
                          ) : (
                            <>
                              {/* Legacy single rating */}
                              <div className="flex justify-left">
                                {renderStars(item.rating)}
                              </div>
                              {item.comment && (
                                <div className="flex items-start space-x-2">
                                  <MessageCircle className="w-4 h-4 text-zinc-400 mt-0.5 flex-shrink-0" />
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
            </>
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
