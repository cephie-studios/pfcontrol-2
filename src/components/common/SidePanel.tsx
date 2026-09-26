import type { ReactNode } from 'react';
import { X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export const panelInputClass =
  'w-full rounded-full border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-white placeholder:text-zinc-500 transition-colors focus:border-blue-600 focus:outline-none';

export const panelTextareaClass =
  'w-full rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-white placeholder:text-zinc-500 transition-colors focus:border-blue-600 focus:outline-none';

export const panelCardClass =
  'rounded-2xl border border-zinc-800 bg-zinc-800/40';

export function SidePanel({
  open,
  children,
  className,
}: {
  open: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <aside
      className={cn(
        'fixed top-0 right-0 flex h-full w-100 max-w-full flex-col rounded-l-3xl border-l-2 border-blue-800 bg-zinc-900 text-white transition-transform duration-300',
        open
          ? 'translate-x-0 shadow-2xl shadow-black/60'
          : 'pointer-events-none translate-x-full',
        className
      )}
      style={{ zIndex: 10000 }}
    >
      {children}
    </aside>
  );
}

export function PanelHeader({
  icon: Icon,
  title,
  onClose,
  center,
  children,
}: {
  icon: LucideIcon;
  title: ReactNode;
  onClose: () => void;
  center?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="relative flex h-16 shrink-0 items-center gap-3 border-b border-blue-800 px-5">
      <h2 className="flex min-w-0 items-center gap-2.5 text-lg font-semibold tracking-tight">
        <Icon className="size-5 shrink-0 text-blue-400" />
        <span className="truncate">{title}</span>
      </h2>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
        {children}
      </div>
      {center && (
        <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-2">
          {center}
        </div>
      )}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="flex size-8 shrink-0 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
      >
        <X className="size-5" />
      </button>
    </div>
  );
}

export function PanelBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex-1 space-y-6 overflow-y-auto p-5', className)}>
      {children}
    </div>
  );
}

export function PanelSection({
  title,
  actions,
  children,
}: {
  title: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex min-h-8 items-center justify-between gap-3">
        <h3 className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">
          {title}
        </h3>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function PanelFooter({ children }: { children: ReactNode }) {
  return (
    <div className="flex shrink-0 items-center justify-end gap-3 border-t border-blue-800 p-5">
      {children}
    </div>
  );
}
