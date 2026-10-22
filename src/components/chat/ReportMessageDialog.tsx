import { useEffect, useState } from 'react';
import { Flag, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { minDuration } from '@/lib/minDuration';

export default function ReportMessageDialog({
  message,
  onOpenChange,
  onSubmit,
}: {
  message: { author: string; text: string } | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (message) setReason('');
  }, [message]);

  const submit = async () => {
    setSubmitting(true);
    try {
      await minDuration(onSubmit(reason.trim()));
      toast.success('Message reported');
      onOpenChange(false);
    } catch (err) {
      toast.error('Could not report the message', {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AlertDialog
      open={!!message}
      onOpenChange={(open) => !submitting && onOpenChange(open)}
    >
      <AlertDialogContent variant="danger" className="shadcn-scope z-10001">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Flag className="size-5 text-red-500" />
            Report message
          </AlertDialogTitle>
          <AlertDialogDescription>
            Reports go to the PFControl moderation team.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {message && (
          <p className="font-mono text-sm break-words text-zinc-300">
            <span className="text-zinc-500">{message.author}:</span>{' '}
            {message.text}
          </p>
        )}
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why are you reporting this message?"
          maxLength={200}
          aria-label="Report reason"
          className="min-h-24 rounded-xl border-2 border-zinc-800 bg-zinc-950 shadow-none focus-visible:border-red-600 dark:bg-zinc-950"
        />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={submitting || !reason.trim()}
            onClick={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            {submitting ? <Loader2 className="animate-spin" /> : <Flag />}
            {submitting ? 'Reporting…' : 'Report'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
