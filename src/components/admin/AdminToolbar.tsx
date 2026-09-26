import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type AdminToolbarProps = {
  children: ReactNode;
  className?: string;
};

export default function AdminToolbar({
  children,
  className,
}: AdminToolbarProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center',
        className
      )}
      role="toolbar"
    >
      {children}
    </div>
  );
}
