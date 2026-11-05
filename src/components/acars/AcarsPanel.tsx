import type { CSSProperties, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AcarsPanel({
  icon: Icon,
  iconClassName = 'text-blue-400',
  title,
  actions,
  className,
  style,
  bodyClassName,
  children,
}: {
  icon: LucideIcon;
  iconClassName?: string;
  title: ReactNode;
  actions?: ReactNode;
  className?: string;
  style?: CSSProperties;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <section
      style={style}
      className={cn('flex min-h-0 min-w-0 flex-col overflow-hidden', className)}
    >
      <div className="flex min-h-14 shrink-0 items-center justify-between gap-3 px-5 pt-3 pb-2">
        <h2 className="flex min-w-0 items-center gap-2.5 text-xs font-semibold tracking-widest text-zinc-400 uppercase">
          <Icon className={cn('size-4 shrink-0', iconClassName)} />
          <span className="truncate">{title}</span>
        </h2>
        {actions}
      </div>
      <div
        className={cn(
          'min-h-0 flex-1 overflow-y-auto px-5 pb-5',
          bodyClassName
        )}
      >
        {children}
      </div>
    </section>
  );
}
