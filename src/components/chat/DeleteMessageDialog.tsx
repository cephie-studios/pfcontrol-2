import { useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
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
import { minDuration } from '@/lib/minDuration';

export default function DeleteMessageDialog({
  text,
  onOpenChange,
  onConfirm,
}: {
  text: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);

  const confirm = async () => {
    setDeleting(true);
    try {
      await minDuration(onConfirm());
      toast.success('Message deleted');
      onOpenChange(false);
    } catch (err) {
      toast.error('Could not delete the message', {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AlertDialog
      open={text !== null}
      onOpenChange={(open) => !deleting && onOpenChange(open)}
    >
      <AlertDialogContent variant="danger" className="shadcn-scope z-10001">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete message?</AlertDialogTitle>
          <AlertDialogDescription>
            It will be removed for everyone in this conversation.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {text && <p className="text-sm break-words text-zinc-300">“{text}”</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={deleting}
            onClick={(e) => {
              e.preventDefault();
              confirm();
            }}
          >
            {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
            {deleting ? 'Deleting…' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
