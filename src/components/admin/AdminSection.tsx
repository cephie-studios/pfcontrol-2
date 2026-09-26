import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type AdminSectionProps = {
  title?: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  flush?: boolean;
};

export default function AdminSection({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
}: AdminSectionProps) {
  const hasHeader = title || description || actions;
  return (
    <section className={cn('flex min-w-0 flex-col gap-3', className)}>
      {hasHeader ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            {title ? (
              <h2 className="text-base font-semibold">{title}</h2>
            ) : null}
            {description ? (
              <p className="text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex flex-wrap items-center gap-2">{actions}</div>
          ) : null}
        </div>
      ) : null}
      <div className={cn('min-w-0', contentClassName)}>{children}</div>
    </section>
  );
}
