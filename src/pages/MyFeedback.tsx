import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Star, MessageSquare, Flag } from 'lucide-react';
import Navbar from '../components/Navbar';
import Button from '../components/common/Button';
import ErrorScreen from '../components/common/ErrorScreen';
import Modal from '../components/common/Modal';
import Toast from '../components/common/Toast';
import { useSettings } from '../hooks/settings/useSettings';
import { fetchBackgrounds } from '../utils/fetch/data';
import { AdminAreaChart } from '../components/admin/AdminChart';
import {
  fetchMyRatings,
  fetchMyRatingStats,
  fetchMyRatingsDaily,
  fetchMyRatingsDistribution,
  reportMyRating,
  type MyControllerRating,
  type MyControllerRatingStats,
  type MyDailyRatingStats,
  type MyRatingDistributionBucket,
} from '../utils/fetch/ratings';
import type { ToastType } from '../components/common/Toast';

const MAX_REPORT_REASON_LENGTH = 500;

const API_BASE_URL = import.meta.env.VITE_SERVER_URL;

interface AvailableImage {
  filename: string;
  path: string;
  extension: string;
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-4 h-4 ${
            star <= rating ? 'fill-yellow-500 text-yellow-500' : 'text-zinc-700'
          }`}
        />
      ))}
    </div>
  );
}

function RatingDistribution({
  buckets,
}: {
  buckets: MyRatingDistributionBucket[];
}) {
  const max = Math.max(...buckets.map((b) => b.count), 1);

  return (
    <div className="space-y-2">
      {buckets.map(({ rating, count }) => (
        <div key={rating} className="flex items-center gap-3">
          <span className="w-8 text-sm text-zinc-400 flex items-center gap-1 shrink-0">
            {rating}
            <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
          </span>
          <div className="flex-1 h-3 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full bg-yellow-500 rounded-full transition-all duration-300"
              style={{ width: `${(count / max) * 100}%` }}
            />
          </div>
          <span className="w-6 text-sm text-zinc-400 text-right shrink-0">
            {count}
          </span>
        </div>
      ))}
    </div>
  );
}

function FeedbackEntry({
  entry,
  onReport,
}: {
  entry: MyControllerRating;
  onReport: (id: number) => void;
}) {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-2">
        <StarRow rating={entry.rating} />
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500">
            {new Date(entry.created_at).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
          {entry.automod_flagged ? (
            <div className="relative group inline-block">
              <img
                src="/assets/images/automod.webp"
                alt="Flagged by automod"
                className="w-4 h-4 cursor-help rounded-full"
              />
              <div className="absolute bottom-full right-0 mb-2 w-56 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg z-[9999]">
                <div className="px-3 py-1.5 bg-zinc-900/95 backdrop-blur-md rounded-lg border border-zinc-700">
                  <p className="text-xs text-white">
                    This comment was already flagged by automod. Wait for a
                    moderator to review it.
                  </p>
                </div>
              </div>
            </div>
          ) : entry.reported ? (
            <span className="text-xs text-zinc-600">Reported</span>
          ) : (
            <button
              type="button"
              onClick={() => onReport(entry.id)}
              className="text-zinc-600 hover:text-red-400 transition-colors"
              title="Report this comment"
              aria-label="Report this comment"
            >
              <Flag className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      {entry.comment && (
        <p className="text-sm text-zinc-300 whitespace-pre-wrap">
          {entry.comment}
        </p>
      )}
    </div>
  );
}

export default function MyFeedback() {
  const { settings } = useSettings();
  const [stats, setStats] = useState<MyControllerRatingStats | null>(null);
  const [dailyStats, setDailyStats] = useState<MyDailyRatingStats[]>([]);
  const [distribution, setDistribution] = useState<
    MyRatingDistributionBucket[]
  >([]);
  const [ratings, setRatings] = useState<MyControllerRating[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [timeRange, setTimeRange] = useState(30);
  const [loading, setLoading] = useState(true);
  const [chartsLoading, setChartsLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableImages, setAvailableImages] = useState<AvailableImage[]>([]);
  const [customLoaded, setCustomLoaded] = useState(false);
  const [reportingId, setReportingId] = useState<number | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: ToastType;
  } | null>(null);

  const handleReportClick = (id: number) => {
    setReportingId(id);
    setReportReason('');
  };

  const handleSubmitReport = async () => {
    if (!reportingId || !reportReason.trim()) return;
    setSubmittingReport(true);
    try {
      await reportMyRating(reportingId, reportReason.trim());
      setRatings((prev) =>
        prev.map((r) => (r.id === reportingId ? { ...r, reported: true } : r))
      );
      setToast({ message: 'Comment reported for review.', type: 'success' });
      setReportingId(null);
      setReportReason('');
    } catch (err) {
      setToast({
        message:
          err instanceof Error ? err.message : 'Failed to report comment',
        type: 'error',
      });
    } finally {
      setSubmittingReport(false);
    }
  };

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [statsData, dailyData, distributionData, ratingsData] =
        await Promise.all([
          fetchMyRatingStats(),
          fetchMyRatingsDaily(timeRange),
          fetchMyRatingsDistribution(timeRange),
          fetchMyRatings(page, 20),
        ]);
      setStats(statsData);
      setDailyStats(dailyData);
      setDistribution(distributionData);
      setRatings(ratingsData.ratings);
      setPages(ratingsData.pagination.pages);
    } catch (err) {
      console.error('Error fetching feedback:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch feedback');
    } finally {
      setLoading(false);
    }
  }, [timeRange, page]);

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const skipDailyFetch = useRef(true);
  useEffect(() => {
    if (skipDailyFetch.current) {
      skipDailyFetch.current = false;
      return;
    }
    let cancelled = false;
    setChartsLoading(true);
    Promise.all([
      fetchMyRatingsDaily(timeRange),
      fetchMyRatingsDistribution(timeRange),
    ])
      .then(([dailyData, distributionData]) => {
        if (!cancelled) {
          setDailyStats(dailyData);
          setDistribution(distributionData);
        }
      })
      .catch((err) => {
        console.error('Error fetching daily stats:', err);
      })
      .finally(() => {
        if (!cancelled) setChartsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [timeRange]);

  const skipRatingsFetch = useRef(true);
  useEffect(() => {
    if (skipRatingsFetch.current) {
      skipRatingsFetch.current = false;
      return;
    }
    let cancelled = false;
    setListLoading(true);
    fetchMyRatings(page, 20)
      .then((data) => {
        if (!cancelled) {
          setRatings(data.ratings);
          setPages(data.pagination.pages);
        }
      })
      .catch((err) => {
        console.error('Error fetching ratings:', err);
      })
      .finally(() => {
        if (!cancelled) setListLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page]);

  useEffect(() => {
    const loadImages = async () => {
      try {
        const data = await fetchBackgrounds();
        setAvailableImages(data);
      } catch (fetchError) {
        console.error('Error loading available images:', fetchError);
      }
    };
    loadImages();
  }, []);

  const backgroundImage = useMemo(() => {
    const selectedImage = settings?.backgroundImage?.selectedImage;
    let bgImage = 'url("/assets/images/hero.webp")';

    const getImageUrl = (filename: string | null): string | null => {
      if (!filename || filename === 'random' || filename === 'favorites') {
        return filename;
      }
      if (filename.startsWith('https://api.cephie.app/')) {
        return filename;
      }
      return `${API_BASE_URL}/assets/app/backgrounds/${filename}`;
    };

    if (selectedImage === 'random') {
      if (availableImages.length > 0) {
        const randomIndex = Math.floor(Math.random() * availableImages.length);
        bgImage = `url(${API_BASE_URL}${availableImages[randomIndex].path})`;
      }
    } else if (selectedImage === 'favorites') {
      const favorites = settings?.backgroundImage?.favorites || [];
      if (favorites.length > 0) {
        const randomFav =
          favorites[Math.floor(Math.random() * favorites.length)];
        const favImageUrl = getImageUrl(randomFav);
        if (
          favImageUrl &&
          favImageUrl !== 'random' &&
          favImageUrl !== 'favorites'
        ) {
          bgImage = `url(${favImageUrl})`;
        }
      }
    } else if (selectedImage) {
      const imageUrl = getImageUrl(selectedImage);
      if (imageUrl && imageUrl !== 'random' && imageUrl !== 'favorites') {
        bgImage = `url(${imageUrl})`;
      }
    }

    return bgImage;
  }, [
    settings?.backgroundImage?.selectedImage,
    settings?.backgroundImage?.favorites,
    availableImages,
  ]);

  useEffect(() => {
    if (backgroundImage !== 'url("/assets/images/hero.webp")') {
      setCustomLoaded(true);
    }
  }, [backgroundImage]);

  const avgRatingData = useMemo(
    () =>
      dailyStats.map((d) => ({
        label: d.date,
        value: Number(d.avg_rating),
      })),
    [dailyStats]
  );

  const heroBackground = (
    <div className="absolute inset-0">
      <img
        src="/assets/images/hero.webp"
        alt="Banner"
        className="object-cover w-full h-full scale-110"
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          opacity: customLoaded ? 1 : 0,
          transition: 'opacity 0.5s ease-in-out',
        }}
      />
      <div className="absolute inset-0 bg-linear-to-b from-zinc-950/40 via-zinc-950/70 to-zinc-950" />
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white relative">
        <Navbar />
        <div className="relative w-full h-80 md:h-96 overflow-hidden">
          {heroBackground}
          <div className="relative h-full flex flex-col items-center justify-center px-6 md:px-10">
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white tracking-tight text-center mb-6">
              MY FEEDBACK
            </h1>
            <div className="flex gap-3 animate-pulse">
              <div className="h-10 w-32 rounded-full bg-zinc-700/60" />
              <div className="h-10 w-32 rounded-full bg-zinc-700/60" />
            </div>
          </div>
        </div>
        <div className="container mx-auto max-w-7xl px-4 pb-8 -mt-6 md:-mt-8 relative z-10">
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="h-24 rounded-2xl bg-zinc-800/50 border-2 border-zinc-700 animate-pulse" />
              <div className="h-24 rounded-2xl bg-zinc-800/50 border-2 border-zinc-700 animate-pulse" />
            </div>
            <div className="h-48 rounded-2xl bg-zinc-800/50 border-2 border-zinc-700 animate-pulse" />
            <div className="h-48 rounded-2xl bg-zinc-800/50 border-2 border-zinc-700 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white relative">
      <Navbar />

      <div className="relative w-full h-80 md:h-96 overflow-hidden">
        {heroBackground}

        <div className="relative h-full flex flex-col items-center justify-center px-6 md:px-10">
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white tracking-tight text-center mb-6">
            MY FEEDBACK
          </h1>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full px-4">
            <div className="flex items-center justify-center gap-2 px-6 py-4 bg-blue-950 backdrop-blur-md border border-blue-950 rounded-full shadow-lg h-12 sm:h-auto">
              <MessageSquare className="h-5 w-5 text-blue-400" />
              <span className="text-blue-400 text-sm font-semibold tracking-wider whitespace-nowrap">
                {stats?.ratingCount ?? 0} RATING
                {(stats?.ratingCount ?? 0) === 1 ? '' : 'S'}
              </span>
            </div>
            {stats && stats.ratingCount > 0 && (
              <div className="flex items-center justify-center gap-2 px-6 py-4 bg-yellow-950 backdrop-blur-md border border-amber-950 rounded-full shadow-lg h-12 sm:h-auto">
                <Star className="h-5 w-5 text-amber-400 fill-amber-400" />
                <span className="text-amber-300 text-sm font-semibold tracking-wider whitespace-nowrap">
                  {stats.averageRating.toFixed(1)} AVERAGE
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-7xl px-4 pb-8 -mt-6 md:-mt-8 relative z-10">
        <div className="p-6 space-y-6">
          <div className="flex justify-end gap-2">
            {[7, 30, 90].map((days) => (
              <Button
                key={days}
                onClick={() => setTimeRange(days)}
                variant={timeRange === days ? 'primary' : 'outline'}
                size="sm"
                disabled={chartsLoading}
              >
                {days} days
              </Button>
            ))}
          </div>

          {error ? (
            <ErrorScreen
              title="Error loading feedback"
              message={error}
              onRetry={fetchAll}
            />
          ) : (
            stats && (
              <div className="space-y-8">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-zinc-400 mb-1">Average Rating</p>
                    <div className="flex items-center gap-2">
                      <span className="text-3xl font-bold text-white">
                        {stats.ratingCount > 0
                          ? stats.averageRating.toFixed(1)
                          : '—'}
                      </span>
                      {stats.ratingCount > 0 && (
                        <StarRow rating={Math.round(stats.averageRating)} />
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-zinc-400 mb-1">Total Ratings</p>
                    <span className="text-3xl font-bold text-white">
                      {stats.ratingCount}
                    </span>
                  </div>
                </div>

                {stats.ratingCount > 0 ? (
                  <>
                    <div className="space-y-8">
                      <div>
                        <h2 className="text-sm font-semibold text-zinc-300 mb-1">
                          Rating breakdown
                        </h2>
                        <p className="text-xs text-zinc-500 mb-3">
                          How your stars break down in this range
                        </p>
                        {chartsLoading ? (
                          <div className="h-[180px] rounded-xl bg-zinc-800/50 border border-zinc-800 animate-pulse" />
                        ) : (
                          <RatingDistribution buckets={distribution} />
                        )}
                      </div>
                      <div>
                        <h2 className="text-sm font-semibold text-zinc-300 mb-1">
                          Average rating
                        </h2>
                        <p className="text-xs text-zinc-500 mb-2">
                          Hover for daily values
                        </p>
                        {chartsLoading ? (
                          <div className="h-[180px] rounded-xl bg-zinc-800/50 border border-zinc-800 animate-pulse" />
                        ) : dailyStats.length < 3 ? (
                          <div className="h-[180px] rounded-xl bg-zinc-900/50 border border-zinc-800 flex items-center justify-center">
                            <p className="text-sm text-zinc-500">
                              Not enough data yet
                            </p>
                          </div>
                        ) : (
                          <AdminAreaChart
                            data={avgRatingData}
                            color="#F59E0B"
                            valueLabel="Avg rating"
                            height={180}
                          />
                        )}
                      </div>
                    </div>

                    <div>
                      <h2 className="text-sm font-semibold text-zinc-300 mb-3">
                        Comments
                      </h2>
                      {listLoading ? (
                        <div className="space-y-3">
                          {Array.from({ length: 3 }).map((_, i) => (
                            <div
                              key={i}
                              className="h-20 rounded-2xl bg-zinc-900/50 border border-zinc-800 animate-pulse"
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {ratings.map((entry) => (
                            <FeedbackEntry
                              key={entry.id}
                              entry={entry}
                              onReport={handleReportClick}
                            />
                          ))}
                        </div>
                      )}

                      {pages > 1 && (
                        <div className="flex items-center justify-center gap-3 mt-6">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page <= 1 || listLoading}
                          >
                            Previous
                          </Button>
                          <span className="text-sm text-zinc-400">
                            Page {page} of {pages}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setPage((p) => Math.min(pages, p + 1))
                            }
                            disabled={page >= pages || listLoading}
                          >
                            Next
                          </Button>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="p-8 text-center bg-zinc-900/70 backdrop-blur-md border border-zinc-800 rounded-3xl">
                    <div className="inline-block p-4 bg-blue-600/20 rounded-full mb-4">
                      <MessageSquare className="h-12 w-12 text-blue-400" />
                    </div>
                    <h2 className="text-xl font-semibold mb-2">
                      No feedback yet
                    </h2>
                    <p className="text-zinc-400 mb-6">
                      Enable "Feedback" in a network session's Settings menu to
                      start collecting it from pilots.
                    </p>
                    <Link
                      to="/sessions"
                      className="inline-block px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-full transition-all"
                    >
                      View Sessions
                    </Link>
                  </div>
                )}
              </div>
            )
          )}
        </div>
      </div>

      <Modal
        isOpen={reportingId !== null}
        onClose={() => setReportingId(null)}
        title="Report Comment"
        variant="danger"
        icon={<Flag />}
        footer={
          <Button
            onClick={handleSubmitReport}
            variant="danger"
            disabled={submittingReport || !reportReason.trim()}
          >
            {submittingReport ? 'Reporting…' : 'Report'}
          </Button>
        }
      >
        <textarea
          value={reportReason}
          onChange={(e) => setReportReason(e.target.value)}
          placeholder="Enter reason for reporting..."
          className="w-full p-2 bg-zinc-800 text-white rounded border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-red-800 resize-y max-h-48"
          maxLength={MAX_REPORT_REASON_LENGTH}
          rows={4}
          disabled={submittingReport}
        />
      </Modal>

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
