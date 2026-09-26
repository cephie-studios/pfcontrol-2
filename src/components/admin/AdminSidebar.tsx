import { useAuth } from '../../hooks/auth/useAuth';
import { visibleAdminNav } from './adminNav';
import DashboardSidebar from '../dashboard/DashboardSidebar';

export default function AdminSidebar() {
  const { user } = useAuth();
  return (
    <DashboardSidebar
      product="Admin"
      homePath="/admin"
      sections={visibleAdminNav(user)}
    />
  );
}
