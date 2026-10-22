import { useState, type CSSProperties } from 'react';
import { NotebookPen } from 'lucide-react';
import AcarsPanel from './AcarsPanel';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const NOTES_TTL_MS = 12 * 60 * 60 * 1000;

function readStoredNotes(notesKey: string, timestampKey: string) {
  try {
    const savedAt = Number(localStorage.getItem(timestampKey));
    if (savedAt && Date.now() - savedAt > NOTES_TTL_MS) {
      localStorage.removeItem(notesKey);
      localStorage.removeItem(timestampKey);
      return '';
    }
    return localStorage.getItem(notesKey) ?? '';
  } catch {
    return '';
  }
}

export default function AcarsNotes({
  sessionId,
  flightId,
  className,
  style,
}: {
  sessionId: string;
  flightId: string;
  className?: string;
  style?: CSSProperties;
}) {
  const notesKey = `acars-notes-${sessionId}-${flightId}`;
  const timestampKey = `acars-notes-timestamp-${sessionId}-${flightId}`;
  const [notes, setNotes] = useState(() =>
    readStoredNotes(notesKey, timestampKey)
  );

  const handleChange = (value: string) => {
    setNotes(value);
    try {
      localStorage.setItem(notesKey, value);
      localStorage.setItem(timestampKey, Date.now().toString());
    } catch {
      // storage full or blocked; notes still work for this visit
    }
  };

  return (
    <AcarsPanel
      icon={NotebookPen}
      title="Notes"
      className={cn('[&:focus-within_h2]:text-blue-400', className)}
      style={style}
      bodyClassName="flex flex-col gap-2 overflow-hidden"
    >
      <Textarea
        value={notes}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Frequencies, taxi route, reminders…"
        aria-label="Flight notes"
        className="min-h-48 flex-1 resize-none rounded-none border-0 bg-transparent p-0 text-sm leading-relaxed text-zinc-200 shadow-none [field-sizing:fixed] placeholder:text-zinc-600 focus-visible:ring-0 dark:bg-transparent"
      />
      <p className="shrink-0 text-xs text-zinc-500">
        Saved on this device for 12 hours.
      </p>
    </AcarsPanel>
  );
}
