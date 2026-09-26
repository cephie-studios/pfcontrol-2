import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type SettingsRowProps = {
  label: ReactNode;
  icon?: ReactNode;
  description?: ReactNode;
  htmlFor?: string;
  children?: ReactNode;
  stacked?: boolean;
  className?: string;
};

export default function SettingsRow({
  label,
  icon,
  description,
  htmlFor,
  children,
  stacked = false,
  className,
}: SettingsRowProps) {
  const LabelTag = htmlFor ? 'label' : 'div';
  return (
    <div
      className={cn(
        'flex flex-col gap-3 px-5 py-4',
        !stacked && 'sm:flex-row sm:items-center sm:justify-between sm:gap-6',
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-3.5">
        {icon ? (
          <span
            aria-hidden
            className="flex size-8 shrink-0 items-center justify-center [&_svg]:size-7"
          >
            {icon}
          </span>
        ) : null}
        <div className="min-w-0 space-y-0.5">
          <LabelTag
            {...(htmlFor ? { htmlFor } : {})}
            className="block text-sm font-medium"
          >
            {label}
          </LabelTag>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      {children ? (
        <div
          className={cn(
            'flex min-w-0 items-center gap-2',
            !stacked && 'sm:shrink-0 sm:justify-end'
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
