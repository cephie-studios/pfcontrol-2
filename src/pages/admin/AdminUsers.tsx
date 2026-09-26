import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import {
  Ban,
  ChevronLeft,
  ChevronRight,
  Code,
  Database,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Settings,
  ShieldAlert,
  ShieldCheck,
  UserCog,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import AdminLayout from '../../components/admin/AdminLayout';
import AdminModal from '../../components/admin/AdminModal';
import AdminPage from '../../components/admin/AdminPage';
import AdminRefreshButton from '../../components/admin/AdminRefreshButton';
import AdminSelect from '../../components/admin/AdminSelect';
import AdminStatusBadge from '../../components/admin/AdminStatusBadge';
import AdminToolbar from '../../components/admin/AdminToolbar';
import AdminSearchInput from '../../components/admin/AdminSearchInput';
import AdminTable from '../../components/admin/AdminTable';
import {
  AdminEmptyState,
  AdminErrorState,
  AdminLoading,
} from '../../components/admin/AdminStates';
import { ADMIN_CHART_COLORS } from '../../components/admin/adminConstants';
import {
  fetchAdminUsers,
  revealUserIP,
  fetchRoles,
  assignRoleToUser,
  type AdminUser,
  type Role,
} from '../../utils/fetch/admin';
import { useAuth } from '../../hooks/auth/useAuth';
import { removeRoleFromUser } from '../../utils/fetch/admin';
import { getIconComponent } from '../../utils/roles';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const API_BASE_URL = import.meta.env.VITE_SERVER_URL || '';

type BackgroundImageSettings = {
  selectedImage?: string;
  useCustomBackground?: boolean;
  favorites?: string[];
};

type SoundSetting = {
  enabled: boolean;
  volume: number;
};

type SoundSettings = {
  startupSound?: SoundSetting;
  chatNotificationSound?: SoundSetting;
  newStripSound?: SoundSetting;
};

type LayoutSettings = {
  showCombinedView?: boolean;
  flightRowOpacity?: number;
};

type AcarsSettings = {
  notesEnabled?: boolean;
  chartsEnabled?: boolean;
  terminalWidth?: number;
  notesWidth?: number;
};

function avatarUrl(userId: string, avatar: string) {
  return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.png`;
}

function UserAvatar({
  userId,
  avatar,
  username,
  size = 'default',
}: {
  userId: string;
  avatar?: string | null;
  username: string;
  size?: 'default' | 'sm' | 'lg';
}) {
  return (
    <Avatar size={size}>
      {avatar ? (
        <AvatarImage src={avatarUrl(userId, avatar)} alt={username} />
      ) : null}
      <AvatarFallback>
        <UserRound className="size-4" />
      </AvatarFallback>
    </Avatar>
  );
}

function RoleName({ role, onRemove }: { role: Role; onRemove?: () => void }) {
  const RoleIcon = getIconComponent(role.icon);
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <RoleIcon
        className="size-4 shrink-0"
        style={{ color: role.color }}
        aria-hidden
      />
      {role.name}
      {onRemove ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onRemove}
              className="size-6 text-muted-foreground"
              aria-label={`Remove role ${role.name}`}
            >
              <X />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Remove role</TooltipContent>
        </Tooltip>
      ) : null}
    </span>
  );
}

function RoleIconTip({ role }: { role: Role }) {
  const RoleIcon = getIconComponent(role.icon);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="inline-flex cursor-default items-center"
          role="img"
          aria-label={role.name}
          tabIndex={0}
        >
          <RoleIcon className="size-4" style={{ color: role.color }} />
        </span>
      </TooltipTrigger>
      <TooltipContent>{role.name}</TooltipContent>
    </Tooltip>
  );
}

function UserRoles({ user }: { user: AdminUser }) {
  if (user.is_admin) {
    return (
      <AdminStatusBadge tone="info" icon={Code}>
        Developer
      </AdminStatusBadge>
    );
  }
  if (!user.roles || user.roles.length === 0) {
    return <span className="text-muted-foreground">N/A</span>;
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {user.roles.map((role) => (
        <RoleIconTip key={role.id} role={role} />
      ))}
    </div>
  );
}

function VpnStatus({ isVpn }: { isVpn?: boolean }) {
  return (
    <AdminStatusBadge
      tone={isVpn ? 'danger' : 'success'}
      icon={isVpn ? ShieldAlert : ShieldCheck}
    >
      {isVpn ? 'VPN detected' : 'No VPN'}
    </AdminStatusBadge>
  );
}

function RowAction({
  label,
  icon: Icon,
  onClick,
  destructive,
}: {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onClick}
          aria-label={label}
          className={cn(
            destructive && 'text-destructive hover:text-destructive'
          )}
        >
          <Icon />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function CacheIcon({ cached }: { cached?: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <img
          src={`${API_BASE_URL}/assets/app/icons/redis${cached ? '-green' : ''}.svg`}
          alt="Redis cache status"
          className="size-5"
        />
      </TooltipTrigger>
      <TooltipContent>
        {cached ? 'Cached in Redis' : 'Not cached'}
      </TooltipContent>
    </Tooltip>
  );
}

function EnabledValue({
  enabled,
  children,
}: {
  enabled?: boolean;
  children?: ReactNode;
}) {
  return (
    <span className={cn(!enabled && 'text-muted-foreground')}>
      {children ?? (enabled ? 'Enabled' : 'Disabled')}
    </span>
  );
}

function SettingsGroup({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn('grid min-w-0 content-start gap-3', className)}>
      <h3 className="text-sm font-medium">{title}</h3>
      {children}
    </section>
  );
}

function SettingsList({ children }: { children: ReactNode }) {
  return (
    <dl className="grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)] items-center gap-x-6 gap-y-2.5 text-sm">
      {children}
    </dl>
  );
}

function SettingRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  );
}

function BackgroundImagePanel({
  settings,
  onOpenImage,
}: {
  settings: BackgroundImageSettings;
  onOpenImage: (url: string) => void;
}) {
  const { selectedImage, useCustomBackground, favorites } = settings || {};
  const imageUrl = selectedImage
    ? selectedImage.startsWith('https://')
      ? selectedImage
      : `${API_BASE_URL}/assets/app/backgrounds/${selectedImage}`
    : null;

  return (
    <SettingsGroup title="Background image">
      <SettingsList>
        <SettingRow label="Custom background">
          <EnabledValue enabled={useCustomBackground} />
        </SettingRow>
        <SettingRow label="Favorites">
          <span className="tabular-nums">{favorites?.length || 0} items</span>
        </SettingRow>
        <SettingRow label="Selected image">
          {imageUrl ? (
            <button
              type="button"
              className="block h-20 w-32 overflow-hidden rounded-md border transition-opacity hover:opacity-80"
              onClick={() => onOpenImage(imageUrl)}
              aria-label="Open background preview"
            >
              <img
                src={imageUrl}
                alt="Selected background"
                className="size-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/placeholder-image.png';
                }}
              />
            </button>
          ) : (
            <span className="text-muted-foreground">None</span>
          )}
        </SettingRow>
      </SettingsList>
    </SettingsGroup>
  );
}

function SoundPanel({ settings }: { settings: SoundSettings }) {
  const { startupSound, chatNotificationSound, newStripSound } = settings || {};
  const rows: [string, SoundSetting | undefined][] = [
    ['Startup sound', startupSound],
    ['Chat notification', chatNotificationSound],
    ['New strip sound', newStripSound],
  ];
  return (
    <SettingsGroup title="Sounds">
      <SettingsList>
        {rows.map(([label, sound]) =>
          sound ? (
            <SettingRow key={label} label={label}>
              <EnabledValue enabled={sound.enabled}>
                {sound.enabled ? `Enabled (${sound.volume}%)` : 'Disabled'}
              </EnabledValue>
            </SettingRow>
          ) : null
        )}
      </SettingsList>
    </SettingsGroup>
  );
}

function LayoutPanel({ settings }: { settings: LayoutSettings }) {
  const { showCombinedView, flightRowOpacity } = settings || {};
  return (
    <SettingsGroup title="Layout">
      <SettingsList>
        <SettingRow label="Combined view">
          <EnabledValue enabled={showCombinedView} />
        </SettingRow>
        <SettingRow label="Flight row opacity">
          <span className="tabular-nums">{flightRowOpacity}%</span>
        </SettingRow>
      </SettingsList>
    </SettingsGroup>
  );
}

function TableColumnsSummary({
  columns,
  type,
}: {
  columns: Record<string, boolean> | undefined;
  type: string;
}) {
  if (!columns) return null;
  const enabledColumns = Object.entries(columns)
    .filter(([, enabled]) => enabled)
    .map(([key]) => key);
  return (
    <SettingRow label={`${type} table`}>
      {enabledColumns.join(', ') || 'None'}
    </SettingRow>
  );
}

function AcarsPanel({ settings }: { settings: AcarsSettings }) {
  const { notesEnabled, chartsEnabled, terminalWidth, notesWidth } =
    settings || {};
  const chartsWidth = 100 - (terminalWidth || 50) - (notesWidth || 20);
  const widths = [
    {
      label: 'Terminal',
      value: terminalWidth || 50,
      color: ADMIN_CHART_COLORS.green,
      show: true,
    },
    {
      label: 'Notes',
      value: notesWidth || 20,
      color: ADMIN_CHART_COLORS.blue,
      show: !!notesEnabled,
    },
    {
      label: 'Charts',
      value: chartsWidth,
      color: ADMIN_CHART_COLORS.purple,
      show: !!chartsEnabled,
    },
  ];

  return (
    <SettingsGroup title="ACARS">
      <SettingsList>
        <SettingRow label="Notes panel">
          <EnabledValue enabled={notesEnabled} />
        </SettingRow>
        <SettingRow label="Charts panel">
          <EnabledValue enabled={chartsEnabled} />
        </SettingRow>
        <SettingRow label="Panel widths">
          <div className="grid gap-2">
            <div className="flex h-2 overflow-hidden rounded-full bg-muted">
              {widths
                .filter((w) => w.show)
                .map((w) => (
                  <div
                    key={w.label}
                    style={{ width: `${w.value}%`, backgroundColor: w.color }}
                    title={`${w.label}: ${w.value}%`}
                  />
                ))}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {widths.map((w) => (
                <span key={w.label} className="flex items-center gap-1.5">
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: w.color }}
                    aria-hidden
                  />
                  <span className="text-muted-foreground">{w.label}</span>
                  <span className="font-medium tabular-nums">{w.value}%</span>
                </span>
              ))}
            </div>
          </div>
        </SettingRow>
      </SettingsList>
    </SettingsGroup>
  );
}

export default function AdminUsers() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get('search') ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState(
    () => searchParams.get('search') ?? ''
  );
  const [filterAdmin, setFilterAdmin] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [revealedIPs, setRevealedIPs] = useState<Set<string>>(new Set());
  const [revealingIP, setRevealingIP] = useState<string | null>(null);
  const [showFullscreenImage, setShowFullscreenImage] = useState(false);
  const [fullscreenImageUrl, setFullscreenImageUrl] = useState<string | null>(
    null
  );
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedUserForRole, setSelectedUserForRole] =
    useState<AdminUser | null>(null);
  const [assigningRole, setAssigningRole] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  const filterOptions = [
    { value: 'all', label: 'All users' },
    { value: 'admin', label: 'Admins only' },
    { value: 'non-admin', label: 'Non-admins' },
    { value: 'cached', label: 'Cached users only' },
  ];

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setSearchParams(search ? { search } : {}, { replace: true });
    }, 300);

    return () => clearTimeout(timer);
  }, [search, setSearchParams]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [usersData, rolesData] = await Promise.all([
        fetchAdminUsers(page, limit, debouncedSearch, filterAdmin),
        fetchRoles(),
      ]);

      const sortedUsers = usersData.users.sort(
        (a, b) =>
          new Date(b.last_login).getTime() - new Date(a.last_login).getTime()
      );

      setUsers(sortedUsers);
      setRoles(rolesData);
      setTotalPages(usersData.pagination.pages);
      setTotalUsers(usersData.pagination.total);

      return sortedUsers;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch data';
      setError(errorMessage);
      setToast({
        message: errorMessage,
        type: 'error',
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, filterAdmin]);

  useEffect(() => {
    fetchData().catch(() => {});
  }, [page, debouncedSearch, filterAdmin, fetchData]);

  const handleFilterChange = (value: string) => {
    setFilterAdmin(value);
    setPage(1);
  };

  const handleViewSettings = (user: AdminUser) => {
    setSelectedUser(user);
    setShowSettings(true);
  };

  const closeSettingsModal = () => {
    setShowSettings(false);
    setSelectedUser(null);
  };

  const handleManageRole = (user: AdminUser) => {
    setSelectedUserForRole(user);
    setShowRoleModal(true);
  };

  const handleRemoveRole = async (userId: string, roleId: number) => {
    try {
      await removeRoleFromUser(userId, roleId);
      setToast({ message: 'Role removed successfully', type: 'success' });
      const updatedUsers = await fetchData();
      const updatedUser = updatedUsers.find((u) => u.id === userId);
      if (updatedUser) {
        setSelectedUserForRole(updatedUser);
      }
    } catch (error) {
      setToast({
        message:
          error instanceof Error ? error.message : 'Failed to remove role',
        type: 'error',
      });
    }
  };

  const handleAssignRole = async (roleId: number | null) => {
    if (!selectedUserForRole) return;

    try {
      setAssigningRole(true);

      if (roleId) {
        await assignRoleToUser(selectedUserForRole.id, roleId);
        setToast({
          message: 'Role assigned successfully',
          type: 'success',
        });
      } else {
        setToast({
          message: 'Please use the Admin Roles page to remove roles',
          type: 'info',
        });
      }

      const updatedUsers = await fetchData();
      const updatedUser = updatedUsers.find(
        (u) => u.id === selectedUserForRole.id
      );
      if (updatedUser) {
        setSelectedUserForRole(updatedUser);
      }
    } catch (error) {
      setToast({
        message:
          error instanceof Error ? error.message : 'Failed to update role',
        type: 'error',
      });
    } finally {
      setAssigningRole(false);
    }
  };

  const handleRevealIP = async (userId: string) => {
    if (revealedIPs.has(userId)) {
      setRevealedIPs((prev) => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
      return;
    }

    try {
      setRevealingIP(userId);
      await revealUserIP(userId);
      setRevealedIPs((prev) => new Set(prev).add(userId));
      setToast({
        message: 'IP address revealed successfully',
        type: 'success',
      });
    } catch (error) {
      console.error('Error revealing IP:', error);
      setToast({
        message:
          error instanceof Error
            ? error.message
            : 'Failed to reveal IP address',
        type: 'error',
      });
    } finally {
      setRevealingIP(null);
    }
  };

  const formatIPAddress = (ip: string | null | undefined, userId: string) => {
    if (!ip) {
      return '***.***.***.**';
    }
    if (revealedIPs.has(userId)) {
      return ip;
    }

    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.***.**`;
    }
    return '***.***.***.**';
  };

  const openImage = (url: string) => {
    setFullscreenImageUrl(url);
    setShowFullscreenImage(true);
  };

  const renderIP = (tableUser: AdminUser) => {
    const revealed = revealedIPs.has(tableUser.id);
    const revealing = revealingIP === tableUser.id;
    return (
      <div className="flex items-center gap-1">
        <span className={cn('font-mono text-xs', !revealed && 'blur-sm')}>
          {formatIPAddress(tableUser.ip_address, tableUser.id)}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => handleRevealIP(tableUser.id)}
              disabled={revealing}
              aria-label={revealed ? 'Hide IP address' : 'Reveal IP address'}
            >
              {revealing ? (
                <Loader2 className="animate-spin" />
              ) : revealed ? (
                <EyeOff />
              ) : (
                <Eye />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{revealed ? 'Hide IP' : 'Reveal IP'}</TooltipContent>
        </Tooltip>
      </div>
    );
  };

  const renderActions = (tableUser: AdminUser) => (
    <div className="flex shrink-0 items-center justify-end gap-1">
      <RowAction
        label="View settings"
        icon={Settings}
        onClick={() => handleViewSettings(tableUser)}
      />
      {!tableUser.is_admin && (
        <RowAction
          label="Manage roles"
          icon={UserCog}
          onClick={() => handleManageRole(tableUser)}
        />
      )}
      {(tableUser.current_sessions_count || 0) >= 1 && (
        <RowAction
          label="View sessions"
          icon={Database}
          onClick={() => navigate(`/admin/sessions?userId=${tableUser.id}`)}
        />
      )}
      {!tableUser.is_admin && (
        <RowAction
          label="Ban user"
          icon={Ban}
          destructive
          onClick={() =>
            navigate(
              `/admin/bans?userId=${
                tableUser.id
              }&username=${encodeURIComponent(tableUser.username)}`
            )
          }
        />
      )}
    </div>
  );

  const availableRoles = selectedUserForRole
    ? roles.filter(
        (role) => !selectedUserForRole.roles?.some((ur) => ur.id === role.id)
      )
    : [];

  return (
    <AdminLayout toast={toast} onToastClose={() => setToast(null)}>
      <AdminPage
        title="Users"
        icon={Users}
        actions={
          <AdminRefreshButton
            onClick={() => {
              fetchData().catch(() => {});
            }}
            loading={loading}
          />
        }
      >
        <AdminToolbar>
          <AdminSearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Search by username, user ID or IP address…"
            loading={loading && search !== debouncedSearch}
          />
          <AdminSelect
            options={filterOptions}
            value={filterAdmin}
            onChange={handleFilterChange}
            placeholder="Filter users…"
            aria-label="Filter users"
          />
        </AdminToolbar>

        {loading ? (
          <AdminLoading label="Loading users…" />
        ) : error ? (
          <AdminErrorState
            title="Error loading users"
            message={error}
            onRetry={() => {
              fetchData().catch(() => {});
            }}
          />
        ) : users.length === 0 ? (
          <AdminEmptyState icon={Users} title="No users found" />
        ) : (
          <>
            <AdminTable className="hidden md:block" minWidth="960px">
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Last login</TableHead>
                  {user?.isAdmin && <TableHead>IP address</TableHead>}
                  <TableHead>VPN</TableHead>
                  <TableHead className="text-right">Sessions</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Cache</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((tableUser) => (
                  <TableRow key={tableUser.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <UserAvatar
                          userId={tableUser.id}
                          avatar={tableUser.avatar}
                          username={tableUser.username}
                        />
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {tableUser.username}
                          </p>
                          <p className="truncate font-mono text-xs text-muted-foreground">
                            {tableUser.id}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {new Date(tableUser.last_login).toLocaleDateString()}
                    </TableCell>
                    {user?.isAdmin && (
                      <TableCell>{renderIP(tableUser)}</TableCell>
                    )}
                    <TableCell>
                      <VpnStatus isVpn={tableUser.is_vpn} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {tableUser.current_sessions_count ?? 0}
                    </TableCell>
                    <TableCell>
                      <UserRoles user={tableUser} />
                    </TableCell>
                    <TableCell>
                      <CacheIcon cached={tableUser.cached} />
                    </TableCell>
                    <TableCell className="text-right">
                      {renderActions(tableUser)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </AdminTable>

            <div className="divide-y rounded-2xl border md:hidden">
              {users.map((tableUser) => (
                <div key={tableUser.id} className="grid gap-4 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <UserAvatar
                        userId={tableUser.id}
                        avatar={tableUser.avatar}
                        username={tableUser.username}
                        size="lg"
                      />
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {tableUser.username}
                        </p>
                        <p className="truncate font-mono text-xs text-muted-foreground">
                          {tableUser.id}
                        </p>
                      </div>
                    </div>
                    {renderActions(tableUser)}
                  </div>

                  <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm">
                    <dt className="text-muted-foreground">Last login</dt>
                    <dd className="tabular-nums">
                      {new Date(tableUser.last_login).toLocaleDateString()}
                    </dd>
                    {user?.isAdmin && (
                      <>
                        <dt className="text-muted-foreground">IP</dt>
                        <dd>{renderIP(tableUser)}</dd>
                      </>
                    )}
                    <dt className="text-muted-foreground">VPN</dt>
                    <dd>
                      <VpnStatus isVpn={tableUser.is_vpn} />
                    </dd>
                    <dt className="text-muted-foreground">Sessions</dt>
                    <dd className="tabular-nums">
                      {tableUser.current_sessions_count ?? 0}
                    </dd>
                    <dt className="text-muted-foreground">Roles</dt>
                    <dd>
                      <UserRoles user={tableUser} />
                    </dd>
                    <dt className="text-muted-foreground">Cache</dt>
                    <dd>
                      <CacheIcon cached={tableUser.cached} />
                    </dd>
                  </dl>
                </div>
              ))}
            </div>
          </>
        )}

        {!loading && !error && (
          <div className="flex flex-col items-center justify-end gap-3 sm:flex-row">
            <p className="text-sm text-muted-foreground tabular-nums">
              Page {page} of {totalPages} · {totalUsers.toLocaleString()} total
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
              >
                <ChevronLeft />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
              >
                Next
                <ChevronRight />
              </Button>
            </div>
          </div>
        )}
      </AdminPage>

      {selectedUserForRole && (
        <AdminModal
          open={showRoleModal}
          onClose={() => setShowRoleModal(false)}
          title="Manage roles"
          size="md"
          footer={
            <>
              <Button
                variant="destructive"
                onClick={() => {
                  selectedUserForRole.roles?.forEach((role) =>
                    handleRemoveRole(selectedUserForRole.id, role.id)
                  );
                }}
                disabled={assigningRole || !selectedUserForRole.roles?.length}
                className="sm:mr-auto"
              >
                <X />
                Remove all roles
              </Button>
              <Button variant="outline" onClick={() => setShowRoleModal(false)}>
                Close
              </Button>
            </>
          }
        >
          <div className="flex items-center gap-3">
            <UserAvatar
              userId={selectedUserForRole.id}
              avatar={selectedUserForRole.avatar}
              username={selectedUserForRole.username}
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {selectedUserForRole.username}
              </p>
              <p className="truncate font-mono text-xs text-muted-foreground">
                {selectedUserForRole.id}
              </p>
            </div>
          </div>

          <div className="grid gap-3">
            <h3 className="text-sm font-medium">Current roles</h3>
            {selectedUserForRole.roles &&
            selectedUserForRole.roles.length > 0 ? (
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {selectedUserForRole.roles.map((role) => (
                  <RoleName
                    key={role.id}
                    role={role}
                    onRemove={() =>
                      handleRemoveRole(selectedUserForRole.id, role.id)
                    }
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No roles</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label>Add role</Label>
            <AdminSelect
              searchable
              options={availableRoles.map((role) => {
                const RoleIcon = getIconComponent(role.icon);
                return {
                  value: role.id.toString(),
                  label: role.name,
                  icon: (
                    <RoleIcon
                      className="size-4"
                      style={{ color: role.color }}
                    />
                  ),
                };
              })}
              value=""
              onChange={(val) => {
                if (val !== '') handleAssignRole(parseInt(val));
              }}
              placeholder="Select a role to add…"
              searchPlaceholder="Search roles…"
              disabled={assigningRole}
              className="sm:w-full"
              aria-label="Add role"
            />
            {assigningRole && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Updating roles…
              </p>
            )}
          </div>
        </AdminModal>
      )}

      {selectedUser && (
        <AdminModal
          open={showSettings}
          onClose={closeSettingsModal}
          title={`${selectedUser.username}'s settings`}
          size="xl"
        >
          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            <div className="grid gap-1">
              <dt className="text-xs text-muted-foreground">Roblox account</dt>
              <dd className="truncate text-sm">
                {selectedUser.roblox_username || (
                  <span className="text-muted-foreground">Not linked</span>
                )}
              </dd>
            </div>
            <div className="grid gap-1">
              <dt className="text-xs text-muted-foreground">Public profile</dt>
              <dd className="text-sm">
                <Link
                  to={`/user/${selectedUser.username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
                >
                  View profile
                  <ExternalLink className="size-3.5 text-muted-foreground" />
                </Link>
              </dd>
            </div>
          </dl>

          {selectedUser.settings ? (
            <>
              <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
                <BackgroundImagePanel
                  settings={{
                    ...selectedUser.settings.backgroundImage,
                    selectedImage:
                      selectedUser.settings.backgroundImage?.selectedImage ??
                      undefined,
                  }}
                  onOpenImage={openImage}
                />
                <SoundPanel settings={selectedUser.settings.sounds} />
                <LayoutPanel settings={selectedUser.settings.layout} />
                <SettingsGroup title="Table columns">
                  <SettingsList>
                    <TableColumnsSummary
                      columns={
                        selectedUser.settings
                          .departureTableColumns as unknown as Record<
                          string,
                          boolean
                        >
                      }
                      type="Departure"
                    />
                    <TableColumnsSummary
                      columns={
                        selectedUser.settings
                          .arrivalsTableColumns as unknown as Record<
                          string,
                          boolean
                        >
                      }
                      type="Arrivals"
                    />
                  </SettingsList>
                </SettingsGroup>
                {selectedUser.settings.acars && (
                  <AcarsPanel
                    settings={selectedUser.settings.acars as AcarsSettings}
                  />
                )}
                <SettingsGroup title="Other">
                  <SettingsList>
                    <SettingRow label="Tutorial completed">
                      <EnabledValue
                        enabled={selectedUser.settings.tutorialCompleted}
                      >
                        {selectedUser.settings.tutorialCompleted ? 'Yes' : 'No'}
                      </EnabledValue>
                    </SettingRow>
                    <SettingRow label="Linked accounts on profile">
                      <EnabledValue
                        enabled={
                          selectedUser.settings.displayLinkedAccountsOnProfile
                        }
                      >
                        {selectedUser.settings.displayLinkedAccountsOnProfile
                          ? 'Yes'
                          : 'No'}
                      </EnabledValue>
                    </SettingRow>
                  </SettingsList>
                </SettingsGroup>
              </div>
              <SettingsGroup title="Raw JSON">
                <pre className="max-h-80 overflow-auto rounded-xl bg-muted/50 p-4 font-mono text-xs">
                  {JSON.stringify(selectedUser.settings, null, 2)}
                </pre>
              </SettingsGroup>
            </>
          ) : (
            <AdminEmptyState icon={Settings} title="No settings available" />
          )}
        </AdminModal>
      )}

      <AdminModal
        open={showFullscreenImage && !!fullscreenImageUrl}
        onClose={() => setShowFullscreenImage(false)}
        title="Background preview"
        size="full"
      >
        {fullscreenImageUrl && (
          <img
            src={fullscreenImageUrl}
            alt="Fullscreen background"
            className="mx-auto max-h-[70vh] max-w-full rounded-lg object-contain"
          />
        )}
      </AdminModal>
    </AdminLayout>
  );
}
