import { StickyNote } from 'lucide-react';

interface NotePanelProps {
  notes: string;
  handleNotesChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}

export default function AcarsNotePanel({
  notes,
  handleNotesChange,
}: NotePanelProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="bg-gradient-to-r from-zinc-800 to-zinc-900 px-4 py-3 border-b border-zinc-700 flex items-center gap-2">
        <StickyNote className="w-5 h-5 text-blue-500" />
        <span className="text-sm font-mono text-zinc-300">Flight Notes</span>
      </div>
      <div className="flex-1 p-4">
        <textarea
          value={notes}
          onChange={handleNotesChange}
          placeholder="Loading flight plan details..."
          className="w-full h-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-300 font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-zinc-600"
        />
      </div>
    </div>
  );
}
