import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export default function AdminSectionTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <h2 className={cn('text-sm font-medium', className)}>{children}</h2>;
}
