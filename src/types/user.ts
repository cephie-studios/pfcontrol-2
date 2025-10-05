import type { Settings } from './settings';

export interface User {
    userId: string;
    username: string;
    discriminator: string;
    avatar: string | null;
    settings: Settings;
    lastLogin: string;
    totalSessionsCreated: number;
    isAdmin: boolean;
    isBanned: boolean;
    isTester: boolean;
    roleId?: number;
    roleName?: string;
    rolePermissions?: Record<string, boolean>;
}