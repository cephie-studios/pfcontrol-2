import { useState } from 'react';
import { Star, X, Loader2, Check } from 'lucide-react';
import { submitControllerRating } from '../../utils/fetch/ratings';
import Button from '../common/Button';
import { Portal } from './Portal';

const MAX_COMMENT_LENGTH = 500;

interface ControllerRatingPopupProps {
  controllerId: string;
  flightId?: string;
  sessionId?: string;
  onClose: () => void;
}

export default function ControllerRatingPopup({
  controllerId,
  flightId,
  sessionId,
  onClose,
}: ControllerRatingPopupProps) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (rating === 0) return;

    setIsSubmitting(true);
    setError('');

    try {
      await submitControllerRating(
        controllerId,
        rating,
        flightId,
        sessionId,
        comment.trim() || undefined
      );
      setIsSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit rating');
      setIsSubmitting(false);
    }
  };

  const content = (
    <div className="bg-zinc-900 max-w-md mx-auto shadow-2xl border border-zinc-800 rounded-2xl w-full overflow-hidden animate-in fade-in zoom-in duration-200">
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-white italic">
            Rate your Controller
          </h3>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {isSuccess ? (
          <div className="py-8 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
              <Check className="w-8 h-8 text-green-500" />
            </div>
            <h4 className="text-lg font-semibold text-white mb-2">
              Thank you!
            </h4>
            <p className="text-zinc-400">
              Your rating has been submitted successfully.
            </p>
          </div>
        ) : (
          <>
            <p className="text-zinc-400 mb-4 text-center">
              How would you rate the service provided by the controller?
            </p>

            <div
              className="flex justify-center gap-2 mb-8"
              onMouseLeave={() => setHover(0)}
            >
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onMouseEnter={() => setHover(star)}
                  onClick={() => setRating(star)}
                  className="focus:outline-none transition-transform hover:scale-110 active:scale-95"
                >
                  <Star
                    className={`w-10 h-10 ${
                      star <= (hover || rating)
                        ? 'fill-yellow-500 text-yellow-500'
                        : 'text-zinc-700'
                    }`}
                  />
                </button>
              ))}
            </div>

            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a comment (optional)"
              className="w-full mb-6 px-3 py-3 bg-zinc-800 border-2 border-zinc-700/50 rounded-lg text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none resize-none text-sm"
              rows={3}
              maxLength={MAX_COMMENT_LENGTH}
              disabled={isSubmitting}
            />

            {error && (
              <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-full text-red-500 text-sm text-center">
                {error}
              </div>
            )}

            <div className="flex gap-3 max-w-md items-center justify-center mx-auto">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={onClose}
                disabled={isSubmitting}
                size="sm"
              >
                Skip
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                onClick={handleSubmit}
                disabled={rating === 0 || isSubmitting}
                size="sm"
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                ) : (
                  'Submit Rating'
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
      <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        {content}
      </div>
    </Portal>
  );
}
