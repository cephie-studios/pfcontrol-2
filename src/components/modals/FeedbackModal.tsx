import { useState, useEffect } from 'react';
import { X, Check, Loader2, Star } from 'lucide-react';
import Button from '../common/Button';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (feedback: FeedbackData) => Promise<void>;
}

export interface FeedbackData {
  categories: {
    userInterface: number;
    performance: number;
    features: number;
    easeOfUse: number;
    overall: number;
  };
  comment: string;
}

const categories = [
  { key: 'userInterface' as const, label: 'User Interface', description: 'Design and visual appeal' },
  { key: 'performance' as const, label: 'Performance', description: 'Speed and reliability' },
  { key: 'features' as const, label: 'Global Chat and ACARS', description: 'Communication features' },
  { key: 'easeOfUse' as const, label: 'Ease of Use', description: 'Intuitiveness and simplicity' },
  { key: 'overall' as const, label: 'Overall Experience', description: 'Your overall satisfaction' },
];

export default function FeedbackModal({ isOpen, onClose, onSubmit }: FeedbackModalProps) {
  const [ratings, setRatings] = useState<FeedbackData['categories']>({
    userInterface: 0,
    performance: 0,
    features: 0,
    easeOfUse: 0,
    overall: 0,
  });
  const [comment, setComment] = useState('');
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleRatingClick = (categoryKey: keyof FeedbackData['categories'], rating: number) => {
    setRatings((prev) => ({ ...prev, [categoryKey]: rating }));
  };

  const handleSubmit = async () => {
    // Check if at least overall rating is provided
    if (ratings.overall === 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({ categories: ratings, comment: comment.trim() });
      setIsSubmitted(true);

      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30);
      document.cookie = `feedback_submitted=true; expires=${expiryDate.toUTCString()}; path=/`;

      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (error) {
      console.error('Error submitting feedback:', error);
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;

    if (!isSubmitted) {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30);
      document.cookie = `feedback_dismissed=true; expires=${expiryDate.toUTCString()}; path=/`;
    }

    onClose();
    setTimeout(() => {
      setRatings({
        userInterface: 0,
        performance: 0,
        features: 0,
        easeOfUse: 0,
        overall: 0,
      });
      setComment('');
      setIsSubmitted(false);
      setIsSubmitting(false);
    }, 300);
  };

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[10000] p-4">
      <div className="bg-gradient-to-b from-zinc-900 to-zinc-950 border-2 border-zinc-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl relative">
        {/* Header */}
        <div className="flex-shrink-0 p-6 border-b border-zinc-700 flex items-center justify-between">
          <h2 className="text-3xl font-extrabold bg-gradient-to-r from-blue-400 to-blue-800 bg-clip-text text-transparent">
            Share Your Feedback
          </h2>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="bg-zinc-800/80 hover:bg-zinc-700 p-2 rounded-full transition-colors backdrop-blur-sm disabled:opacity-50"
            aria-label="Close modal"
          >
            <X className="w-5 h-5 text-zinc-300" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-6 space-y-6">
          {isSubmitted ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center">
                <Check className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="text-2xl font-bold text-white">Thank you for your feedback!</h3>
              <p className="text-zinc-400 text-center">
                Your input helps us improve PFControl for everyone.
              </p>
            </div>
          ) : (
            <>
              {/* Introduction */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <p className="text-blue-200 text-sm leading-relaxed">
                  <strong className="text-blue-100">Help us improve!</strong> Rate different aspects
                  of PFControl and let us know what you think.
                </p>
              </div>

              {/* Category Ratings */}
              <div className="space-y-4">
                {categories.map((category) => {
                  const currentRating = ratings[category.key];
                  const displayRating =
                    hoveredCategory === category.key && hoveredRating > 0
                      ? hoveredRating
                      : currentRating;

                  return (
                    <div
                      key={category.key}
                      className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700/50"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex-1">
                          <h3 className="text-white font-semibold text-base">
                            {category.label}
                            {category.key === 'overall' && (
                              <span className="text-red-400 ml-1">*</span>
                            )}
                          </h3>
                          <p className="text-zinc-400 text-xs mt-1">{category.description}</p>
                        </div>
                        <div className="flex items-center space-x-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              className="transition-all duration-150 hover:scale-110"
                              onClick={() => handleRatingClick(category.key, star)}
                              onMouseEnter={() => {
                                setHoveredCategory(category.key);
                                setHoveredRating(star);
                              }}
                              onMouseLeave={() => {
                                setHoveredCategory(null);
                                setHoveredRating(0);
                              }}
                              disabled={isSubmitting}
                              tabIndex={0}
                            >
                              <Star
                                className={`w-7 h-7 transition-colors duration-150 ${
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

              {/* Comment Section */}
              <div className="space-y-3">
                <label className="text-white font-semibold text-base">
                  Additional Comments <span className="text-zinc-500 text-sm">(Optional)</span>
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="What did you like? What could we improve? Any features you'd like to see?"
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none resize-none text-sm"
                  rows={4}
                  maxLength={1000}
                  disabled={isSubmitting}
                />
                <p className="text-zinc-500 text-xs text-right">
                  {comment.length}/1000 characters
                </p>
              </div>

              {/* Required field notice */}
              <p className="text-zinc-500 text-xs">
                <span className="text-red-400">*</span> Required field
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        {!isSubmitted && (
          <div className="flex-shrink-0 bg-zinc-900 border-t border-zinc-700 p-6 flex gap-3">
            <Button
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1 bg-zinc-700 hover:bg-zinc-600"
            >
              Maybe Later
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={ratings.overall === 0 || isSubmitting}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Submit Feedback</span>
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
