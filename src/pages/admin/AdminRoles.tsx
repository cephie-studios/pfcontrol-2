import { useState, useEffect, useMemo } from "react";
import {
  MdAdd,
  MdEdit,
  MdDelete,
  MdPeople,
  MdCheck,
  MdClose,
  MdAdminPanelSettings,
  MdDragIndicator,
  MdFilterList,
} from "react-icons/md";
import AdminRefreshButton from "../../components/admin/AdminRefreshButton";
import AdminLayout from "../../components/admin/AdminLayout";
import AdminModal from "../../components/admin/AdminModal";
import AdminPageHeader from "../../components/admin/AdminPageHeader";
import AdminToolbar from "../../components/admin/AdminToolbar";
import AdminSearchInput from "../../components/admin/AdminSearchInput";
import AdminStatStrip from "../../components/admin/AdminStatStrip";
import AdminTable from "../../components/admin/AdminTable";
import AdminTextInput from "../../components/admin/AdminTextInput";
import {
  adminDownsizeButtonSize,
  adminSectionClass,
  ADMIN_INPUT_ICON_CLASS,
  ADMIN_TABLE_HEAD,
  ADMIN_TH,
  ADMIN_TD,
  ADMIN_TOOLBAR_HEIGHT,
} from "../../components/admin/adminConstants";
import Loader from "../../components/common/Loader";
import Button from "../../components/common/Button";
import ErrorScreen from "../../components/common/ErrorScreen";
import Dropdown from "../../components/common/Dropdown";
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
} from "../../utils/fetch/admin";
import {
  getIconComponent,
  AVAILABLE_ICONS,
  AVAILABLE_PERMISSIONS,
  PRESET_COLORS,
} from "../../utils/roles";

function RoleBadge({ role, compact }: { role: Role; compact?: boolean }) {
  const RoleIcon = getIconComponent(role.icon);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border font-medium ${
        compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs"
      }`}
      style={{
        backgroundColor: `${role.color}18`,
        borderColor: `${role.color}50`,
        color: role.color,
      }}
    >
      <RoleIcon
        className={compact ? "w-3 h-3" : "w-3.5 h-3.5"}
        style={{ color: role.color }}
      />
      {role.name}
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
    return <span className="text-xs text-zinc-600">None</span>;
  }
  return (
    <div className="flex flex-wrap gap-1 max-w-md">
      {enabled.slice(0, 4).map((p) => (
        <span
          key={p.key}
          className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400 border border-zinc-700/60"
        >
          {p.label}
        </span>
      ))}
      {enabled.length > 4 && (
        <span className="text-[10px] text-zinc-500">+{enabled.length - 4}</span>
      )}
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
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPermissions, setFormPermissions] = useState<
    Record<string, boolean>
  >({});
  const [formColor, setFormColor] = useState("#6366F1");
  const [formIcon, setFormIcon] = useState("Star");
  const [formPriority, setFormPriority] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);
  const [showAddRoleModal, setShowAddRoleModal] = useState(false);
  const [selectedUserForRole, setSelectedUserForRole] = useState<string | null>(
    null
  );

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
      if (roleFilter === "all") return true;
      if (roleFilter === "no-role") return !user.roles?.length;
      return (
        user.roles?.some((role) => role.id.toString() === roleFilter) ?? false
      );
    });
  }, [users, userSearch, roleFilter]);

  const hasUserFilters = userSearch.trim() !== "" || roleFilter !== "all";

  const btnSize = adminDownsizeButtonSize("sm");
  const toolbarBtnClass = `shrink-0 ${ADMIN_TOOLBAR_HEIGHT} py-0`;

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
        err instanceof Error ? err.message : "Failed to fetch data";
      setError(errorMessage);
      setToast({ message: errorMessage, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormName("");
    setFormDescription("");
    setFormPermissions({});
    setFormColor("#6366F1");
    setFormIcon("Star");
    setFormPriority(0);
    setSelectedRole(null);
  };

  const handleCreateRole = async () => {
    if (!formName.trim()) {
      setToast({ message: "Role name is required", type: "error" });
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
      setToast({ message: "Role created successfully", type: "success" });
      setShowCreateModal(false);
      resetForm();
      await fetchData();
    } catch (e) {
      setToast({
        message: e instanceof Error ? e.message : "Failed to create role",
        type: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditRole = async () => {
    if (!selectedRole || !formName.trim()) {
      setToast({ message: "Role name is required", type: "error" });
      return;
    }
    if (!selectedRole.id || isNaN(selectedRole.id)) {
      setToast({ message: "Invalid role ID", type: "error" });
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
      setToast({ message: "Role updated successfully", type: "success" });
      setShowEditModal(false);
      resetForm();
      await fetchData();
    } catch (e) {
      setToast({
        message: e instanceof Error ? e.message : "Failed to update role",
        type: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRole = async (role: Role) => {
    if (!role.id || isNaN(role.id)) {
      setToast({ message: "Invalid role ID", type: "error" });
      return;
    }
    if (
      !confirm(
        `Delete "${role.name}"? This removes the role from all assigned users.`
      )
    ) {
      return;
    }
    try {
      await deleteRole(role.id);
      setToast({ message: "Role deleted successfully", type: "success" });
      await fetchData();
    } catch (e) {
      setToast({
        message: e instanceof Error ? e.message : "Failed to delete role",
        type: "error",
      });
    }
  };

  const handleAssignRole = async (userId: string, roleId: number) => {
    try {
      await assignRoleToUser(userId, roleId);
      setToast({ message: "Role assigned successfully", type: "success" });
      setShowAddRoleModal(false);
      setSelectedUserForRole(null);
      await fetchData();
    } catch (e) {
      setToast({
        message: e instanceof Error ? e.message : "Failed to assign role",
        type: "error",
      });
    }
  };

  const handleRemoveRole = async (userId: string, roleId: number) => {
    try {
      await removeRoleFromUser(userId, roleId);
      setToast({ message: "Role removed successfully", type: "success" });
      await fetchData();
    } catch (e) {
      setToast({
        message: e instanceof Error ? e.message : "Failed to remove role",
        type: "error",
      });
    }
  };

  const openEditModal = (role: Role) => {
    setSelectedRole(role);
    setFormName(role.name);
    setFormDescription(role.description || "");
    setFormPermissions(role.permissions);
    setFormColor(role.color || "#6366F1");
    setFormIcon(role.icon || "Star");
    setFormPriority(
      typeof role.priority === "number" && !isNaN(role.priority)
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
      setToast({ message: "No valid roles to update", type: "error" });
      return;
    }
    try {
      await updateRolePriorities(rolePriorities);
      setToast({ message: "Role order saved", type: "success" });
      await fetchData();
    } catch (e) {
      setToast({
        message:
          e instanceof Error ? e.message : "Failed to update role priorities",
        type: "error",
      });
      await fetchData();
    }
  };

  const clearUserFilters = () => {
    setUserSearch("");
    setRoleFilter("all");
  };

  const roleFormFields = (
    <div className="space-y-4">
      <AdminTextInput
        label="Role name"
        value={formName}
        onChange={setFormName}
        placeholder="e.g. Moderator"
        required
      />
      <AdminTextInput
        label="Description"
        value={formDescription}
        onChange={setFormDescription}
        placeholder="What this role is for…"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <span className="block text-xs text-zinc-500 mb-1.5">Icon</span>
          <div className="grid grid-cols-4 gap-2">
            {AVAILABLE_ICONS.map((iconOption) => {
              const IconComponent = iconOption.icon;
              return (
                <button
                  key={iconOption.value}
                  type="button"
                  onClick={() => setFormIcon(iconOption.value)}
                  className={`p-2.5 rounded-xl border transition-colors ${
                    formIcon === iconOption.value
                      ? "border-blue-600 bg-blue-600/15"
                      : "border-zinc-700/80 bg-zinc-900/40 hover:border-zinc-600"
                  }`}
                  title={iconOption.label}
                >
                  <IconComponent className="w-5 h-5 text-zinc-200 mx-auto" />
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <span className="block text-xs text-zinc-500 mb-1.5">Color</span>
          <div className="grid grid-cols-5 gap-2 mb-2">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setFormColor(color)}
                className={`h-9 rounded-lg border-2 transition-all ${
                  formColor === color
                    ? "border-white ring-2 ring-white/40"
                    : "border-transparent"
                }`}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="color"
              value={formColor}
              onChange={(e) => setFormColor(e.target.value)}
              className="h-10 flex-1 rounded-full border-2 border-blue-600 bg-zinc-900 cursor-pointer"
            />
            <input
              type="text"
              value={formColor}
              onChange={(e) => setFormColor(e.target.value)}
              className="w-24 h-10 px-3 rounded-full border-2 border-blue-600 bg-gray-800 text-white text-sm font-mono"
            />
          </div>
        </div>
      </div>
      <AdminTextInput
        label="Priority (higher = more important)"
        value={String(formPriority)}
        onChange={(v) => {
          const parsed = parseInt(v, 10);
          setFormPriority(Number.isNaN(parsed) ? 0 : parsed);
        }}
        placeholder="0"
      />
      <div>
        <span className="block text-xs text-zinc-500 mb-1.5">Permissions</span>
        <div className="space-y-2 rounded-xl border border-zinc-800/60 divide-y divide-zinc-800/80 overflow-hidden">
          {AVAILABLE_PERMISSIONS.map((permission) => (
            <div
              key={permission.key}
              className="flex items-center justify-between gap-3 px-3 py-2.5 bg-zinc-900/30"
            >
              <div className="min-w-0">
                <p className="text-sm text-zinc-200 font-medium">
                  {permission.label}
                </p>
                <p className="text-xs text-zinc-500">
                  {permission.description}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setFormPermissions((prev) => ({
                    ...prev,
                    [permission.key]: !prev[permission.key],
                  }))
                }
                className={`shrink-0 w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-colors ${
                  formPermissions[permission.key]
                    ? "bg-blue-600 border-blue-600"
                    : "border-zinc-600 hover:border-zinc-500"
                }`}
                aria-pressed={!!formPermissions[permission.key]}
              >
                {formPermissions[permission.key] && (
                  <MdCheck className="w-4 h-4 text-white" />
                )}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const roleFilterOptions = useMemo(
    () => [
      { value: "all", label: "All users" },
      { value: "no-role", label: "No role" },
      ...validRoles.map((role) => ({
        value: role.id.toString(),
        label: role.name,
      })),
    ],
    [validRoles]
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
      <AdminPageHeader
        title="Roles"
        icon={MdAdminPanelSettings}
        accent="rose"
        actions={
          <>
            <AdminRefreshButton onClick={fetchData} loading={loading} />
            <Button
              onClick={openCreateModal}
              variant="primary"
              size="sm"
              className={`${toolbarBtnClass} flex items-center gap-1.5`}
            >
              <MdAdd size={18} />
              Create role
            </Button>
          </>
        }
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader />
        </div>
      ) : error ? (
        <ErrorScreen
          title="Error loading roles"
          message={error}
          onRetry={fetchData}
        />
      ) : (
        <>
          <AdminStatStrip
            columns={4}
            items={[
              { label: "Roles", value: stats.roleCount },
              { label: "Users with roles", value: stats.usersWithRoles },
              { label: "Without role", value: stats.usersWithoutRoles },
              { label: "Assignments", value: stats.totalAssignments },
            ]}
          />

          <div className={adminSectionClass("!mt-0 !pt-0 !border-t-0")}>
            <p className="text-xs text-zinc-500 mb-3">
              Drag rows to set display priority (top = highest). Changes save on
              drop.
            </p>

            <div className="hidden lg:block">
              <AdminTable minWidth="900px">
                <thead className={ADMIN_TABLE_HEAD}>
                  <tr>
                    <th className={`${ADMIN_TH} w-10`} aria-label="Reorder" />
                    <th className={ADMIN_TH}>Role</th>
                    <th className={ADMIN_TH}>Members</th>
                    <th className={ADMIN_TH}>Priority</th>
                    <th className={ADMIN_TH}>Permissions</th>
                    <th className={`${ADMIN_TH} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80">
                  {validRoles.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className={`${ADMIN_TD} text-center text-zinc-500 py-12`}
                      >
                        No roles yet. Create one to get started.
                      </td>
                    </tr>
                  ) : (
                    validRoles.map((role, index) => (
                      <tr
                        key={role.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, role.id)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDrop={handleDrop}
                        className={`hover:bg-zinc-800/30 ${
                          draggedId === role.id ? "opacity-60" : ""
                        }`}
                      >
                        <td className={ADMIN_TD}>
                          <MdDragIndicator
                            className="w-5 h-5 text-zinc-600 cursor-grab active:cursor-grabbing"
                            aria-hidden
                          />
                        </td>
                        <td className={ADMIN_TD}>
                          <div className="min-w-0">
                            <RoleBadge role={role} />
                            {role.description && (
                              <p className="text-xs text-zinc-500 mt-1 line-clamp-1">
                                {role.description}
                              </p>
                            )}
                          </div>
                        </td>
                        <td
                          className={`${ADMIN_TD} text-zinc-300 tabular-nums`}
                        >
                          {role.user_count ?? 0}
                        </td>
                        <td
                          className={`${ADMIN_TD} text-zinc-400 text-sm tabular-nums`}
                        >
                          {role.priority}
                        </td>
                        <td className={ADMIN_TD}>
                          <PermissionSummary permissions={role.permissions} />
                        </td>
                        <td className={`${ADMIN_TD} text-right`}>
                          <div className="flex justify-end gap-1.5">
                            <Button
                              type="button"
                              variant="outline"
                              size={btnSize}
                              onClick={() => openEditModal(role)}
                            >
                              <MdEdit className="w-3.5 h-3.5 inline mr-1" />
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="danger"
                              size={btnSize}
                              onClick={() => void handleDeleteRole(role)}
                            >
                              <MdDelete className="w-3.5 h-3.5 inline mr-1" />
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </AdminTable>
            </div>

            <ul className="lg:hidden space-y-3">
              {validRoles.length === 0 ? (
                <li className="text-center py-10 text-zinc-500 text-sm">
                  No roles yet. Create one to get started.
                </li>
              ) : (
                validRoles.map((role, index) => (
                  <li
                    key={role.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, role.id)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={handleDrop}
                    className="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-4"
                  >
                    <div className="flex items-start gap-2">
                      <MdDragIndicator className="w-5 h-5 text-zinc-600 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <RoleBadge role={role} />
                        {role.description && (
                          <p className="text-xs text-zinc-500 mt-2">
                            {role.description}
                          </p>
                        )}
                        <p className="text-xs text-zinc-500 mt-2">
                          {role.user_count ?? 0} members · priority{" "}
                          {role.priority}
                        </p>
                        <div className="mt-2">
                          <PermissionSummary permissions={role.permissions} />
                        </div>
                        <div className="flex gap-2 mt-3">
                          <Button
                            type="button"
                            variant="outline"
                            size={btnSize}
                            onClick={() => openEditModal(role)}
                            className="flex-1"
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            size={btnSize}
                            onClick={() => void handleDeleteRole(role)}
                            className="flex-1"
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className={adminSectionClass()}>
            <AdminToolbar>
              <AdminSearchInput
                value={userSearch}
                onChange={setUserSearch}
                placeholder="Search users…"
              />
              <div className="relative w-full sm:w-52 shrink-0">
                <span className={ADMIN_INPUT_ICON_CLASS} aria-hidden>
                  <MdFilterList size={18} />
                </span>
                <Dropdown
                  value={roleFilter}
                  onChange={setRoleFilter}
                  options={roleFilterOptions}
                  placeholder="Filter by role…"
                  className="!pl-11"
                  size="sm"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!hasUserFilters}
                onClick={clearUserFilters}
                className={toolbarBtnClass}
              >
                <MdClose size={16} className="mr-1" />
                Clear
              </Button>
            </AdminToolbar>

            <div className="hidden md:block">
              <AdminTable minWidth="800px">
                <thead className={ADMIN_TABLE_HEAD}>
                  <tr>
                    <th className={ADMIN_TH}>User</th>
                    <th className={ADMIN_TH}>Roles</th>
                    <th className={`${ADMIN_TH} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        className={`${ADMIN_TD} text-center text-zinc-500 py-12`}
                      >
                        No users match these filters.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-zinc-800/30">
                        <td className={ADMIN_TD}>
                          <div className="flex items-center gap-3">
                            {user.avatar ? (
                              <img
                                src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`}
                                alt=""
                                className="w-9 h-9 rounded-full shrink-0"
                              />
                            ) : (
                              <div className="w-9 h-9 bg-zinc-700 rounded-full flex items-center justify-center shrink-0">
                                <MdPeople className="w-4 h-4 text-zinc-400" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="font-medium text-zinc-100 truncate">
                                {user.username}
                                {user.is_admin && (
                                  <span className="ml-2 text-[10px] uppercase tracking-wide text-blue-400/90 font-semibold">
                                    Dev
                                  </span>
                                )}
                              </p>
                              <p className="text-[11px] text-zinc-500 font-mono truncate">
                                {user.id}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className={ADMIN_TD}>
                          {user.roles && user.roles.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {user.roles.map((role) => (
                                <span
                                  key={role.id}
                                  className="inline-flex items-center group"
                                >
                                  <RoleBadge role={role} compact />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleRemoveRole(user.id, role.id)
                                    }
                                    className="ml-0.5 p-0.5 rounded opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-white transition-opacity"
                                    title="Remove role"
                                  >
                                    <MdClose size={14} />
                                  </button>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-zinc-600">
                              No roles
                            </span>
                          )}
                        </td>
                        <td className={`${ADMIN_TD} text-right`}>
                          <Button
                            type="button"
                            variant="outline"
                            size={btnSize}
                            onClick={() => {
                              setSelectedUserForRole(user.id);
                              setShowAddRoleModal(true);
                            }}
                          >
                            <MdAdd className="w-3.5 h-3.5 inline mr-1" />
                            Add role
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </AdminTable>
            </div>

            <ul className="md:hidden space-y-3">
              {filteredUsers.length === 0 ? (
                <li className="text-center py-10 text-zinc-500 text-sm">
                  No users match these filters.
                </li>
              ) : (
                filteredUsers.map((user) => (
                  <li
                    key={user.id}
                    className="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-4"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      {user.avatar ? (
                        <img
                          src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`}
                          alt=""
                          className="w-9 h-9 rounded-full"
                        />
                      ) : (
                        <div className="w-9 h-9 bg-zinc-700 rounded-full flex items-center justify-center">
                          <MdPeople className="w-4 h-4 text-zinc-400" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-zinc-100 truncate">
                          {user.username}
                        </p>
                        <p className="text-[11px] text-zinc-500 font-mono truncate">
                          {user.id}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size={btnSize}
                        onClick={() => {
                          setSelectedUserForRole(user.id);
                          setShowAddRoleModal(true);
                        }}
                      >
                        <MdAdd size={18} />
                      </Button>
                    </div>
                    {user.roles && user.roles.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {user.roles.map((role) => (
                          <span
                            key={role.id}
                            className="inline-flex items-center"
                          >
                            <RoleBadge role={role} compact />
                            <button
                              type="button"
                              onClick={() =>
                                void handleRemoveRole(user.id, role.id)
                              }
                              className="ml-1 text-zinc-500 hover:text-white"
                            >
                              <MdClose size={14} />
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-600">No roles assigned</p>
                    )}
                  </li>
                ))
              )}
            </ul>
          </div>
        </>
      )}

      <AdminModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create role"
        size="xl"
        footer={
          <>
            <Button
              onClick={() => setShowCreateModal(false)}
              variant="outline"
              size={btnSize}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleCreateRole()}
              disabled={submitting}
              variant="primary"
              size={btnSize}
            >
              {submitting ? "Creating…" : "Create role"}
            </Button>
          </>
        }
      >
        {roleFormFields}
      </AdminModal>

      <AdminModal
        open={showEditModal && !!selectedRole}
        onClose={() => setShowEditModal(false)}
        title={selectedRole ? `Edit ${selectedRole.name}` : "Edit role"}
        size="xl"
        footer={
          <>
            <Button
              onClick={() => setShowEditModal(false)}
              variant="outline"
              size={btnSize}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleEditRole()}
              disabled={submitting}
              variant="primary"
              size={btnSize}
            >
              {submitting ? "Saving…" : "Save changes"}
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
        title="Assign role"
        size="sm"
      >
        {assignableRolesForUser.length === 0 ? (
          <p className="text-sm text-zinc-500 py-2">
            This user already has every role, or no roles exist.
          </p>
        ) : (
          <div className="space-y-2">
            {assignableRolesForUser.map((role) => {
              const RoleIcon = getIconComponent(role.icon);
              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() =>
                    void handleAssignRole(selectedUserForRole!, role.id)
                  }
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-zinc-800/60 bg-zinc-900/30 hover:bg-zinc-800/40 transition-colors text-left"
                >
                  <RoleIcon
                    className="w-5 h-5 shrink-0"
                    style={{ color: role.color }}
                  />
                  <span className="text-sm text-zinc-100 font-medium">
                    {role.name}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </AdminModal>
    </AdminLayout>
  );
}