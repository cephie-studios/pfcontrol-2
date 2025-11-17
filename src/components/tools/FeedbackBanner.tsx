import { useState, useEffect, useRef } from 'react';
import {
  Star,
  Check,
  X,
  MessageCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { submitFeedback } from '../../utils/fetch/feedback';
import { Portal } from './Portal';
import Button from '../common/Button';
import Toast from '../common/Toast';

interface FeedbackBannerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FeedbackBanner({
  isOpen,
  onClose,
}: FeedbackBannerProps) {
  const [rating, setRating] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);
  const [showDetailedModal, setShowDetailedModal] = useState(false);
  const [detailedRatings, setDetailedRatings] = useState({
    userInterface: 0,
    performance: 0,
    features: 0,
    easeOfUse: 0,
    overall: 0,
  });
  const [comment, setComment] = useState('');
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [hoveredBannerRating, setHoveredBannerRating] = useState(0);
  const [overallManuallySet, setOverallManuallySet] = useState(false);
  const [isEditingComment, setIsEditingComment] = useState(false);
  const [isCommentExpanded, setIsCommentExpanded] = useState(false);
  const STORAGE_KEY = 'feedback_detailed_data';
  const desktopTextareaRef = useRef<HTMLTextAreaElement>(null);
  const mobileTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = desktopTextareaRef.current || mobileTextareaRef.current;
    if (!el) return;

    const length = el.value.length;
    el.setSelectionRange(length, length);
  }, [comment]);

  useEffect(() => {
    if (showDetailedModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showDetailedModal]);

  useEffect(() => {
    if (!overallManuallySet) {
      const sum =
        detailedRatings.userInterface +
        detailedRatings.performance +
        detailedRatings.features +
        detailedRatings.easeOfUse;
      const avg = sum / 4;
      const rounded = Math.round(avg);
      setDetailedRatings((prev) => ({ ...prev, overall: rounded }));
    }
  }, [
    detailedRatings.userInterface,
    detailedRatings.performance,
    detailedRatings.features,
    detailedRatings.easeOfUse,
    overallManuallySet,
  ]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (showDetailedModal) {
        const data = { detailedRatings, comment };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      }
    }, 200);

    return () => clearTimeout(timeout);
  }, [detailedRatings, comment, showDetailedModal]);

  const handleRatingClick = (
    categoryKey:
      | 'userInterface'
      | 'performance'
      | 'features'
      | 'easeOfUse'
      | 'overall',
    rating: number
  ) => {
    if (categoryKey === 'overall') {
      setOverallManuallySet(true);
    }
    setDetailedRatings((prev) => ({ ...prev, [categoryKey]: rating }));
  };

  const handleSubmitDetailed = async () => {
    if (detailedRatings.overall === 0) return;

    try {
      setIsSubmitting(true);
      const categoriesText = `UI: ${detailedRatings.userInterface}/5, Performance: ${detailedRatings.performance}/5, Features: ${detailedRatings.features}/5, Ease of Use: ${detailedRatings.easeOfUse}/5, Overall: ${detailedRatings.overall}/5`;
      const fullComment = comment
        ? `${categoriesText}\n\n${comment}`
        : categoriesText;
      await submitFeedback(detailedRatings.overall, fullComment);
      localStorage.removeItem(STORAGE_KEY);
      setIsSubmitted(true);

      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30);
      document.cookie = `feedback_submitted=true; expires=${expiryDate.toUTCString()}; path=/`;

      setTimeout(() => {
        onClose();
        setTimeout(() => {
          setRating(0);
          setIsSubmitted(false);
          setIsSubmitting(false);
          setShowDetailedModal(false);
          setDetailedRatings({
            userInterface: 0,
            performance: 0,
            features: 0,
            easeOfUse: 0,
            overall: 0,
          });
          setComment('');
          setIsCommentExpanded(false);
        }, 300);
      }, 1500);
    } catch (error) {
      console.error('Error submitting feedback:', error);
      setToast({
        message: 'Failed to submit feedback. Please try again later.',
        type: 'error',
      });
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (rating === 0) return;

    try {
      setIsSubmitting(true);
      await submitFeedback(rating, undefined);
      setIsSubmitted(true);

      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30);
      document.cookie = `feedback_submitted=true; expires=${expiryDate.toUTCString()}; path=/`;

      setTimeout(() => {
        onClose();
        setTimeout(() => {
          setRating(0);
          setIsSubmitted(false);
          setIsSubmitting(false);
        }, 300);
      }, 1500);
    } catch (error) {
      console.error('Error submitting feedback:', error);
      setToast({
        message: 'Failed to submit feedback. Please try again later.',
        type: 'error',
      });
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting || isSubmitted) return;

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);
    document.cookie = `feedback_dismissed=true; expires=${expiryDate.toUTCString()}; path=/`;

    onClose();
    setTimeout(() => {
      setRating(0);
    }, 300);
  };

  const handleShowDetailedFeedback = () => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setDetailedRatings(
          data.detailedRatings || {
            userInterface: 0,
            performance: 0,
            features: 0,
            easeOfUse: 0,
            overall: 0,
          }
        );
        setComment(data.comment || '');
      } catch (e) {
        console.error('Error loading saved feedback data:', e);
      }
    }
    setShowDetailedModal(true);
    setOverallManuallySet(false);
    setIsCommentExpanded(false);
  };

  const handleCloseDetailed = () => {
    if (isSubmitting) return;
    setShowDetailedModal(false);
    setOverallManuallySet(false);
    setIsCommentExpanded(false);
    setTimeout(() => {
      setDetailedRatings({
        userInterface: 0,
        performance: 0,
        features: 0,
        easeOfUse: 0,
        overall: 0,
      });
      setComment('');
      setHoveredCategory(null);
      setHoveredRating(0);
    }, 300);
  };

  const categories = [
    {
      key: 'userInterface' as const,
      label: 'User Interface',
      description: 'Design and visual appeal',
    },
    {
      key: 'performance' as const,
      label: 'Performance',
      description: 'Speed and reliability',
    },
    {
      key: 'features' as const,
      label: 'Global Chat and ACARS',
      description: 'Communication features',
    },
    {
      key: 'easeOfUse' as const,
      label: 'Ease of Use',
      description: 'Intuitiveness and simplicity',
    },
    {
      key: 'overall' as const,
      label: 'Overall Experience',
      description: 'Your overall satisfaction',
    },
  ];

  const DesktopFeedback = () => (
    <div
      className={`fixed bottom-4 z-[9999] w-1/2 2xl:w-[45rem] left-1/2 transform -translate-x-1/2 pointer-events-auto transition-all duration-300`}
    >
      {showDetailedModal ? (
        <div className="space-y-3 mb-3">
          {/* Info banner */}
          <div className="backdrop-blur-lg border-2 rounded-3xl px-6 py-4 bg-zinc-900/80 border-zinc-700/50">
            <p className="text-zinc-400 text-sm leading-relaxed">
              <strong className="text-blue-400">Help us improve!</strong> Rate
              different aspects of PFControl and let us know what you think.
            </p>
          </div>

          {/* Category Ratings - hidden when comment is expanded */}
          {!isCommentExpanded && (
            <div className="space-y-3">
              {categories.map((category) => {
                const currentRating = detailedRatings[category.key];
                const displayRating =
                  hoveredCategory === category.key && hoveredRating > 0
                    ? hoveredRating
                    : currentRating;

                return (
                  <div
                    key={category.key}
                    className="backdrop-blur-lg border-2 rounded-3xl px-6 py-4 bg-zinc-900/80 border-zinc-700/50"
                  >
                    <div className="flex flex-row items-center justify-between">
                      <div className="flex flex-col justify-center text-left">
                        <span className="text-white text-md font-medium mb-0.5">
                          {category.label}
                          {category.key === 'overall' && (
                            <span className="text-red-400 ml-1">*</span>
                          )}
                        </span>
                        <span className="text-zinc-400 text-xs">
                          {category.description}
                        </span>
                      </div>
                      <div
                        className="flex justify-center space-x-2"
                        onMouseLeave={() => {
                          setHoveredCategory(null);
                          setHoveredRating(0);
                        }}
                      >
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            className="transition-all duration-200 hover:scale-110"
                            onClick={() =>
                              handleRatingClick(category.key, star)
                            }
                            onMouseEnter={() => {
                              setHoveredCategory(category.key);
                              setHoveredRating(star);
                            }}
                            disabled={isSubmitting}
                            tabIndex={0}
                          >
                            <Star
                              className={`w-8 h-8 transition-colors duration-200 ${
                                star <= displayRating
                                  ? 'text-yellow-400 fill-yellow-400'
                                  : 'text-zinc-600'
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Comment Section */}
          <div className="backdrop-blur-lg border-2 rounded-3xl px-4 py-4 bg-zinc-900/80 border-zinc-700/50 relative">
            {!isCommentExpanded ? (
              <button
                onClick={() => setIsCommentExpanded(true)}
                className="w-full text-left text-white font-semibold text-sm flex items-center justify-between"
                disabled={isSubmitting}
              >
                <span>
                  Additional Comments{' '}
                  <span className="text-zinc-500 text-xs">(Optional)</span>
                </span>
                <ChevronDown className="w-4 h-4 text-zinc-400" />
              </button>
            ) : (
              <>
                <label className="text-white font-semibold text-sm block mb-3 ml-1">
                  Additional Comments{' '}
                  <span className="text-zinc-500 text-xs">(Optional)</span>
                </label>
                <div className="relative">
                  <textarea
                    ref={desktopTextareaRef}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    onFocus={() => setIsEditingComment(true)}
                    onBlur={() => setIsEditingComment(false)}
                    placeholder="What did you like? What could we improve?"
                    className="w-full px-3 py-3 bg-zinc-900 border-2 border-zinc-700/50 rounded-lg text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none resize-none text-sm pr-20"
                    rows={8}
                    maxLength={1000}
                    disabled={isSubmitting}
                    autoFocus={isEditingComment}
                  />
                  <p className="absolute bottom-3 right-3 text-zinc-500 text-xs">
                    {comment.length}/1000
                  </p>
                </div>
                <button
                  onClick={() => setIsCommentExpanded(false)}
                  className="mt-2 text-zinc-400 hover:text-white transition-colors flex items-center"
                  disabled={isSubmitting}
                >
                  <ChevronUp className="w-4 h-4 mr-1" />
                  Collapse
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}

      <div className="backdrop-blur-lg border-2 rounded-3xl px-6 py-0 h-24 flex flex-row items-center justify-between bg-zinc-900/80 border-zinc-700/50">
        {isSubmitted ? (
          <div className="flex items-center justify-center space-x-2 w-full">
            <div className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center">
              <Check className="w-4 h-4 text-green-400" />
            </div>
            <span className="text-white text-sm font-medium">
              Thanks for your feedback!
            </span>
          </div>
        ) : showDetailedModal ? (
          <div className="flex flex-row items-center justify-between w-full">
            <div className="flex flex-col justify-center text-left mt-1">
              <span className="text-white text-md font-medium mb-1">
                Ready to submit?
              </span>
              <span className="text-zinc-400 text-xs mb-2">
                Review your ratings above
              </span>
            </div>

            <div className="flex justify-end items-center space-x-3">
              <button
                onClick={handleCloseDetailed}
                className="text-zinc-400 hover:text-white transition-colors"
                disabled={isSubmitting}
                aria-label="Cancel"
              >
                <X className="w-5 h-5" />
              </button>

              <Button
                onClick={handleSubmitDetailed}
                disabled={detailedRatings.overall === 0 || isSubmitting}
                size="icon"
                className="w-8 h-8 flex items-center justify-center"
                aria-label="Submit feedback"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Check className="w-5 h-5 text-green-400" />
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-row items-center justify-between w-full">
            <div className="flex flex-col justify-center text-left mt-1">
              <span className="text-white text-md font-medium mb-1">
                How's your experience?
              </span>
              <span className="text-zinc-400 text-xs mb-2 hidden xl:block">
                You can leave a comment with the chat icon.
              </span>
            </div>

            <div
              className="flex justify-center space-x-2"
              onMouseLeave={() => setHoveredBannerRating(0)}
            >
              {[1, 2, 3, 4, 5].map((star) => {
                const displayRating =
                  hoveredBannerRating > 0 ? hoveredBannerRating : rating;
                return (
                  <button
                    key={star}
                    type="button"
                    className="transition-all duration-200 hover:scale-110"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoveredBannerRating(star)}
                    disabled={isSubmitting}
                    tabIndex={0}
                  >
                    <Star
                      className={`w-8 h-8 transition-colors duration-200 ${
                        star <= displayRating
                          ? 'text-yellow-400 fill-yellow-400'
                          : 'text-zinc-600'
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            <div className="flex justify-end items-center space-x-3">
              <button
                onClick={handleShowDetailedFeedback}
                className="w-8 h-8 rounded-full backdrop-blur-lg border bg-zinc-900/80 border-zinc-700/50 flex items-center justify-center transition-all duration-300 ease-in-out hover:bg-zinc-800/80"
                disabled={isSubmitting}
                aria-label="Add comment"
              >
                <MessageCircle className="h-5 w-5 text-zinc-400" />
              </button>

              <Button
                onClick={handleSubmit}
                disabled={rating === 0 || isSubmitting}
                size="icon"
                className="w-8 h-8 flex items-center justify-center"
                aria-label="Submit feedback"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Check className="w-5 h-5 text-green-400" />
                )}
              </Button>

              <button
                onClick={handleClose}
                className="text-zinc-400 hover:text-white transition-colors"
                disabled={isSubmitting}
                aria-label="Close feedback"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const MobileFeedback = () => (
    <div
      className={`fixed bottom-0 left-0 right-0 z-[9999] p-4 pointer-events-auto transition-all duration-300`}
    >
      {showDetailedModal ? (
        <div className="space-y-3 mb-3">
          {/* Info banner */}
          <div className="backdrop-blur-lg border-2 rounded-3xl px-4 py-3 bg-zinc-900/80 border-zinc-700/50">
            <p className="text-blue-200 text-sm leading-relaxed">
              <strong className="text-blue-100">Help us improve!</strong>
              <br />
              Rate different aspects of PFControl.
            </p>
          </div>

          {/* Category Ratings - hidden when comment is expanded */}
          {!isCommentExpanded && (
            <div className="space-y-3">
              {categories.map((category) => {
                const currentRating = detailedRatings[category.key];
                const displayRating =
                  hoveredCategory === category.key && hoveredRating > 0
                    ? hoveredRating
                    : currentRating;

                return (
                  <div
                    key={category.key}
                    className="backdrop-blur-lg border-2 rounded-3xl px-3 py-2 bg-zinc-900/80 border-zinc-700/50"
                  >
                    <div className="flex flex-row items-center justify-between">
                      <span className="text-white text-sm font-medium">
                        {category.label}
                        {category.key === 'overall' && (
                          <span className="text-red-400 ml-1">*</span>
                        )}
                      </span>
                      <div
                        className="flex justify-center space-x-1"
                        onMouseLeave={() => {
                          setHoveredCategory(null);
                          setHoveredRating(0);
                        }}
                      >
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            className="transition-all duration-200 hover:scale-110"
                            onClick={() =>
                              handleRatingClick(category.key, star)
                            }
                            onMouseEnter={() => {
                              setHoveredCategory(category.key);
                              setHoveredRating(star);
                            }}
                            disabled={isSubmitting}
                            tabIndex={0}
                          >
                            <Star
                              className={`w-6 h-6 transition-colors duration-200 ${
                                star <= displayRating
                                  ? 'text-yellow-400 fill-yellow-400'
                                  : 'text-zinc-600'
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Comment Section */}
          <div className="backdrop-blur-lg border-2 rounded-3xl px-4 py-3 bg-zinc-900/80 border-zinc-700/50 relative">
            {!isCommentExpanded ? (
              <button
                onClick={() => setIsCommentExpanded(true)}
                className="w-full text-left text-white font-semibold text-sm flex items-center justify-between"
                disabled={isSubmitting}
              >
                <span>
                  Additional Comments{' '}
                  <span className="text-zinc-500 text-xs">(Optional)</span>
                </span>
                <ChevronDown className="w-4 h-4 text-zinc-400" />
              </button>
            ) : (
              <>
                <label className="text-white font-semibold text-sm block mb-2">
                  Additional Comments{' '}
                  <span className="text-zinc-500 text-xs">(Optional)</span>
                </label>
                <div className="relative">
                  <textarea
                    ref={mobileTextareaRef}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    onFocus={() => setIsEditingComment(true)}
                    onBlur={() => setIsEditingComment(false)}
                    placeholder="What did you like? What could we improve?"
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none resize-none text-sm pr-20"
                    rows={3}
                    maxLength={1000}
                    disabled={isSubmitting}
                    autoFocus={isEditingComment}
                  />
                  <p className="absolute bottom-2 right-3 text-zinc-500 text-xs">
                    {comment.length}/1000
                  </p>
                </div>
                <button
                  onClick={() => setIsCommentExpanded(false)}
                  className="mt-2 text-zinc-400 hover:text-white transition-colors flex items-center"
                  disabled={isSubmitting}
                >
                  <ChevronUp className="w-4 h-4 mr-1" />
                  Collapse
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}

      <div className="backdrop-blur-lg border-2 rounded-3xl px-4 py-4 bg-zinc-900/80 border-zinc-700/50 space-y-4">
        {isSubmitted ? (
          <div className="flex items-center justify-center space-x-2 w-full">
            <div className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center">
              <Check className="w-4 h-4 text-green-400" />
            </div>
            <span className="text-white text-sm font-medium">
              Thanks for your feedback!
            </span>
          </div>
        ) : showDetailedModal ? (
          <>
            {/* Header */}
            <div className="flex items-center justify-center relative">
              <span className="text-white text-md font-medium">
                Ready to submit?
              </span>
            </div>

            {/* Submit button */}
            <div className="flex justify-center items-center space-x-3">
              <button
                onClick={handleCloseDetailed}
                className="text-zinc-400 hover:text-white transition-colors"
                disabled={isSubmitting}
                aria-label="Cancel"
              >
                <X className="w-5 h-5" />
              </button>
              <Button
                onClick={handleSubmitDetailed}
                disabled={detailedRatings.overall === 0 || isSubmitting}
                size="icon"
                className="w-10 h-10 flex items-center justify-center"
                aria-label="Submit feedback"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Check className="w-5 h-5 text-green-400" />
                )}
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-center relative">
              <span className="text-white text-md font-medium">
                How's your experience?
              </span>
              <button
                onClick={handleClose}
                className="absolute right-0 text-zinc-400 hover:text-white transition-colors"
                disabled={isSubmitting}
                aria-label="Close feedback"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stars */}
            <div
              className="flex justify-center space-x-1"
              onMouseLeave={() => setHoveredBannerRating(0)}
            >
              {[1, 2, 3, 4, 5].map((star) => {
                const displayRating =
                  hoveredBannerRating > 0 ? hoveredBannerRating : rating;
                return (
                  <button
                    key={star}
                    type="button"
                    className="transition-all duration-200 hover:scale-110"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoveredBannerRating(star)}
                    disabled={isSubmitting}
                    tabIndex={0}
                  >
                    <Star
                      className={`w-6 h-6 transition-colors duration-200 ${
                        star <= displayRating
                          ? 'text-yellow-400 fill-yellow-400'
                          : 'text-zinc-600'
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            {/* Action buttons */}
            <div className="flex justify-center items-center space-x-3">
              <button
                onClick={handleShowDetailedFeedback}
                className="w-10 h-10 rounded-full backdrop-blur-lg border bg-zinc-900/80 border-zinc-700/50 flex items-center justify-center transition-all duration-300 ease-in-out hover:bg-zinc-800/80"
                disabled={isSubmitting}
                aria-label="Give detailed feedback"
              >
                <MessageCircle className="h-5 w-5 text-zinc-400" />
              </button>

              <Button
                onClick={handleSubmit}
                disabled={rating === 0 || isSubmitting}
                size="icon"
                className="w-10 h-10 flex items-center justify-center"
                aria-label="Submit feedback"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Check className="w-5 h-5 text-green-400" />
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return (
    <Portal>
      <div className="pointer-events-none">
        {isOpen && (
          <>
            <div className="hidden lg:block">
              {showDetailedModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-xl z-[9999] pointer-events-none" />
              )}
              <DesktopFeedback />
            </div>

            <div className="block lg:hidden">
              {showDetailedModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-xl z-[9999] pointer-events-none" />
              )}
              <MobileFeedback />
            </div>
          </>
        )}

        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </div>
    </Portal>
  );
}
