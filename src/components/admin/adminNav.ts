import {
  Activity,
  BarChart3,
  Ban,
  Bell,
  BellRing,
  Cable,
  Code,
  Database,
  FileText,
  GitMerge,
  Image,
  MessageSquareWarning,
  Plane,
  ScrollText,
  Server,
  ShieldCheck,
  Star,
  ThumbsUp,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { User } from '../../types/user';

export type AdminNavItem = {
  icon: LucideIcon;
  label: string;
  path: string;
  permission: string;
};

export type AdminNavSection = {
  title: string;
  items: AdminNavItem[];
};

export const ADMIN_NAV: AdminNavSection[] = [
  {
    title: 'General',
    items: [
      {
        icon: BarChart3,
        label: 'Overview',
        path: '/admin',
        permission: 'admin',
      },
      {
        icon: Users,
        label: 'Users',
        path: '/admin/users',
        permission: 'users',
      },
      {
        icon: Server,
        label: 'Sessions',
        path: '/admin/sessions',
        permission: 'sessions',
      },
      {
        icon: Bell,
        label: 'Notifications',
        path: '/admin/notifications',
        permission: 'notifications',
      },
      {
        icon: Star,
        label: 'Feedback',
        path: '/admin/feedback',
        permission: 'admin',
      },
      {
        icon: ThumbsUp,
        label: 'Ratings',
        path: '/admin/ratings',
        permission: 'admin',
      },
    ],
  },
  {
    title: 'Moderation',
    items: [
      {
        icon: MessageSquareWarning,
        label: 'Chat Reports',
        path: '/admin/chat-reports',
        permission: 'chat_reports',
      },
      {
        icon: Plane,
        label: 'Flight Archive',
        path: '/admin/flight-logs',
        permission: 'audit',
      },
      {
        icon: Image,
        label: 'Featured Flights',
        path: '/admin/featured-flights',
        permission: 'admin',
      },
      {
        icon: FileText,
        label: 'Profile Content',
        path: '/admin/profile-content',
        permission: 'admin',
      },
      {
        icon: BellRing,
        label: 'User Alerts',
        path: '/admin/user-alerts',
        permission: 'admin',
      },
      {
        icon: Ban,
        label: 'Bans',
        path: '/admin/bans',
        permission: 'bans',
      },
    ],
  },
  {
    title: 'Security',
    items: [
      {
        icon: Activity,
        label: 'API Logs',
        path: '/admin/api-logs',
        permission: 'audit',
      },
      {
        icon: Code,
        label: 'Developers',
        path: '/admin/developers',
        permission: 'admin',
      },
      {
        icon: ShieldCheck,
        label: 'Testers',
        path: '/admin/testers',
        permission: 'testers',
      },
      {
        icon: UserCog,
        label: 'Roles',
        path: '/admin/roles',
        permission: 'roles',
      },
      {
        icon: ScrollText,
        label: 'Audit Log',
        path: '/admin/audit',
        permission: 'audit',
      },
      {
        icon: GitMerge,
        label: 'Alt Detection',
        path: '/admin/alts',
        permission: 'admin',
      },
    ],
  },
  {
    title: 'Monitoring',
    items: [
      {
        icon: Cable,
        label: 'WebSockets',
        path: '/admin/websockets',
        permission: 'admin',
      },
      {
        icon: Database,
        label: 'Database',
        path: '/admin/database',
        permission: 'admin',
      },
    ],
  },
];

const PERMISSION_ALIASES: Record<string, string[]> = {
  admin: ['admin', 'overview'],
  users: ['users', 'user_management'],
  sessions: ['sessions', 'session_management'],
  notifications: ['notifications', 'update_notifications', 'update_modals'],
  update_modals: ['update_modals', 'update_notifications'],
  feedback: ['feedback', 'user_feedback'],
  chat_reports: ['chat_reports', 'chatReports', 'reports'],
  audit: ['audit', 'api_logs', 'flight_logs', 'audit_logs'],
  api_logs: ['api_logs', 'audit', 'audit_logs'],
  flight_logs: ['flight_logs', 'audit', 'flightArchive'],
  bans: ['bans', 'ban_management'],
  testers: ['testers', 'tester_management'],
  roles: ['roles', 'role_management'],
};

export function hasAdminPermission(
  user: User | null | undefined,
  permission: string
): boolean {
  if (user?.isAdmin) return true;
  const perms = (user?.rolePermissions ?? {}) as Record<string, unknown>;
  const granted = (v: unknown) =>
    v === true || v === 'true' || v === '1' || v === 1;

  if (granted(perms[permission])) return true;
  return (PERMISSION_ALIASES[permission] ?? []).some((p) => granted(perms[p]));
}

export function visibleAdminNav(
  user: User | null | undefined
): AdminNavSection[] {
  return ADMIN_NAV.map((section) => ({
    ...section,
    items: section.items.filter((item) =>
      hasAdminPermission(user, item.permission)
    ),
  })).filter((section) => section.items.length > 0);
}

export function findAdminNavItem(pathname: string): AdminNavItem | undefined {
  const normalized = pathname.replace(/\/+$/, '') || '/admin';
  return ADMIN_NAV.flatMap((s) => s.items).find(
    (item) => item.path === normalized
  );
}
