import type { Settings } from "../../types/settings";

const API_BASE_URL = import.meta.env.VITE_SERVER_URL || '';

export interface DailyStats {
    date: string;
    logins_count: number;
    new_sessions_count: number;
    new_flights_count: number;
    new_users_count: number;
}

export interface TotalStats {
    total_logins: number;
    total_sessions: number;
    total_flights: number;
    total_users: number;
}

export type AdminStats = {
    totals: {
        total_users: number;
        total_sessions: number;
        total_flights: number;
        total_logins: number;
    };
    daily: DailyStats[];
    periodTotals?: {
        total_logins: number;
        total_sessions: number;
        total_flights: number;
        total_users: number;
    };
};

export interface AdminUser {
    id: string;
    username: string;
    discriminator: string;
    avatar: string;
    last_login: string;
    ip_address: string;
    is_vpn: boolean;
    total_sessions_created: number;
    current_sessions_count: number;
    total_minutes: number;
    created_at: string;
    is_admin: boolean;
    settings?: Settings;
    roblox_username?: string;
    roles?: Role[];
    cached?: boolean;
}

export interface AdminUsersResponse {
    users: AdminUser[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}

export interface SessionUser {
    id: string;
    username: string;
    avatar: string | null;
    joinedAt: number;
    position: string;
    roles?: Array<{
        id: number;
        name: string;
        color: string;
        icon: string;
        priority: number;
    }>;
}

export interface AdminSession {
    session_id: string;
    access_id: string;
    airport_icao: string;
    active_runway: string;
    created_at: string;
    created_by: string;
    is_pfatc: boolean;
    flight_count: number;
    username: string;
    discriminator: string;
    avatar: string | null;
    active_users?: SessionUser[];
    active_user_count?: number;
}

export interface SystemInfo {
    database: Array<{
        schemaname: string;
        tablename: string;
        inserts: number;
        updates: number;
        deletes: number;
    }>;
    server: {
        nodeVersion: string;
        uptime: number;
        memoryUsage: {
            rss: number;
            heapTotal: number;
            heapUsed: number;
            external: number;
            arrayBuffers: number;
        };
        platform: string;
    };
}

export interface AuditLog {
    id: number;
    admin_id: string;
    admin_username: string;
    action_type: string;
    target_user_id?: string;
    target_username?: string;
    details: Record<string, unknown>;
    ip_address?: string;
    user_agent?: string;
    timestamp: string;
}

export interface AuditLogsResponse {
    logs: AuditLog[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}

export interface RevealIPResponse {
    userId: string;
    username: string;
    ip_address: string;
}

export interface Ban {
    id: string;
    userId?: string;
    ip?: string;
    username: string;
    reason: string;
    expiresAt?: string;
    createdAt: string;
    createdBy: string;
}

export interface Pagination {
    page: number;
    limit: number;
    total: number;
    pages: number;
}

export interface Notification {
    id: number;
    type: 'info' | 'warning' | 'success' | 'error';
    text: string;
    show: boolean;
    custom_color?: string;
    created_at: string;
    updated_at: string;
}

export interface Role {
    id: number;
    name: string;
    description: string;
    permissions: Record<string, boolean>;
    color: string;
    icon: string;
    priority: number;
    user_count?: number;
    created_at: string;
    updated_at: string;
}

export interface UserWithRole extends AdminUser {
    role_id?: number;
    role_name?: string;
    role_permissions?: Record<string, boolean>;
    roles?: Role[];
}

export interface AppVersion {
    version: string;
    updated_at: string;
    updated_by: string;
}

async function makeAdminRequest(endpoint: string, options?: RequestInit) {
    const response = await fetch(`${API_BASE_URL}/api/admin${endpoint}`, {
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
        },
        ...options,
    });

    if (!response.ok) {
        if (response.status === 403) {
            throw new Error('Admin access required');
        }
        if (response.status === 401) {
            throw new Error('Authentication required');
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
}

export async function fetchAdminStatistics(days: number = 30): Promise<AdminStats> {
    return makeAdminRequest(`/statistics?days=${days}`);
}

export async function fetchAdminUsers(
    page: number = 1,
    limit: number = 50,
    search: string = '',
    filterAdmin: string = 'all'
): Promise<AdminUsersResponse> {
    const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(search && { search }),
        filterAdmin
    });
    return makeAdminRequest(`/users?${params.toString()}`);
}

export async function fetchAdminSessions(): Promise<AdminSession[]> {
    return makeAdminRequest('/sessions');
}

export async function revealUserIP(userId: string): Promise<RevealIPResponse> {
    return makeAdminRequest(`/users/${userId}/reveal-ip`, {
        method: 'POST'
    });
}

export async function revealAuditLogIP(logId: number): Promise<{ logId: number; ip_address: string }> {
    return makeAdminRequest(`/audit-logs/${logId}/reveal-ip`, {
        method: 'POST'
    });
}

export async function banUser({ userId, ip, username, reason, expiresAt }: { userId?: string, ip?: string, username: string, reason: string, expiresAt?: string }) {
    return makeAdminRequest('/bans/ban', {
        method: 'POST',
        body: JSON.stringify({ userId, ip, username, reason, expiresAt })
    });
}

export async function unbanUser(userIdOrIp: string) {
    return makeAdminRequest('/bans/unban', {
        method: 'POST',
        body: JSON.stringify({ userIdOrIp })
    });
}

export async function fetchAllBans(page: number = 1, limit: number = 50): Promise<{ bans: Ban[], pagination: Pagination }> {
    return makeAdminRequest(`/bans?page=${page}&limit=${limit}`);
}

export async function fetchAuditLogs(
    page: number = 1,
    limit: number = 50,
    filters: {
        adminId?: string;
        actionType?: string;
        targetUserId?: string;
        dateFrom?: string;
        dateTo?: string;
    } = {}
): Promise<AuditLogsResponse> {
    const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...Object.fromEntries(
            Object.entries(filters).filter(([, value]) => value != null && value !== '')
        )
    });

    const response = await fetch(`${API_BASE_URL}/api/admin/audit-logs?${params}`, {
        credentials: 'include'
    });

    if (!response.ok) {
        throw new Error('Failed to fetch audit logs');
    }

    return response.json();
}

export async function deleteAdminSession(sessionId: string): Promise<{ message: string; sessionId: string }> {
    return makeAdminRequest(`/sessions/${sessionId}`, {
        method: 'DELETE'
    });
}

export async function logSessionJoin(sessionId: string): Promise<{ message: string; sessionId: string }> {
    return makeAdminRequest(`/sessions/${sessionId}/join`, {
        method: 'POST'
    });
}

export async function fetchNotifications(): Promise<Notification[]> {
    const response = await makeAdminRequest('/notifications');
    return response;
}

export async function addNotification(notification: Omit<Notification, 'id' | 'created_at' | 'updated_at'>): Promise<Notification> {
    const response = await makeAdminRequest('/notifications', {
        method: 'POST',
        body: JSON.stringify(notification),
    });
    return response;
}

export async function updateNotification(id: number, notification: Partial<Omit<Notification, 'id' | 'created_at' | 'updated_at'>>): Promise<Notification> {
    const response = await makeAdminRequest(`/notifications/${id}`, {
        method: 'PUT',
        body: JSON.stringify(notification),
    });
    return response;
}

export async function deleteNotification(id: number): Promise<void> {
    await makeAdminRequest(`/notifications/${id}`, {
        method: 'DELETE',
    });
}

export async function fetchRoles(): Promise<Role[]> {
    return makeAdminRequest('/roles');
}

export async function createRole(roleData: {
    name: string;
    description: string;
    permissions: Record<string, boolean>;
    color?: string;
    icon?: string;
    priority?: number;
}): Promise<Role> {
    return makeAdminRequest('/roles', {
        method: 'POST',
        body: JSON.stringify(roleData)
    });
}

export async function updateRole(id: number, roleData: {
    name?: string;
    description?: string;
    permissions?: Record<string, boolean>;
    color?: string;
    icon?: string;
    priority?: number;
}): Promise<Role> {
    return makeAdminRequest(`/roles/${id}`, {
        method: 'PUT',
        body: JSON.stringify(roleData)
    });
}

export async function updateRolePriorities(rolePriorities: Array<{ id: number; priority: number }>): Promise<boolean> {
    return makeAdminRequest('/roles/priorities', {
        method: 'PUT',
        body: JSON.stringify({ rolePriorities })
    });
}

export async function deleteRole(id: number): Promise<void> {
    return makeAdminRequest(`/roles/${id}`, {
        method: 'DELETE'
    });
}

export async function assignRoleToUser(userId: string, roleId: number): Promise<void> {
    return makeAdminRequest(`/roles/assign`, {
        method: 'POST',
        body: JSON.stringify({ userId, roleId })
    });
}

export async function removeRoleFromUser(userId: string, roleId: number): Promise<void> {
    return makeAdminRequest(`/roles/remove`, {
        method: 'POST',
        body: JSON.stringify({ userId, roleId })
    });
}

export async function fetchUsersWithRoles(): Promise<UserWithRole[]> {
    return makeAdminRequest('/roles/users');
}

export async function fetchAppVersion(): Promise<AppVersion> {
    return makeAdminRequest('/version');
}

export async function updateAppVersion(version: string): Promise<AppVersion> {
    return makeAdminRequest('/version', {
        method: 'PUT',
        body: JSON.stringify({ version }),
    });
}
