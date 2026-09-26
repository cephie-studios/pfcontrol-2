import { useId, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type SettingsSectionProps = {
  title: string;
  icon: LucideIcon;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

export default function SettingsSection({
  title,
  icon: Icon,
  actions,
  children,
  className,
}: SettingsSectionProps) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className={cn('flex flex-col gap-4', className)}
    >
      <div className="flex min-h-9 items-center justify-between gap-3">
        <h2
          id={titleId}
          className="flex items-center gap-2.5 text-lg font-semibold tracking-tight"
        >
          <Icon className="size-5 shrink-0 text-blue-400" />
          {title}
        </h2>
        {actions ? (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        ) : null}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}
