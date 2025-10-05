import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Users, Check, X, ShieldUser } from 'lucide-react';
import Navbar from '../../components/Navbar';
import AdminSidebar from '../../components/admin/AdminSidebar';
import Loader from '../../components/common/Loader';
import Button from '../../components/common/Button';
import TextInput from '../../components/common/TextInput';
import Toast from '../../components/common/Toast';
import ErrorScreen from '../../components/common/ErrorScreen';
import {
    fetchRoles,
    createRole,
    updateRole,
    deleteRole,
    assignRoleToUser,
    removeRoleFromUser,
    fetchUsersWithRoles,
    type Role,
    type UserWithRole,
} from '../../utils/fetch/admin';

const AVAILABLE_PERMISSIONS = [
    {
        key: 'admin',
        label: 'Admin Dashboard',
        description: 'Access to admin overview',
    },
    {
        key: 'users',
        label: 'User Management',
        description: 'View and manage users',
    },
    {
        key: 'sessions',
        label: 'Session Management',
        description: 'View and manage sessions',
    },
    {
        key: 'audit',
        label: 'Audit Logs',
        description: 'View audit logs and security events',
    },
    {
        key: 'bans',
        label: 'Ban Management',
        description: 'Ban and unban users',
    },
    {
        key: 'testers',
        label: 'Tester Management',
        description: 'Manage beta testers',
    },
    {
        key: 'notifications',
        label: 'Notifications',
        description: 'Manage system notifications',
    },
    {
        key: 'roles',
        label: 'Role Management',
        description: 'Create and manage roles (admin only)',
    },
];

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
    const [submitting, setSubmitting] = useState(false);

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
            });
            setToast({ message: 'Role created successfully', type: 'success' });
            setShowCreateModal(false);
            resetForm();
            fetchData();
        } catch (error) {
            setToast({
                message:
                    error instanceof Error
                        ? error.message
                        : 'Failed to create role',
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

        try {
            setSubmitting(true);
            await updateRole(selectedRole.id, {
                name: formName.trim(),
                description: formDescription.trim(),
                permissions: formPermissions,
            });
            setToast({ message: 'Role updated successfully', type: 'success' });
            setShowEditModal(false);
            resetForm();
            fetchData();
        } catch (error) {
            setToast({
                message:
                    error instanceof Error
                        ? error.message
                        : 'Failed to update role',
                type: 'error',
            });
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteRole = async (role: Role) => {
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
                    error instanceof Error
                        ? error.message
                        : 'Failed to delete role',
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
                    error instanceof Error
                        ? error.message
                        : 'Failed to assign role',
                type: 'error',
            });
        }
    };

    const handleRemoveRole = async (userId: string) => {
        try {
            await removeRoleFromUser(userId);
            setToast({ message: 'Role removed successfully', type: 'success' });
            fetchData();
        } catch (error) {
            setToast({
                message:
                    error instanceof Error
                        ? error.message
                        : 'Failed to remove role',
                type: 'error',
            });
        }
    };

    const openEditModal = (role: Role) => {
        setSelectedRole(role);
        setFormName(role.name);
        setFormDescription(role.description || '');
        setFormPermissions(role.permissions);
        setShowEditModal(true);
    };

    const openCreateModal = () => {
        resetForm();
        setShowCreateModal(true);
    };

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
                                <h2 className="text-xl font-semibold text-white mb-4">
                                    Roles
                                </h2>
                                <div className="space-y-4">
                                    {roles.map((role) => (
                                        <div
                                            key={role.id}
                                            className="bg-zinc-800 border border-zinc-700 rounded-lg p-4"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center space-x-3 mb-2">
                                                        <h3 className="text-lg font-medium text-white">
                                                            {role.name}
                                                        </h3>
                                                        <span className="px-2 py-1 bg-zinc-600/50 text-zinc-300 text-xs rounded-full">
                                                            {role.user_count ||
                                                                0}{' '}
                                                            users
                                                        </span>
                                                    </div>
                                                    {role.description && (
                                                        <p className="text-zinc-400 text-sm mb-3">
                                                            {role.description}
                                                        </p>
                                                    )}
                                                    <div className="flex flex-wrap gap-2">
                                                        {Object.entries(
                                                            role.permissions
                                                        )
                                                            .filter(
                                                                ([, enabled]) =>
                                                                    enabled
                                                            )
                                                            .map(
                                                                ([
                                                                    permission,
                                                                ]) => {
                                                                    const permissionInfo =
                                                                        AVAILABLE_PERMISSIONS.find(
                                                                            (
                                                                                p
                                                                            ) =>
                                                                                p.key ===
                                                                                permission
                                                                        );
                                                                    return (
                                                                        <span
                                                                            key={
                                                                                permission
                                                                            }
                                                                            className="px-2 py-1 bg-rose-500/20 text-rose-300 text-xs rounded border border-rose-500/30"
                                                                        >
                                                                            {permissionInfo?.label ||
                                                                                permission}
                                                                        </span>
                                                                    );
                                                                }
                                                            )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center space-x-2 ml-4">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() =>
                                                            openEditModal(role)
                                                        }
                                                        className="flex items-center space-x-2"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                        <span>Edit</span>
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="danger"
                                                        onClick={() =>
                                                            handleDeleteRole(
                                                                role
                                                            )
                                                        }
                                                        className="flex items-center space-x-2"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                        <span>Delete</span>
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Users with Roles Section */}
                            <div className="bg-zinc-900 border-2 border-zinc-700/50 rounded-2xl p-6">
                                <h2 className="text-xl font-semibold text-white mb-4">
                                    Admin Users
                                </h2>
                                <div className="space-y-4">
                                    {users.map((user) => (
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
                                                    <div>
                                                        <div className="flex items-center space-x-2">
                                                            <span className="text-white font-medium">
                                                                {user.username}
                                                            </span>
                                                            {user.is_admin && (
                                                                <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded border border-blue-500/30">
                                                                    Super Admin
                                                                </span>
                                                            )}
                                                            {user.role_name && (
                                                                <span className="px-2 py-1 bg-rose-500/20 text-rose-400 text-xs rounded border border-rose-500/30">
                                                                    {
                                                                        user.role_name
                                                                    }
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className="text-zinc-400 text-sm">
                                                            {user.id}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    {!user.is_admin && (
                                                        <>
                                                            <select
                                                                value={
                                                                    user.role_id ||
                                                                    ''
                                                                }
                                                                onChange={(
                                                                    e
                                                                ) => {
                                                                    const roleId =
                                                                        parseInt(
                                                                            e
                                                                                .target
                                                                                .value
                                                                        );
                                                                    if (
                                                                        roleId
                                                                    ) {
                                                                        handleAssignRole(
                                                                            user.id,
                                                                            roleId
                                                                        );
                                                                    } else {
                                                                        handleRemoveRole(
                                                                            user.id
                                                                        );
                                                                    }
                                                                }}
                                                                className="bg-zinc-700 border border-zinc-600 rounded px-3 py-1 text-white text-sm"
                                                            >
                                                                <option value="">
                                                                    No Role
                                                                </option>
                                                                {roles.map(
                                                                    (role) => (
                                                                        <option
                                                                            key={
                                                                                role.id
                                                                            }
                                                                            value={
                                                                                role.id
                                                                            }
                                                                        >
                                                                            {
                                                                                role.name
                                                                            }
                                                                        </option>
                                                                    )
                                                                )}
                                                            </select>
                                                        </>
                                                    )}
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
                                        onClick={() =>
                                            setShowCreateModal(false)
                                        }
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

                                    <div>
                                        <label className="block text-zinc-300 mb-2">
                                            Permissions
                                        </label>
                                        <div className="space-y-3">
                                            {AVAILABLE_PERMISSIONS.map(
                                                (permission) => (
                                                    <div
                                                        key={permission.key}
                                                        className="flex items-center justify-between p-3 bg-zinc-800 rounded border border-zinc-700"
                                                    >
                                                        <div>
                                                            <div className="text-white font-medium">
                                                                {
                                                                    permission.label
                                                                }
                                                            </div>
                                                            <div className="text-zinc-400 text-sm">
                                                                {
                                                                    permission.description
                                                                }
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() =>
                                                                setFormPermissions(
                                                                    (prev) => ({
                                                                        ...prev,
                                                                        [permission.key]:
                                                                            !prev[
                                                                                permission
                                                                                    .key
                                                                            ],
                                                                    })
                                                                )
                                                            }
                                                            className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                                                                formPermissions[
                                                                    permission
                                                                        .key
                                                                ]
                                                                    ? 'bg-rose-500 border-rose-500'
                                                                    : 'border-zinc-600 hover:border-zinc-500'
                                                            }`}
                                                        >
                                                            {formPermissions[
                                                                permission.key
                                                            ] && (
                                                                <Check className="w-4 h-4 text-white" />
                                                            )}
                                                        </button>
                                                    </div>
                                                )
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex space-x-3 pt-4">
                                        <Button
                                            onClick={handleCreateRole}
                                            disabled={submitting}
                                            variant="primary"
                                            className="flex-1"
                                        >
                                            {submitting
                                                ? 'Creating...'
                                                : 'Create Role'}
                                        </Button>
                                        <Button
                                            onClick={() =>
                                                setShowCreateModal(false)
                                            }
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

                                    <div>
                                        <label className="block text-zinc-300 mb-2">
                                            Permissions
                                        </label>
                                        <div className="space-y-3">
                                            {AVAILABLE_PERMISSIONS.map(
                                                (permission) => (
                                                    <div
                                                        key={permission.key}
                                                        className="flex items-center justify-between p-3 bg-zinc-800 rounded border border-zinc-700"
                                                    >
                                                        <div>
                                                            <div className="text-white font-medium">
                                                                {
                                                                    permission.label
                                                                }
                                                            </div>
                                                            <div className="text-zinc-400 text-sm">
                                                                {
                                                                    permission.description
                                                                }
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() =>
                                                                setFormPermissions(
                                                                    (prev) => ({
                                                                        ...prev,
                                                                        [permission.key]:
                                                                            !prev[
                                                                                permission
                                                                                    .key
                                                                            ],
                                                                    })
                                                                )
                                                            }
                                                            className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                                                                formPermissions[
                                                                    permission
                                                                        .key
                                                                ]
                                                                    ? 'bg-rose-500 border-rose-500'
                                                                    : 'border-zinc-600 hover:border-zinc-500'
                                                            }`}
                                                        >
                                                            {formPermissions[
                                                                permission.key
                                                            ] && (
                                                                <Check className="w-4 h-4 text-white" />
                                                            )}
                                                        </button>
                                                    </div>
                                                )
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex space-x-3 pt-4">
                                        <Button
                                            onClick={handleEditRole}
                                            disabled={submitting}
                                            variant="primary"
                                            className="flex-1"
                                        >
                                            {submitting
                                                ? 'Updating...'
                                                : 'Update Role'}
                                        </Button>
                                        <Button
                                            onClick={() =>
                                                setShowEditModal(false)
                                            }
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
