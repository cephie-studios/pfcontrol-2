import type { ReactNode } from 'react';
import { Table } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { ADMIN_TABLE_FRAME } from './adminConstants';

type AdminTableProps = {
  children: ReactNode;
  className?: string;
  minWidth?: string;
};

export default function AdminTable({
  children,
  className,
  minWidth = '640px',
}: AdminTableProps) {
  return (
    <div className={cn(ADMIN_TABLE_FRAME, className)}>
      <Table style={{ minWidth }}>{children}</Table>
    </div>
  );
}
