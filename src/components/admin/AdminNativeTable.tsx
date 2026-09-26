import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ADMIN_TABLE_FRAME } from './adminConstants';

type AdminNativeTableProps = {
  children: ReactNode;
  className?: string;
  minWidth?: string;
};

export default function AdminNativeTable({
  children,
  className,
  minWidth = '640px',
}: AdminNativeTableProps) {
  return (
    <div className={cn(ADMIN_TABLE_FRAME, className)}>
      <div className="overflow-x-auto">
        <table className="w-full caption-bottom text-sm" style={{ minWidth }}>
          {children}
        </table>
      </div>
    </div>
  );
}
