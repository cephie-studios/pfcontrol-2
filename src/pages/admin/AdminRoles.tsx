import { useState, useEffect } from 'react';
import {
  Plus,
  Edit,
  Trash2,
  Users,
  Check,
  X,
  ShieldUser,
  GripVertical,
  Search,
  Filter,
} from 'lucide-react';
import Navbar from '../../components/Navbar';
import AdminSidebar from '../../components/admin/AdminSidebar';
import Loader from '../../components/common/Loader';
import Button from '../../components/common/Button';
import TextInput from '../../components/common/TextInput';
import Toast from '../../components/common/Toast';
import ErrorScreen from '../../components/common/ErrorScreen';
import Dropdown from '../../components/common/Dropdown';
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

function RoleItem({
  role,
  index,
  onEdit,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  role: Role;
  index: number;
  onEdit: (role: Role) => void;
  onDelete: (role: Role) => void;
  onDragStart: (e: React.DragEvent, roleId: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDrop: (e: React.DragEvent, roleId: number) => void;
}) {
  const RoleIcon = getIconComponent(role.icon);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, role.id)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={(e) => onDrop(e, role.id)}
      className="bg-zinc-800 border border-zinc-700 rounded-lg p-4 hover:border-zinc-600 transition-all cursor-move"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3 flex-1">
          {/* Drag Handle */}
          <div className="cursor-grab active:cursor-grabbing touch-none">
            <GripVertical className="w-5 h-5 text-zinc-500 hover:text-zinc-300" />
          </div>

          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 transition-all"
                style={{
                  backgroundColor: `${role.color}20`,
                  borderColor: `${role.color}60`,
                }}
              >
                <RoleIcon className="w-4 h-4" style={{ color: role.color }} />
                <span
                  className="text-sm font-semibold"
                  style={{ color: role.color }}
                >
                  {role.name}
                </span>
              </div>
              <span className="px-2 py-1 bg-zinc-600/50 text-zinc-300 text-xs rounded-full">
                {role.user_count || 0} users
              </span>
              <span className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded-full border border-blue-500/30">
                Priority: {role.priority}
              </span>
            </div>
            {role.description && (
              <p className="text-zinc-400 text-sm mb-3">{role.description}</p>
            )}
            <div className="flex flex-wrap gap-2">
              {Object.entries(role.permissions)
                .filter(([, enabled]) => enabled)
                .map(([permission]) => {
                  const permissionInfo = AVAILABLE_PERMISSIONS.find(
                    (p) => p.key === permission
                  );
                  return (
                    <span
                      key={permission}
                      className="px-2 py-1 bg-rose-500/20 text-rose-300 text-xs rounded border border-rose-500/30"
                    >
                      {permissionInfo?.label || permission}
                    </span>
                  );
                })}
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2 ml-4">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onEdit(role)}
            className="flex items-center space-x-2"
          >
            <Edit className="w-4 h-4" />
            <span>Edit</span>
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => onDelete(role)}
            className="flex items-center space-x-2"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AdminRoles() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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

  useEffect(() => {
    fetchData();
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
      fetchData();
    } catch (error) {
      setToast({
        message:
          error instanceof Error ? error.message : 'Failed to create role',
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
      fetchData();
    } catch (error) {
      setToast({
        message:
          error instanceof Error ? error.message : 'Failed to update role',
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

    if (
      !confirm(
        `Are you sure you want to delete the "${role.name}" role? This will remove the role from all assigned users.`
      )
    ) {
      return;
    }

    try {
      await deleteRole(role.id);
      setToast({ message: 'Role deleted successfully', type: 'success' });
      fetchData();
    } catch (error) {
      setToast({
        message:
          error instanceof Error ? error.message : 'Failed to delete role',
        type: 'error',
      });
    }
  };

  const handleAssignRole = async (userId: string, roleId: number) => {
    try {
      await assignRoleToUser(userId, roleId);
      setToast({
        message: 'Role assigned successfully',
        type: 'success',
      });
      fetchData();
    } catch (error) {
      setToast({
        message:
          error instanceof Error ? error.message : 'Failed to assign role',
        type: 'error',
      });
    }
  };

  const handleRemoveRole = async (userId: string, roleId: number) => {
    try {
      await removeRoleFromUser(userId, roleId);
      setToast({ message: 'Role removed successfully', type: 'success' });
      fetchData();
    } catch (error) {
      setToast({
        message:
          error instanceof Error ? error.message : 'Failed to remove role',
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

  const handleDragStart = (e: React.DragEvent, draggedId: number) => {
    setDraggedId(draggedId);
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

  const handleDrop = async (e: React.DragEvent, droppedId: number) => {
    e.preventDefault();
    setDraggedId(null);
    const rolePriorities = roles
      .filter((role) => role.id && !isNaN(role.id))
      .map((role, index) => ({
        id: role.id,
        priority: roles.length - index,
      }));

    if (rolePriorities.length === 0) {
      setToast({
        message: 'No valid roles to update',
        type: 'error',
      });
      return;
    }

    try {
      await updateRolePriorities(rolePriorities);
      setToast({
        message: 'Role priorities updated successfully',
        type: 'success',
      });
      fetchData();
    } catch (error) {
      setToast({
        message:
          error instanceof Error
            ? error.message
            : 'Failed to update role priorities',
        type: 'error',
      });
      fetchData();
    }
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch = user.username
      .toLowerCase()
      .includes(userSearch.toLowerCase());

    if (roleFilter === 'all') {
      return matchesSearch;
    } else if (roleFilter === 'no-role') {
      return matchesSearch && (!user.roles || user.roles.length === 0);
    } else {
      return (
        matchesSearch &&
        user.roles?.some((role) => role.id.toString() === roleFilter)
      );
    }
  });

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />
      <div className="flex pt-16">
        <AdminSidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        <div className="flex-1 p-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <div className="p-3 bg-rose-500/20 rounded-xl mr-4">
                  <ShieldUser className="h-8 w-8 text-rose-400" />
                </div>
                <h1
                  className="text-5xl text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-rose-600 font-extrabold mb-2"
                  style={{ lineHeight: 1.4 }}
                >
                  Role Management
                </h1>
              </div>
              <Button
                onClick={openCreateModal}
                variant="outline"
                className="flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Create Role</span>
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader />
            </div>
          ) : error ? (
            <ErrorScreen
              title="Error loading roles"
              message={error}
              onRetry={fetchData}
            />
          ) : (
            <div className="space-y-8">
              {/* Roles Section */}
              <div className="bg-zinc-900 border-2 border-zinc-700/50 rounded-2xl p-6">
                <h2 className="text-xl font-semibold text-white mb-4">Roles</h2>
                <div className="space-y-4">
                  {roles
                    .filter((role) => role.id && !isNaN(role.id))
                    .map((role, index) => (
                      <RoleItem
                        key={role.id}
                        role={role}
                        index={index}
                        onEdit={openEditModal}
                        onDelete={handleDeleteRole}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                      />
                    ))}
                </div>
              </div>

              {/* Users with Roles Section */}
              <div className="bg-zinc-900 border-2 border-zinc-700/50 rounded-2xl p-6">
                <h2 className="text-xl font-semibold text-white mb-4">
                  Roled Users
                </h2>

                {/* Search and Filter */}
                <div className="flex space-x-4 mb-6">
                  <div className="flex-1 relative group">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-zinc-400 group-focus-within:text-rose-400 transition-colors" />
                    <input
                      type="text"
                      placeholder="Search by username..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="w-full pl-11 pr-10 py-3 bg-zinc-900/50 border-2 border-zinc-700 rounded-full text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500 transition-all duration-200 hover:border-zinc-600"
                    />
                  </div>
                  <div className="relative w-52">
                    <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400 z-10 ml-3 pointer-events-none" />
                    <Dropdown
                      value={roleFilter}
                      onChange={setRoleFilter}
                      options={[
                        {
                          value: 'all',
                          label: 'All Roles',
                        },
                        {
                          value: 'no-role',
                          label: 'No Role',
                        },
                        ...roles.map((role) => ({
                          value: role.id.toString(),
                          label: role.name,
                        })),
                      ]}
                      placeholder="Filter by role..."
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  {filteredUsers.map((user) => (
                    <div
                      key={user.id}
                      className="bg-zinc-800 border border-zinc-700 rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          {user.avatar ? (
                            <img
                              src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`}
                              alt={user.username}
                              className="w-10 h-10 rounded-full"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-zinc-600 rounded-full flex items-center justify-center">
                              <Users className="w-5 h-5 text-zinc-400" />
                            </div>
                          )}
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <span className="text-white font-medium">
                                {user.username}
                              </span>
                              {user.is_admin && (
                                <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded border border-blue-500/30">
                                  Developer
                                </span>
                              )}
                            </div>
                            <span className="text-zinc-400 text-xs block mb-2">
                              {user.id}
                            </span>
                            {user.roles && user.roles.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {user.roles.map((role) => {
                                  const RoleIcon = getIconComponent(role.icon);
                                  return (
                                    <div
                                      key={role.id}
                                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border transition-all group"
                                      style={{
                                        backgroundColor: `${role.color}15`,
                                        borderColor: `${role.color}40`,
                                      }}
                                    >
                                      <RoleIcon
                                        className="w-3 h-3"
                                        style={{
                                          color: role.color,
                                        }}
                                      />
                                      <span
                                        className="text-xs font-medium"
                                        style={{
                                          color: role.color,
                                        }}
                                      >
                                        {role.name}
                                      </span>
                                      <button
                                        onClick={() =>
                                          handleRemoveRole(user.id, role.id)
                                        }
                                        className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="Remove role"
                                      >
                                        <X className="w-3 h-3 text-zinc-400 hover:text-white" />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Dropdown
                            options={[
                              {
                                value: '',
                                label: '+ Add Role',
                              },
                              ...roles
                                .filter(
                                  (role) =>
                                    !user.roles?.some((ur) => ur.id === role.id)
                                )
                                .map((role) => ({
                                  value: role.id.toString(),
                                  label: role.name,
                                })),
                            ]}
                            value=""
                            onChange={(val) => {
                              if (val !== '') {
                                handleAssignRole(user.id, parseInt(val));
                              }
                            }}
                            size="sm"
                            className="w-40"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Create Role Modal */}
          {showCreateModal && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-white">
                    Create New Role
                  </h2>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCreateModal(false)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-zinc-300 mb-2">
                      Role Name
                    </label>
                    <TextInput
                      value={formName}
                      onChange={setFormName}
                      placeholder="Enter role name..."
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-300 mb-2">
                      Description
                    </label>
                    <TextInput
                      value={formDescription}
                      onChange={setFormDescription}
                      placeholder="Enter role description..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-zinc-300 mb-2">Icon</label>
                      <div className="grid grid-cols-4 gap-2">
                        {AVAILABLE_ICONS.map((iconOption) => {
                          const IconComponent = iconOption.icon;
                          return (
                            <button
                              key={iconOption.value}
                              type="button"
                              onClick={() => setFormIcon(iconOption.value)}
                              className={`p-3 rounded-lg border-2 transition-all hover:scale-105 ${
                                formIcon === iconOption.value
                                  ? 'border-rose-500 bg-rose-500/20'
                                  : 'border-zinc-700 hover:border-zinc-600'
                              }`}
                              title={iconOption.label}
                            >
                              <IconComponent className="w-5 h-5 text-white mx-auto" />
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="block text-zinc-300 mb-2">Color</label>
                      <div className="space-y-3">
                        <div className="grid grid-cols-5 gap-2">
                          {PRESET_COLORS.map((color) => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => setFormColor(color)}
                              className={`w-full h-10 rounded-lg border-2 transition-all hover:scale-105 ${
                                formColor === color
                                  ? 'border-white ring-2 ring-white/50'
                                  : 'border-transparent'
                              }`}
                              style={{
                                backgroundColor: color,
                              }}
                              title={color}
                            />
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={formColor}
                            onChange={(e) => setFormColor(e.target.value)}
                            className="w-full h-10 rounded-lg border-2 border-zinc-700 bg-zinc-800 cursor-pointer"
                          />
                          <input
                            type="text"
                            value={formColor}
                            onChange={(e) => setFormColor(e.target.value)}
                            className="w-24 h-10 px-3 bg-zinc-800 border-2 border-zinc-700 rounded-lg text-white text-sm font-mono"
                            placeholder="#000000"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-zinc-300 mb-2">
                      Priority (higher numbers appear first)
                    </label>
                    <TextInput
                      value={formPriority.toString()}
                      onChange={(val) => {
                        const parsed = parseInt(val);
                        setFormPriority(isNaN(parsed) ? 0 : parsed);
                      }}
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-300 mb-2">
                      Permissions
                    </label>
                    <div className="space-y-3">
                      {AVAILABLE_PERMISSIONS.map((permission) => (
                        <div
                          key={permission.key}
                          className="flex items-center justify-between p-3 bg-zinc-800 rounded border border-zinc-700"
                        >
                          <div>
                            <div className="text-white font-medium">
                              {permission.label}
                            </div>
                            <div className="text-zinc-400 text-sm">
                              {permission.description}
                            </div>
                          </div>
                          <button
                            onClick={() =>
                              setFormPermissions((prev) => ({
                                ...prev,
                                [permission.key]: !prev[permission.key],
                              }))
                            }
                            className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                              formPermissions[permission.key]
                                ? 'bg-rose-500 border-rose-500'
                                : 'border-zinc-600 hover:border-zinc-500'
                            }`}
                          >
                            {formPermissions[permission.key] && (
                              <Check className="w-4 h-4 text-white" />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex space-x-3 pt-4">
                    <Button
                      onClick={handleCreateRole}
                      disabled={submitting}
                      variant="primary"
                      className="flex-1"
                    >
                      {submitting ? 'Creating...' : 'Create Role'}
                    </Button>
                    <Button
                      onClick={() => setShowCreateModal(false)}
                      variant="outline"
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Edit Role Modal */}
          {showEditModal && selectedRole && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-white">
                    Edit Role: {selectedRole.name}
                  </h2>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowEditModal(false)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-zinc-300 mb-2">
                      Role Name
                    </label>
                    <TextInput
                      value={formName}
                      onChange={setFormName}
                      placeholder="Enter role name..."
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-300 mb-2">
                      Description
                    </label>
                    <TextInput
                      value={formDescription}
                      onChange={setFormDescription}
                      placeholder="Enter role description..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-zinc-300 mb-2">Icon</label>
                      <div className="grid grid-cols-4 gap-2">
                        {AVAILABLE_ICONS.map((iconOption) => {
                          const IconComponent = iconOption.icon;
                          return (
                            <button
                              key={iconOption.value}
                              type="button"
                              onClick={() => setFormIcon(iconOption.value)}
                              className={`p-3 rounded-lg border-2 transition-all hover:scale-105 ${
                                formIcon === iconOption.value
                                  ? 'border-rose-500 bg-rose-500/20'
                                  : 'border-zinc-700 hover:border-zinc-600'
                              }`}
                              title={iconOption.label}
                            >
                              <IconComponent className="w-5 h-5 text-white mx-auto" />
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="block text-zinc-300 mb-2">Color</label>
                      <div className="space-y-3">
                        <div className="grid grid-cols-5 gap-2">
                          {PRESET_COLORS.map((color) => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => setFormColor(color)}
                              className={`w-full h-10 rounded-lg border-2 transition-all hover:scale-105 ${
                                formColor === color
                                  ? 'border-white ring-2 ring-white/50'
                                  : 'border-transparent'
                              }`}
                              style={{
                                backgroundColor: color,
                              }}
                              title={color}
                            />
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={formColor}
                            onChange={(e) => setFormColor(e.target.value)}
                            className="w-full h-10 rounded-lg border-2 border-zinc-700 bg-zinc-800 cursor-pointer"
                          />
                          <input
                            type="text"
                            value={formColor}
                            onChange={(e) => setFormColor(e.target.value)}
                            className="w-24 h-10 px-3 bg-zinc-800 border-2 border-zinc-700 rounded-lg text-white text-sm font-mono"
                            placeholder="#000000"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-zinc-300 mb-2">
                      Priority (higher numbers appear first)
                    </label>
                    <TextInput
                      value={formPriority.toString()}
                      onChange={(val) => {
                        const parsed = parseInt(val);
                        setFormPriority(isNaN(parsed) ? 0 : parsed);
                      }}
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-300 mb-2">
                      Permissions
                    </label>
                    <div className="space-y-3">
                      {AVAILABLE_PERMISSIONS.map((permission) => (
                        <div
                          key={permission.key}
                          className="flex items-center justify-between p-3 bg-zinc-800 rounded border border-zinc-700"
                        >
                          <div>
                            <div className="text-white font-medium">
                              {permission.label}
                            </div>
                            <div className="text-zinc-400 text-sm">
                              {permission.description}
                            </div>
                          </div>
                          <button
                            onClick={() =>
                              setFormPermissions((prev) => ({
                                ...prev,
                                [permission.key]: !prev[permission.key],
                              }))
                            }
                            className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                              formPermissions[permission.key]
                                ? 'bg-rose-500 border-rose-500'
                                : 'border-zinc-600 hover:border-zinc-500'
                            }`}
                          >
                            {formPermissions[permission.key] && (
                              <Check className="w-4 h-4 text-white" />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex space-x-3 pt-4">
                    <Button
                      onClick={handleEditRole}
                      disabled={submitting}
                      variant="primary"
                      className="flex-1"
                    >
                      {submitting ? 'Updating...' : 'Update Role'}
                    </Button>
                    <Button
                      onClick={() => setShowEditModal(false)}
                      variant="outline"
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
