import { useState, useEffect, useMemo, useId } from 'react';
import {
  Check,
  Code,
  GripVertical,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  User,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import AdminRefreshButton from '../../components/admin/AdminRefreshButton';
import AdminLayout from '../../components/admin/AdminLayout';
import AdminModal from '../../components/admin/AdminModal';
import AdminPage from '../../components/admin/AdminPage';
import AdminSection from '../../components/admin/AdminSection';
import AdminToolbar from '../../components/admin/AdminToolbar';
import AdminSearchInput from '../../components/admin/AdminSearchInput';
import AdminSelect from '../../components/admin/AdminSelect';
import AdminStatCards from '../../components/admin/AdminStatCards';
import AdminStatusBadge from '../../components/admin/AdminStatusBadge';
import AdminTable from '../../components/admin/AdminTable';
import {
  AdminEmptyState,
  AdminErrorState,
  AdminLoading,
} from '../../components/admin/AdminStates';
import { useAdminConfirm } from '../../components/admin/useAdminConfirm';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  fetchRoles,
  createRole,
  updateRole,
  deleteRole,
  assignRoleToUser,
  removeRoleFromUser,
  fetchUsersWithRoles,
  updateRolePriorities,
  type Role,
  type UserWithRole,
} from '../../utils/fetch/admin';
import {
  getIconComponent,
  AVAILABLE_ICONS,
  AVAILABLE_PERMISSIONS,
  PRESET_COLORS,
} from '../../utils/roles';

type Permission = (typeof AVAILABLE_PERMISSIONS)[number];

const PERMISSION_GROUPS: { title: string; keys: string[] }[] = [
  {
    title: 'Dashboard & users',
    keys: ['admin', 'users', 'sessions', 'bans', 'testers'],
  },
  {
    title: 'Logs & moderation',
    keys: ['audit', 'api_logs', 'flight_logs', 'chat_reports', 'feedback'],
  },
  {
    title: 'Content & access',
    keys: ['notifications', 'update_modals', 'roles'],
  },
  { title: 'Network events', keys: ['pfatc_sector'] },
];

function groupPermissions() {
  const known = new Set(PERMISSION_GROUPS.flatMap((g) => g.keys));
  const groups = PERMISSION_GROUPS.map((g) => ({
    title: g.title,
    items: g.keys
      .map((k) => AVAILABLE_PERMISSIONS.find((p) => p.key === k))
      .filter((p): p is Permission => Boolean(p)),
  }));
  const other = AVAILABLE_PERMISSIONS.filter((p) => !known.has(p.key));
  if (other.length) groups.push({ title: 'Other', items: other });
  return groups.filter((g) => g.items.length > 0);
}

const GROUPED_PERMISSIONS = groupPermissions();

function RoleName({ role, className }: { role: Role; className?: string }) {
  const RoleIcon = getIconComponent(role.icon);
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5', className)}>
      <RoleIcon
        className="size-4 shrink-0"
        style={{ color: role.color }}
        aria-hidden
      />
      <span className="truncate">{role.name}</span>
    </span>
  );
}

function PermissionSummary({
  permissions,
}: {
  permissions: Record<string, boolean>;
}) {
  const enabled = AVAILABLE_PERMISSIONS.filter((p) => permissions[p.key]);
  if (enabled.length === 0) {
    return <span className="text-muted-foreground">None</span>;
  }
  const shown = enabled
    .slice(0, 4)
    .map((p) => p.label)
    .join(', ');
  if (enabled.length <= 4) {
    return <span className="text-muted-foreground">{shown}</span>;
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-default text-muted-foreground" tabIndex={0}>
          {shown}{' '}
          <span className="text-foreground tabular-nums">
            +{enabled.length - 4} more
          </span>
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        {enabled.map((p) => p.label).join(', ')}
      </TooltipContent>
    </Tooltip>
  );
}

function UserAvatar({ user }: { user: UserWithRole }) {
  return (
    <Avatar className="size-8">
      {user.avatar ? (
        <AvatarImage
          src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`}
          alt=""
        />
      ) : null}
      <AvatarFallback>
        <User className="size-4" />
      </AvatarFallback>
    </Avatar>
  );
}

function RoleColorField({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  const id = useId();
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>Color</Label>
      <div className="grid grid-cols-5 gap-2">
        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            title={color}
            aria-label={`Use color ${color}`}
            aria-pressed={value === color}
            className="flex h-8 items-center justify-center rounded-md border text-white outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
            style={{ backgroundColor: color }}
          >
            {value === color ? <Check className="size-4" /> : null}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Custom color"
          className="h-9 w-12 shrink-0 cursor-pointer rounded-md border bg-transparent p-1"
        />
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono"
          spellCheck={false}
        />
      </div>
    </div>
  );
}

export default function AdminRoles() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPermissions, setFormPermissions] = useState<
    Record<string, boolean>
  >({});
  const [formColor, setFormColor] = useState('#6366F1');
  const [formIcon, setFormIcon] = useState('Star');
  const [formPriority, setFormPriority] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);
  const [showAddRoleModal, setShowAddRoleModal] = useState(false);
  const [selectedUserForRole, setSelectedUserForRole] = useState<string | null>(
    null
  );
  const { confirm, confirmDialog } = useAdminConfirm();
  const formId = useId();

  const validRoles = useMemo(
    () => roles.filter((role) => role.id && !isNaN(role.id)),
    [roles]
  );

  const stats = useMemo(() => {
    const withRole = users.filter((u) => u.roles && u.roles.length > 0).length;
    return {
      roleCount: validRoles.length,
      usersWithRoles: withRole,
      usersWithoutRoles: users.length - withRole,
      totalAssignments: users.reduce((n, u) => n + (u.roles?.length ?? 0), 0),
    };
  }, [validRoles.length, users]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return users.filter((user) => {
      const matchesSearch =
        !q ||
        user.username.toLowerCase().includes(q) ||
        user.id.toLowerCase().includes(q);
      if (!matchesSearch) return false;
      if (roleFilter === 'all') return true;
      if (roleFilter === 'no-role') return !user.roles?.length;
      return (
        user.roles?.some((role) => role.id.toString() === roleFilter) ?? false
      );
    });
  }, [users, userSearch, roleFilter]);

  const hasUserFilters = userSearch.trim() !== '' || roleFilter !== 'all';

  useEffect(() => {
    void fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [rolesData, usersData] = await Promise.all([
        fetchRoles(),
        fetchUsersWithRoles(),
      ]);
      setRoles(rolesData);
      setUsers(usersData);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch data';
      setError(errorMessage);
      setToast({ message: errorMessage, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormPermissions({});
    setFormColor('#6366F1');
    setFormIcon('Star');
    setFormPriority(0);
    setSelectedRole(null);
  };

  const handleCreateRole = async () => {
    if (!formName.trim()) {
      setToast({ message: 'Role name is required', type: 'error' });
      return;
    }
    try {
      setSubmitting(true);
      await createRole({
        name: formName.trim(),
        description: formDescription.trim(),
        permissions: formPermissions,
        color: formColor,
        icon: formIcon,
        priority: isNaN(formPriority) ? 0 : formPriority,
      });
      setToast({ message: 'Role created successfully', type: 'success' });
      setShowCreateModal(false);
      resetForm();
      await fetchData();
    } catch (e) {
      setToast({
        message: e instanceof Error ? e.message : 'Failed to create role',
        type: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditRole = async () => {
    if (!selectedRole || !formName.trim()) {
      setToast({ message: 'Role name is required', type: 'error' });
      return;
    }
    if (!selectedRole.id || isNaN(selectedRole.id)) {
      setToast({ message: 'Invalid role ID', type: 'error' });
      return;
    }
    try {
      setSubmitting(true);
      await updateRole(selectedRole.id, {
        name: formName.trim(),
        description: formDescription.trim(),
        permissions: formPermissions,
        color: formColor,
        icon: formIcon,
        priority: isNaN(formPriority) ? 0 : formPriority,
      });
      setToast({ message: 'Role updated successfully', type: 'success' });
      setShowEditModal(false);
      resetForm();
      await fetchData();
    } catch (e) {
      setToast({
        message: e instanceof Error ? e.message : 'Failed to update role',
        type: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRole = async (role: Role) => {
    if (!role.id || isNaN(role.id)) {
      setToast({ message: 'Invalid role ID', type: 'error' });
      return;
    }
    const ok = await confirm({
      title: `Delete "${role.name}"?`,
      description: 'This removes the role from all assigned users.',
      confirmText: 'Delete role',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteRole(role.id);
      setToast({ message: 'Role deleted successfully', type: 'success' });
      await fetchData();
    } catch (e) {
      setToast({
        message: e instanceof Error ? e.message : 'Failed to delete role',
        type: 'error',
      });
    }
  };

  const handleAssignRole = async (userId: string, roleId: number) => {
    try {
      await assignRoleToUser(userId, roleId);
      setToast({ message: 'Role assigned successfully', type: 'success' });
      setShowAddRoleModal(false);
      setSelectedUserForRole(null);
      await fetchData();
    } catch (e) {
      setToast({
        message: e instanceof Error ? e.message : 'Failed to assign role',
        type: 'error',
      });
    }
  };

  const handleRemoveRole = async (userId: string, roleId: number) => {
    try {
      await removeRoleFromUser(userId, roleId);
      setToast({ message: 'Role removed successfully', type: 'success' });
      await fetchData();
    } catch (e) {
      setToast({
        message: e instanceof Error ? e.message : 'Failed to remove role',
        type: 'error',
      });
    }
  };

  const openEditModal = (role: Role) => {
    setSelectedRole(role);
    setFormName(role.name);
    setFormDescription(role.description || '');
    setFormPermissions(role.permissions);
    setFormColor(role.color || '#6366F1');
    setFormIcon(role.icon || 'Star');
    setFormPriority(
      typeof role.priority === 'number' && !isNaN(role.priority)
        ? role.priority
        : 0
    );
    setShowEditModal(true);
  };

  const openCreateModal = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const handleDragStart = (_e: React.DragEvent, id: number) => {
    setDraggedId(id);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (!draggedId) return;
    const draggedIndex = roles.findIndex((role) => role.id === draggedId);
    if (draggedIndex === -1 || draggedIndex === index) return;
    const newRoles = [...roles];
    const [removed] = newRoles.splice(draggedIndex, 1);
    newRoles.splice(index, 0, removed);
    setRoles(newRoles);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDraggedId(null);
    const rolePriorities = roles
      .filter((role) => role.id && !isNaN(role.id))
      .map((role, index) => ({
        id: role.id,
        priority: roles.length - index,
      }));
    if (rolePriorities.length === 0) {
      setToast({ message: 'No valid roles to update', type: 'error' });
      return;
    }
    try {
      await updateRolePriorities(rolePriorities);
      setToast({ message: 'Role order saved', type: 'success' });
      await fetchData();
    } catch (e) {
      setToast({
        message:
          e instanceof Error ? e.message : 'Failed to update role priorities',
        type: 'error',
      });
      await fetchData();
    }
  };

  const clearUserFilters = () => {
    setUserSearch('');
    setRoleFilter('all');
  };

  const togglePermission = (key: string) =>
    setFormPermissions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));

  const previewRole = {
    id: 0,
    name: formName.trim() || 'Role preview',
    description: '',
    permissions: {},
    color: formColor,
    icon: formIcon,
    priority: formPriority,
    created_at: '',
    updated_at: '',
  } satisfies Role;

  const roleFormFields = (
    <>
      <div className="grid gap-5">
        <div className="grid gap-5 sm:grid-cols-[1fr_8rem]">
          <div className="grid gap-2">
            <Label htmlFor={`${formId}-name`}>
              Role name
              <span className="text-destructive">*</span>
            </Label>
            <Input
              id={`${formId}-name`}
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. Moderator"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${formId}-priority`}>Priority</Label>
            <Input
              id={`${formId}-priority`}
              type="number"
              inputMode="numeric"
              value={String(formPriority)}
              onChange={(e) => {
                const parsed = parseInt(e.target.value, 10);
                setFormPriority(Number.isNaN(parsed) ? 0 : parsed);
              }}
              placeholder="0"
              className="tabular-nums"
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${formId}-description`}>Description</Label>
          <Textarea
            id={`${formId}-description`}
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            placeholder="What this role is for…"
            rows={2}
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="grid content-start gap-2">
            <Label>Icon</Label>
            <div
              className="grid grid-cols-7 gap-1.5 sm:grid-cols-5"
              role="radiogroup"
              aria-label="Role icon"
            >
              {AVAILABLE_ICONS.map((iconOption) => {
                const IconComponent = iconOption.icon;
                const active = formIcon === iconOption.value;
                return (
                  <Tooltip key={iconOption.value}>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant={active ? 'default' : 'outline'}
                        size="icon"
                        role="radio"
                        aria-checked={active}
                        aria-label={iconOption.label}
                        onClick={() => setFormIcon(iconOption.value)}
                        className="w-full"
                      >
                        <IconComponent />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{iconOption.label}</TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
          <RoleColorField value={formColor} onChange={setFormColor} />
        </div>

        <div className="grid gap-2">
          <Label>Preview</Label>
          <RoleName role={previewRole} className="text-sm font-medium" />
        </div>
      </div>

      <div className="grid gap-4">
        <h3 className="text-sm font-medium">Permissions</h3>
        {GROUPED_PERMISSIONS.map((group) => (
          <div key={group.title} className="grid gap-2.5">
            <h4 className="text-xs text-muted-foreground">{group.title}</h4>
            <div className="grid gap-x-4 gap-y-2.5 sm:grid-cols-2">
              {group.items.map((permission) => {
                const checkboxId = `${formId}-perm-${permission.key}`;
                return (
                  <Label
                    key={permission.key}
                    htmlFor={checkboxId}
                    title={permission.description}
                    className="flex cursor-pointer items-center gap-2.5 font-normal"
                  >
                    <Checkbox
                      id={checkboxId}
                      checked={!!formPermissions[permission.key]}
                      onCheckedChange={() => togglePermission(permission.key)}
                    />
                    {permission.label}
                  </Label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </>
  );

  const roleFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'All users' },
      { value: 'no-role', label: 'No role' },
      ...validRoles.map((role) => {
        const RoleIcon = getIconComponent(role.icon);
        return {
          value: role.id.toString(),
          label: role.name,
          icon: <RoleIcon className="size-4" style={{ color: role.color }} />,
        };
      }),
    ],
    [validRoles]
  );

  const selectedUser = useMemo(
    () => users.find((u) => u.id === selectedUserForRole) ?? null,
    [users, selectedUserForRole]
  );

  const assignableRolesForUser = useMemo(() => {
    if (!selectedUserForRole) return [];
    const user = users.find((u) => u.id === selectedUserForRole);
    return validRoles.filter(
      (role) => !user?.roles?.some((ur) => ur.id === role.id)
    );
  }, [selectedUserForRole, users, validRoles]);

  return (
    <AdminLayout toast={toast} onToastClose={() => setToast(null)}>
      <AdminPage
        title="Roles"
        icon={ShieldCheck}
        actions={
          <>
            <AdminRefreshButton onClick={fetchData} loading={loading} />
            <Button onClick={openCreateModal}>
              <Plus />
              Create role
            </Button>
          </>
        }
      >
        {loading ? (
          <AdminLoading label="Loading roles…" />
        ) : error ? (
          <AdminErrorState
            title="Error loading roles"
            message={error}
            onRetry={fetchData}
          />
        ) : (
          <>
            <AdminStatCards
              columns={4}
              items={[
                { label: 'Roles', value: stats.roleCount },
                { label: 'Users with roles', value: stats.usersWithRoles },
                { label: 'Without role', value: stats.usersWithoutRoles },
                { label: 'Assignments', value: stats.totalAssignments },
              ]}
            />

            <AdminSection title="Roles">
              {validRoles.length === 0 ? (
                <AdminEmptyState
                  icon={ShieldCheck}
                  title="No roles yet"
                  action={
                    <Button size="sm" onClick={openCreateModal}>
                      <Plus />
                      Create role
                    </Button>
                  }
                />
              ) : (
                <AdminTable minWidth="760px">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <span className="sr-only">Reorder</span>
                      </TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Members</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Permissions</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {validRoles.map((role, index) => (
                      <TableRow
                        key={role.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, role.id)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDrop={handleDrop}
                        className={cn(draggedId === role.id && 'opacity-60')}
                      >
                        <TableCell title="Drag to reorder">
                          <GripVertical
                            className="size-4 cursor-grab text-muted-foreground active:cursor-grabbing"
                            aria-hidden
                          />
                        </TableCell>
                        <TableCell className="whitespace-normal">
                          <div className="grid min-w-0 justify-items-start gap-1">
                            <RoleName role={role} className="font-medium" />
                            {role.description && (
                              <p className="line-clamp-1 text-xs text-muted-foreground">
                                {role.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {role.user_count ?? 0}
                        </TableCell>
                        <TableCell className="text-muted-foreground tabular-nums">
                          {role.priority}
                        </TableCell>
                        <TableCell className="whitespace-normal">
                          <PermissionSummary permissions={role.permissions} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Edit ${role.name}`}
                                  onClick={() => openEditModal(role)}
                                >
                                  <Pencil />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit role</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Delete ${role.name}`}
                                  onClick={() => void handleDeleteRole(role)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete role</TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </AdminTable>
              )}
            </AdminSection>

            <AdminSection
              title="User assignments"
              contentClassName="flex flex-col gap-3"
            >
              <AdminToolbar>
                <AdminSearchInput
                  value={userSearch}
                  onChange={setUserSearch}
                  placeholder="Search users…"
                />
                <AdminSelect
                  value={roleFilter}
                  onChange={setRoleFilter}
                  options={roleFilterOptions}
                  placeholder="Filter by role…"
                  searchPlaceholder="Search roles…"
                  aria-label="Filter by role"
                  searchable
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={!hasUserFilters}
                  onClick={clearUserFilters}
                >
                  <X />
                  Clear
                </Button>
              </AdminToolbar>

              {filteredUsers.length === 0 ? (
                <AdminEmptyState
                  icon={Users}
                  title="No users match these filters"
                  action={
                    hasUserFilters ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearUserFilters}
                      >
                        Clear filters
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                <AdminTable minWidth="640px">
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Roles</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <UserAvatar user={user} />
                            <div className="min-w-0">
                              <p className="flex items-center gap-2 truncate font-medium">
                                {user.username}
                                {user.is_admin && (
                                  <AdminStatusBadge tone="info" icon={Code}>
                                    Developer
                                  </AdminStatusBadge>
                                )}
                              </p>
                              <p className="truncate font-mono text-xs text-muted-foreground">
                                {user.id}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-normal">
                          {user.roles && user.roles.length > 0 ? (
                            <div className="flex flex-wrap gap-x-3 gap-y-1">
                              {user.roles.map((role) => (
                                <span
                                  key={role.id}
                                  className="group inline-flex items-center"
                                >
                                  <RoleName role={role} />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleRemoveRole(user.id, role.id)
                                    }
                                    className="ml-0.5 rounded-sm p-0.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-ring [@media(hover:none)]:opacity-100"
                                    title="Remove role"
                                    aria-label={`Remove ${role.name} from ${user.username}`}
                                  >
                                    <X className="size-3.5" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">
                              No roles
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Assign role to ${user.username}`}
                                onClick={() => {
                                  setSelectedUserForRole(user.id);
                                  setShowAddRoleModal(true);
                                }}
                              >
                                <UserPlus />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Assign role</TooltipContent>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </AdminTable>
              )}
            </AdminSection>
          </>
        )}
      </AdminPage>

      <AdminModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create role"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleCreateRole()}
              disabled={submitting}
            >
              {submitting ? 'Creating…' : 'Create role'}
            </Button>
          </>
        }
      >
        {roleFormFields}
      </AdminModal>

      <AdminModal
        open={showEditModal && !!selectedRole}
        onClose={() => setShowEditModal(false)}
        title={selectedRole ? `Edit ${selectedRole.name}` : 'Edit role'}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleEditRole()} disabled={submitting}>
              {submitting ? 'Saving…' : 'Save changes'}
            </Button>
          </>
        }
      >
        {roleFormFields}
      </AdminModal>

      <AdminModal
        open={showAddRoleModal && !!selectedUserForRole}
        onClose={() => {
          setShowAddRoleModal(false);
          setSelectedUserForRole(null);
        }}
        title={
          selectedUser
            ? `Assign role to ${selectedUser.username}`
            : 'Assign role'
        }
        size="sm"
      >
        {assignableRolesForUser.length === 0 ? (
          <AdminEmptyState icon={ShieldCheck} title="Nothing to assign" />
        ) : (
          <div className="-mx-3 grid gap-0.5">
            {assignableRolesForUser.map((role) => {
              const RoleIcon = getIconComponent(role.icon);
              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() =>
                    void handleAssignRole(selectedUserForRole!, role.id)
                  }
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors outline-none hover:bg-accent focus-visible:bg-accent"
                >
                  <RoleIcon
                    className="size-4 shrink-0"
                    style={{ color: role.color }}
                  />
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {role.name}
                  </span>
                  <Plus className="size-4 shrink-0 text-muted-foreground" />
                </button>
              );
            })}
          </div>
        )}
      </AdminModal>

      {confirmDialog}
    </AdminLayout>
  );
}
