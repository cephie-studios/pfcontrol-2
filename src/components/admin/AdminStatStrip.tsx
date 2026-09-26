import AdminStatCards, { type AdminStatItem } from './AdminStatCards';

export type { AdminStatItem };

export default function AdminStatStrip(props: {
  items: AdminStatItem[];
  columns?: 2 | 3 | 4 | 6;
  className?: string;
}) {
  return <AdminStatCards {...props} />;
}
