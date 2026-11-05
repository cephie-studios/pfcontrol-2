import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { dragNotesDivider, dragSidebarDivider } from '../../utils/acarsLayout';
import AcarsDivider from './AcarsDivider';
import type { useAcarsLayout } from './useAcarsLayout';

type Divider = 'sidebar' | 'notes';

const panelWidth = (width: number) => ({ '--w': width }) as CSSProperties;

export default function AcarsWorkspace({
  layoutState,
  sidebar,
  terminal,
  notes,
}: {
  layoutState: ReturnType<typeof useAcarsLayout>;
  sidebar: ReactNode;
  terminal: (props: { className: string; style: CSSProperties }) => ReactNode;
  notes: ReactNode;
}) {
  const { layout, notesEnabled, notesWidth, save } = layoutState;
  const [dragging, setDragging] = useState<Divider | null>(null);
  const [draft, setDraft] = useState<typeof layout | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const shown = draft ?? layout;

  const resize = (divider: Divider, pct: number) =>
    divider === 'sidebar'
      ? dragSidebarDivider(shown, pct, notesEnabled)
      : dragNotesDivider(shown, pct);

  const commit = (next: typeof layout) =>
    save({
      sidebarWidth: next.sidebar,
      terminalWidth: next.terminal,
      notesWidth: notesEnabled ? next.notes : notesWidth,
    });

  const startDrag = (divider: Divider) => (event: React.PointerEvent) => {
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    setDragging(divider);
    setDraft(layout);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const rect = mainRef.current?.getBoundingClientRect();
    if (!dragging || !rect || rect.width <= 0) return;
    setDraft(
      resize(dragging, ((event.clientX - rect.left) / rect.width) * 100)
    );
  };

  const finishDrag = () => {
    if (dragging && draft) commit(draft);
    setDragging(null);
    setDraft(null);
  };

  const stepDivider = (divider: Divider, delta: number) => {
    const position =
      divider === 'sidebar' ? layout.sidebar : 100 - layout.notes;
    commit(resize(divider, position + delta));
  };

  const transition =
    !dragging &&
    'md:transition-[flex-grow] md:duration-300 md:ease-out motion-reduce:transition-none';

  return (
    <main
      ref={mainRef}
      onPointerMove={onPointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      className={cn(
        'flex min-h-0 flex-1 flex-col border-t border-zinc-800 md:flex-row',
        dragging && 'cursor-col-resize select-none'
      )}
    >
      <div
        style={panelWidth(shown.sidebar)}
        className={cn(
          'flex min-h-0 min-w-0 flex-col border-b border-zinc-800 md:flex-[var(--w)_1_0%] md:border-b-0',
          transition
        )}
      >
        {sidebar}
      </div>
      <AcarsDivider
        label="Resize flight panel"
        value={shown.sidebar}
        active={dragging === 'sidebar'}
        onPointerDown={startDrag('sidebar')}
        onKeyStep={(delta) => stepDivider('sidebar', delta)}
      />
      {terminal({
        style: panelWidth(shown.terminal),
        className: cn(
          'order-first h-[65dvh] border-b border-zinc-800 md:order-none md:h-auto md:flex-[var(--w)_1_0%] md:border-b-0',
          transition
        ),
      })}
      {notesEnabled && (
        <AcarsDivider
          label="Resize notes panel"
          value={100 - shown.notes}
          active={dragging === 'notes'}
          onPointerDown={startDrag('notes')}
          onKeyStep={(delta) => stepDivider('notes', delta)}
        />
      )}
      <div
        inert={!notesEnabled}
        style={panelWidth(shown.notes)}
        className={cn(
          'min-h-0 min-w-0 flex-col overflow-hidden md:flex md:flex-[var(--w)_1_0%]',
          notesEnabled ? 'flex' : 'hidden',
          transition
        )}
      >
        {notes}
      </div>
    </main>
  );
}
