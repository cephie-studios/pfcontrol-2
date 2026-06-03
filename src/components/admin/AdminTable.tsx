import type { ReactNode } from 'react';
import { adminTableShellClass } from './adminConstants';

type AdminTableProps = {
  children: ReactNode;
  className?: string;
  minWidth?: string;
};

export default function AdminTable({
  children,
  className = '',
  minWidth = '640px',
}: AdminTableProps) {
  return (
    <div className={adminTableShellClass(className)}>
      <div className="overflow-x-auto">
        <table className="w-full" style={{ minWidth }}>
          {children}
        </table>
      </div>
    </div>
  );
}
