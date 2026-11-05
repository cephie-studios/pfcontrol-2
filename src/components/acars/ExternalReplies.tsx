import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SIGNATURE_TONES } from '@/lib/signatureTones';
import { usePendingAction } from '../../hooks/usePendingAction';
import {
  STANDBY,
  repliesFor,
  type ReplyProgress,
} from '../../utils/externalAcars';
import type { ProviderMessage } from '../../types/externalAcars';

export default function ExternalReplies({
  message,
  disabled,
  onRespond,
}: {
  message: ProviderMessage;
  disabled: boolean;
  onRespond: (element: string, mrn: number) => Promise<boolean>;
}) {
  const [progress, setProgress] = useState<ReplyProgress>();
  const { pending, run } = usePendingAction();
  const replies = repliesFor(message, progress);

  if (replies.length === 0) return null;

  return (
    <span className="mt-2 flex flex-wrap gap-2">
      {replies.map((reply) => (
        <Button
          key={reply.element}
          type="button"
          size="sm"
          variant="ghost"
          disabled={disabled || pending !== null}
          onClick={() =>
            void run(reply.element, async () => {
              if (!(await onRespond(reply.element, message.min as number))) {
                return;
              }
              setProgress(
                reply.element === STANDBY.element ? 'standby' : 'final'
              );
            })
          }
          className={SIGNATURE_TONES.blue}
        >
          {pending === reply.element && <Loader2 className="animate-spin" />}
          {reply.label}
        </Button>
      ))}
    </span>
  );
}
