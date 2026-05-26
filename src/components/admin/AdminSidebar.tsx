import { Link, useLocation } from "react-router-dom";
import {
  MdBarChart,
  MdPeople,
  MdStorage,
  MdChevronLeft,
  MdChevronRight,
  MdSecurity,
  MdAdminPanelSettings,
  MdExpandMore,
  MdBlock,
  MdDashboard,
  MdReport,
  MdNotifications,
  MdChat,
  MdFlight,
  MdVerifiedUser,
  MdVpnKey,
  MdStar,
  MdMonitorHeart,
  MdThumbUp,
  MdMergeType,
  MdCode,
  MdCable,
  MdQueryStats,
} from "react-icons/md";
import type { IconType } from "react-icons";
import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/auth/useAuth";
import { navActiveClass } from "./adminConstants";

interface AdminSidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

const SIDEBAR_STORAGE_KEY = "admin-sidebar-collapsed";

type NavItem = {
  icon: IconType;
  label: string;
  path: string;
  textColor?: string;
  permission: string;
};

type NavSection = {
  title: string;
  icon: IconType;
  items: NavItem[];
};

export default function AdminSidebar({
  collapsed: initialCollapsed = false,
  onToggle,
}: AdminSidebarProps) {
  const location = useLocation();
  const { user } = useAuth();

  const getInitialCollapsedState = (): boolean => {
    try {
      const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (stored !== null) return JSON.parse(stored);
    } catch {
      /* localStorage unavailable */
    }
    return initialCollapsed;
  };

  const [collapsed, setCollapsed] = useState(getInitialCollapsedState);
  const [generalCollapsed, setGeneralCollapsed] = useState(false);
  const [moderationCollapsed, setModerationCollapsed] = useState(false);
  const [securityCollapsed, setSecurityCollapsed] = useState(false);
  const [monitoringCollapsed, setMonitoringCollapsed] = useState(false);
  const [showText, setShowText] = useState(!collapsed);

  useEffect(() => {
    if (!collapsed) {
      const timer = setTimeout(() => setShowText(true), 200);
      return () => clearTimeout(timer);
    }
    setShowText(false);
  }, [collapsed]);

  const handleToggle = () => {
    const newCollapsed = !collapsed;
    setCollapsed(newCollapsed);
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify(newCollapsed));
    } catch {
      /* localStorage unavailable */
    }
    onToggle?.();
  };

  const hasPermission = (permission: string) => {
    if (user?.isAdmin) return true;
    const perms = (user?.rolePermissions ?? {}) as Record<string, unknown>;
    const checkVal = (v: unknown) =>
      v === true || v === "true" || v === "1" || v === 1;

    if (checkVal(perms[permission])) return true;

    const aliases: Record<string, string[]> = {
      admin: ["admin", "overview"],
      users: ["users", "user_management"],
      sessions: ["sessions", "session_management"],
      notifications: ["notifications", "update_notifications", "update_modals"],
      update_modals: ["update_modals", "update_notifications"],
      feedback: ["feedback", "user_feedback"],
      chat_reports: ["chat_reports", "chatReports", "reports"],
      audit: ["audit", "api_logs", "flight_logs", "audit_logs"],
      api_logs: ["api_logs", "audit", "audit_logs"],
      flight_logs: ["flight_logs", "audit", "flightArchive", "flight_logs"],
      bans: ["bans", "ban_management"],
      testers: ["testers", "tester_management"],
      roles: ["roles", "role_management"],
    };

    for (const p of aliases[permission] ?? []) {
      if (checkVal(perms[p])) return true;
    }
    return false;
  };

  const sections: NavSection[] = [
    {
      title: "General",
      icon: MdDashboard,
      items: [
        {
          icon: MdBarChart,
          label: "Overview",
          path: "/admin",
          permission: "admin",
        },
        {
          icon: MdPeople,
          label: "Users",
          path: "/admin/users",
          textColor: "green-400",
          permission: "users",
        },
        {
          icon: MdStorage,
          label: "Sessions",
          path: "/admin/sessions",
          textColor: "yellow-400",
          permission: "sessions",
        },
        {
          icon: MdNotifications,
          label: "Notifications",
          path: "/admin/notifications",
          textColor: "cyan-400",
          permission: "notifications",
        },
        {
          icon: MdStar,
          label: "Feedback",
          path: "/admin/feedback",
          textColor: "yellow-400",
          permission: "admin",
        },
        {
          icon: MdThumbUp,
          label: "Ratings",
          path: "/admin/ratings",
          textColor: "indigo-400",
          permission: "admin",
        },
      ].filter((item) => hasPermission(item.permission)),
    },
    {
      title: "Moderation",
      icon: MdVpnKey,
      items: [
        {
          icon: MdChat,
          label: "Chat Reports",
          path: "/admin/chat-reports",
          textColor: "red-400",
          permission: "chat_reports",
        },
        {
          icon: MdFlight,
          label: "Flight Archive",
          path: "/admin/flight-logs",
          textColor: "rose-400",
          permission: "audit",
        },
        {
          icon: MdBlock,
          label: "Bans",
          path: "/admin/bans",
          textColor: "red-400",
          permission: "bans",
        },
      ],
    },
    {
      title: "Security",
      icon: MdSecurity,
      items: [
        {
          icon: MdMonitorHeart,
          label: "API Logs",
          path: "/admin/api-logs",
          textColor: "blue-400",
          permission: "audit",
        },
        {
          icon: MdCode,
          label: "Developers",
          path: "/admin/developers",
          textColor: "cyan-400",
          permission: "admin",
        },
        {
          icon: MdVerifiedUser,
          label: "Testers",
          path: "/admin/testers",
          textColor: "purple-400",
          permission: "testers",
        },
        {
          icon: MdAdminPanelSettings,
          label: "Roles",
          path: "/admin/roles",
          textColor: "rose-400",
          permission: "roles",
        },
        {
          icon: MdReport,
          label: "Audit Log",
          path: "/admin/audit",
          textColor: "orange-400",
          permission: "audit",
        },
        {
          icon: MdMergeType,
          label: "Alt Detection",
          path: "/admin/alts",
          textColor: "amber-400",
          permission: "admin",
        },
      ].filter((item) => hasPermission(item.permission)),
    },
    {
      title: "Monitoring",
      icon: MdQueryStats,
      items: [
        {
          icon: MdCable,
          label: "WebSockets",
          path: "/admin/websockets",
          textColor: "cyan-400",
          permission: "admin",
        },
        {
          icon: MdStorage,
          label: "Database",
          path: "/admin/database",
          textColor: "blue-400",
          permission: "admin",
        },
      ].filter((item) => hasPermission(item.permission)),
    },
  ].filter((section) => section.items.length > 0);

  const sectionState: Record<
    string,
    { collapsed: boolean; setCollapsed: (v: boolean) => void }
  > = {
    General: { collapsed: generalCollapsed, setCollapsed: setGeneralCollapsed },
    Moderation: {
      collapsed: moderationCollapsed,
      setCollapsed: setModerationCollapsed,
    },
    Security: {
      collapsed: securityCollapsed,
      setCollapsed: setSecurityCollapsed,
    },
    Monitoring: {
      collapsed: monitoringCollapsed,
      setCollapsed: setMonitoringCollapsed,
    },
  };

  const allItems = sections.flatMap((s) => s.items);

  const linkClass = (isActive: boolean, textColor?: string) =>
    `flex items-center gap-2.5 rounded-lg transition-colors duration-150 ${
      collapsed ? "justify-center h-8 w-full px-0" : "h-8 px-2.5"
    } ${
      isActive
        ? navActiveClass(textColor)
        : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
    }`;

  return (
    <div
      className={`bg-zinc-950 border-r border-zinc-800 transition-all duration-300 h-[calc(100vh-4rem)] sticky top-16 z-[40] ${
        collapsed ? "w-14" : "w-56"
      } flex flex-col overflow-hidden`}
    >
      <div className="px-2 py-2 border-b border-zinc-800 shrink-0">
        <div className="flex items-center justify-between gap-1">
          {!collapsed && (
            <div className="flex items-center gap-2 min-w-0 overflow-hidden">
              <div className="p-1.5 bg-blue-500/20 rounded-lg shrink-0">
                <MdDashboard size={18} className="text-blue-400" />
              </div>
              <div
                className={`transition-opacity duration-200 truncate ${
                  showText ? "opacity-100" : "opacity-0"
                }`}
              >
                <h2 className="text-sm font-semibold text-white">Admin</h2>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={handleToggle}
            className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white shrink-0"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <MdChevronRight size={18} />
            ) : (
              <MdChevronLeft size={18} />
            )}
          </button>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2 px-1.5">
        {collapsed ? (
          <div className="flex flex-col gap-0.5">
            {allItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={linkClass(isActive, item.textColor)}
                  title={item.label}
                >
                  <Icon size={20} className="shrink-0" />
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {sections.map((section) => {
              const SectionIcon = section.icon;
              const state = sectionState[section.title];
              const isSectionCollapsed = state?.collapsed ?? false;
              return (
                <div key={section.title}>
                  <button
                    type="button"
                    onClick={() => state?.setCollapsed(!isSectionCollapsed)}
                    className="flex items-center justify-between w-full h-7 px-2 text-xs font-medium text-zinc-500 hover:text-zinc-300 rounded-md transition-colors"
                  >
                    <span className="flex items-center gap-1.5">
                      <SectionIcon size={14} className="shrink-0" />
                      {section.title}
                    </span>
                    <MdExpandMore
                      size={16}
                      className={`transition-transform ${isSectionCollapsed ? "-rotate-90" : ""}`}
                    />
                  </button>
                  {!isSectionCollapsed && (
                    <div className="flex flex-col gap-0.5 mt-0.5 ml-0.5">
                      {section.items.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path;
                        return (
                          <Link
                            key={item.path}
                            to={item.path}
                            className={linkClass(isActive, item.textColor)}
                          >
                            <Icon size={20} className="shrink-0" />
                            <span className="text-sm font-medium truncate">
                              {item.label}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </nav>
    </div>
  );
}