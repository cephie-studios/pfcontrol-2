import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type SettingsGroupProps = {
  /** Optional small heading above the card. */
  title?: string;
  children: ReactNode;
  className?: string;
};

export default function SettingsGroup({
  title,
  children,
  className,
}: SettingsGroupProps) {
  return (
    <div className="flex flex-col gap-2">
      {title ? (
        <h3 className="px-1 text-sm font-medium text-muted-foreground">
          {title}
        </h3>
      ) : null}
      <div
        className={cn(
          'flex flex-col divide-y overflow-hidden rounded-2xl border bg-card',
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}
