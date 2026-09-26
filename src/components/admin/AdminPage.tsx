import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type AdminPageProps = {
  title: string;
  description?: ReactNode;
  icon?: LucideIcon;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

export default function AdminPage({
  title,
  description,
  icon: Icon,
  actions,
  children,
  className,
  contentClassName,
}: AdminPageProps) {
  return (
    <div
      className={cn(
        'mx-auto flex w-full max-w-[1600px] flex-col gap-6',
        className
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {Icon ? <Icon className="size-6 shrink-0 text-blue-400" /> : null}
          <div className="min-w-0 space-y-0.5">
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {title}
            </h1>
            {description ? (
              <p className="text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {actions}
          </div>
        ) : null}
      </div>
      <div className={cn('flex flex-col gap-6', contentClassName)}>
        {children}
      </div>
    </div>
  );
}
