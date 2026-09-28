import { useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, Check, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { minDuration } from '@/lib/minDuration';
import { cn } from '@/lib/utils';
import { submitSurveyResponse, type Survey } from '../../utils/fetch/surveys';

type Props = {
  survey: Survey;
  onSubmitted: () => void;
};

const CHOICE_TONE = {
  yes: {
    idle: 'border-green-600 text-green-600 hover:bg-green-600 hover:text-white focus-visible:bg-green-600 focus-visible:text-white',
    selected: 'border-green-600 bg-green-600 text-white',
  },
  no: {
    idle: 'border-red-600 text-red-600 hover:bg-red-600 hover:text-white focus-visible:bg-red-600 focus-visible:text-white',
    selected: 'border-red-600 bg-red-600 text-white',
  },
} as const;

function ChoiceButton({
  value,
  selected,
  loading,
  disabled,
  onClick,
}: {
  value: 'yes' | 'no';
  selected: boolean;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const tone = CHOICE_TONE[value];
  const Icon = value === 'yes' ? Check : X;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        'group flex h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl border-2 text-lg font-semibold transition-colors outline-none focus-visible:ring-0 disabled:cursor-default',
        selected ? tone.selected : tone.idle,
        disabled && 'pointer-events-none',
        disabled && !selected && 'opacity-50'
      )}
    >
      {loading ? (
        <Loader2 className="size-7 animate-spin" aria-hidden />
      ) : (
        <Icon className="size-7" aria-hidden />
      )}
      {value === 'yes' ? 'Yes' : 'No'}
    </button>
  );
}

export default function SurveyModal({ survey, onSubmitted }: Props) {
  const total = survey.questions.length;
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState<'yes' | 'no' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const startedAt = useRef<number | null>(null);

  const questionIndex = step - 1;
  const question = survey.questions[questionIndex];
  const isThanks = step === total + 1;

  const answer = async (value: 'yes' | 'no') => {
    if (!question || pending) return;
    const next = { ...answers, [question.id]: value === 'yes' };
    setAnswers(next);
    setError(null);

    if (questionIndex < total - 1) {
      setStep(step + 1);
      return;
    }

    const durationMs =
      startedAt.current == null
        ? null
        : Math.round(performance.now() - startedAt.current);
    setPending(value);
    try {
      await minDuration(submitSurveyResponse(survey.id, next, durationMs));
      setStep(total + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save your answers');
    } finally {
      setPending(null);
    }
  };

  const block = (e: Event) => e.preventDefault();

  return (
    <Dialog open>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={block}
        onPointerDownOutside={block}
        onInteractOutside={block}
        className="shadcn-scope gap-0 overflow-hidden rounded-[2rem] border-zinc-800 bg-zinc-950 p-0 text-foreground sm:max-w-xl"
      >
        {question ? (
          <div className="flex items-center gap-1.5 px-5 pt-5" aria-hidden>
            {survey.questions.map((q, i) => (
              <div
                key={q.id}
                className={cn(
                  'h-1.5 flex-1 rounded-full transition-colors duration-300',
                  i <= questionIndex ? 'bg-blue-600' : 'bg-zinc-800'
                )}
              />
            ))}
          </div>
        ) : null}

        <div
          key={step}
          className="flex min-h-[18rem] flex-col p-5 duration-300 animate-in fade-in-0 slide-in-from-right-6"
        >
          {step === 0 ? (
            <>
              <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                <DialogTitle className="text-2xl font-bold tracking-tight">
                  {survey.title}
                </DialogTitle>
                <DialogDescription className="max-w-sm text-base text-zinc-400">
                  {survey.description}
                </DialogDescription>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={() => {
                  startedAt.current ??= performance.now();
                  setStep(1);
                }}
                className="mt-5 h-12 w-full cursor-pointer rounded-2xl border-2 border-blue-600 text-base text-blue-600 hover:bg-blue-600 hover:text-white focus-visible:bg-blue-600 dark:hover:bg-blue-600 focus-visible:text-white focus-visible:ring-0"
              >
                Start
              </Button>
            </>
          ) : question ? (
            <>
              <div className="flex h-8 items-center justify-between gap-2">
                <p className="text-sm font-medium text-blue-500 tabular-nums">
                  Question {questionIndex + 1} of {total}
                </p>
                {questionIndex > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending !== null}
                    onClick={() => {
                      setError(null);
                      setStep(step - 1);
                    }}
                    className="-mr-2 cursor-pointer text-zinc-400 hover:text-foreground"
                  >
                    <ArrowLeft />
                    Back
                  </Button>
                ) : null}
              </div>
              <DialogTitle className="mt-1 text-2xl leading-snug font-bold tracking-tight">
                {question.text}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Answer yes or no to continue.
              </DialogDescription>

              <div className="mt-auto grid grid-cols-2 gap-3 pt-6">
                {(['yes', 'no'] as const).map((v) => (
                  <ChoiceButton
                    key={v}
                    value={v}
                    selected={
                      question.id in answers &&
                      answers[question.id] === (v === 'yes')
                    }
                    loading={pending === v}
                    disabled={pending !== null}
                    onClick={() => void answer(v)}
                  />
                ))}
              </div>

              {error ? (
                <p
                  role="alert"
                  className="mt-4 flex items-start gap-2 rounded-2xl border-2 border-red-600 px-3 py-2 text-sm text-red-400"
                >
                  <AlertTriangle
                    className="mt-0.5 size-4 shrink-0"
                    aria-hidden
                  />
                  {error}
                </p>
              ) : null}
            </>
          ) : isThanks ? (
            <>
              <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                <DialogTitle className="text-2xl font-bold tracking-tight">
                  Thanks for your answers!
                </DialogTitle>
                <DialogDescription className="max-w-sm text-base text-zinc-400">
                  That&apos;s all. Your feedback helps us decide where PFControl
                  goes next.
                </DialogDescription>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={onSubmitted}
                className="mt-5 h-12 w-full cursor-pointer rounded-2xl border-2 border-green-600 text-base text-green-600 hover:bg-green-600 hover:text-white focus-visible:bg-green-600 focus-visible:text-white focus-visible:ring-0 dark:hover:bg-green-600"
              >
                Done
              </Button>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
