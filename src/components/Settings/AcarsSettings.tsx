import { useRef, useState } from 'react';
import {
  NotebookPen,
  PanelLeft,
  Terminal,
  type LucideIcon,
} from 'lucide-react';
import type { Settings } from '../../types/settings';
import SettingsSection from './SettingsSection';
import SettingsGroup from './SettingsGroup';
import SettingsRow from './SettingsRow';
import { Switch } from '@/components/ui/switch';
import {
  dragNotesDivider,
  dragSidebarDivider,
  resolveAcarsLayout,
  type AcarsLayout,
} from '../../utils/acarsLayout';
import { cn } from '@/lib/utils';

type Divider = 'sidebar' | 'notes';

function PreviewPanel({
  icon: Icon,
  title,
  width,
  terminal,
}: {
  icon: LucideIcon;
  title: string;
  width: number;
  terminal?: boolean;
}) {
  return (
    <div
      style={{ flex: `${width} 1 0%` }}
      className={cn(
        'flex min-w-0 flex-col overflow-hidden',
        terminal && 'bg-black/40'
      )}
    >
      <div className="flex items-center gap-1.5 px-2.5 py-2">
        <Icon
          className={cn(
            'size-3.5 shrink-0',
            terminal ? 'text-emerald-400' : 'text-blue-400'
          )}
        />
        <span className="truncate text-xs text-zinc-300">{title}</span>
        <span className="ml-auto font-mono text-xs text-zinc-500 tabular-nums">
          {Math.round(width)}%
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 px-2.5 pb-2.5">
        <div className="h-1.5 w-3/4 rounded-full bg-zinc-800" />
        <div className="h-1.5 w-full rounded-full bg-zinc-800" />
        <div className="h-1.5 w-1/2 rounded-full bg-zinc-800" />
      </div>
    </div>
  );
}

function PreviewDivider({
  label,
  active,
  onPointerDown,
}: {
  label: string;
  active: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      onPointerDown={onPointerDown}
      className="group relative z-10 flex w-px shrink-0 cursor-col-resize touch-none items-center justify-center bg-zinc-800 before:absolute before:inset-y-0 before:-right-2 before:-left-2 before:content-['']"
    >
      <div
        className={cn(
          'absolute h-10 w-1 rounded-full transition-colors',
          active ? 'bg-blue-400' : 'bg-blue-600 group-hover:bg-blue-400'
        )}
      />
    </div>
  );
}

interface AcarsSettingsProps {
  settings: Settings | null;
  onChange: (updatedSettings: Settings) => void;
}

export default function AcarsSettings({
  settings,
  onChange,
}: AcarsSettingsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<Divider | null>(null);
  const [draft, setDraft] = useState<AcarsLayout | null>(null);

  if (!settings) return null;

  const notesEnabled = settings.acars.notesEnabled;
  const layout = draft ?? resolveAcarsLayout(settings.acars);

  const update = (patch: Partial<Settings['acars']>) =>
    onChange({ ...settings, acars: { ...settings.acars, ...patch } });

  const positionPct = (clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;
    return ((clientX - rect.left) / rect.width) * 100;
  };

  const startDrag = (divider: Divider) => (e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(divider);
    setDraft(layout);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging || !draft) return;
    const pct = positionPct(e.clientX);
    if (pct === null) return;
    setDraft(
      dragging === 'sidebar'
        ? dragSidebarDivider(draft, pct, notesEnabled)
        : dragNotesDivider(draft, pct)
    );
  };

  const handlePointerUp = () => {
    if (!dragging || !draft) return;
    setDragging(null);
    setDraft(null);
    update({
      sidebarWidth: draft.sidebar,
      terminalWidth: draft.terminal,
      notesWidth: notesEnabled ? draft.notes : settings.acars.notesWidth,
    });
  };

  return (
    <SettingsSection title="ACARS" icon={Terminal}>
      <SettingsGroup>
        <SettingsRow
          label="Notes panel"
          description="Show the notes panel next to the ACARS terminal."
          htmlFor="acars-notes-enabled"
        >
          <Switch
            id="acars-notes-enabled"
            checked={notesEnabled}
            onCheckedChange={(checked) => update({ notesEnabled: checked })}
          />
        </SettingsRow>
        <SettingsRow
          label="Open ACARS after filing"
          description="Open ACARS after submitting a flight plan. Network sessions only."
          htmlFor="acars-auto-redirect"
        >
          <Switch
            id="acars-auto-redirect"
            checked={settings.acars.autoRedirectToAcars ?? true}
            onCheckedChange={(checked) =>
              update({ autoRedirectToAcars: checked })
            }
          />
        </SettingsRow>
        <SettingsRow
          label="Panel widths"
          description="Drag the dividers to resize the panels. Applies on desktop."
          stacked
        >
          <div
            ref={containerRef}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className={cn(
              'flex h-40 w-full min-w-0 overflow-hidden rounded-xl border-2 border-zinc-800 select-none',
              dragging && 'cursor-col-resize'
            )}
          >
            <PreviewPanel
              icon={PanelLeft}
              title="Flight"
              width={layout.sidebar}
            />
            <PreviewDivider
              label="Resize flight panel"
              active={dragging === 'sidebar'}
              onPointerDown={startDrag('sidebar')}
            />
            <PreviewPanel
              icon={Terminal}
              title="Terminal"
              width={layout.terminal}
              terminal
            />
            {notesEnabled && (
              <>
                <PreviewDivider
                  label="Resize notes panel"
                  active={dragging === 'notes'}
                  onPointerDown={startDrag('notes')}
                />
                <PreviewPanel
                  icon={NotebookPen}
                  title="Notes"
                  width={layout.notes}
                />
              </>
            )}
          </div>
        </SettingsRow>
      </SettingsGroup>
    </SettingsSection>
  );
}
