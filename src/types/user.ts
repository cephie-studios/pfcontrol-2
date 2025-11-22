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
  rolePermissions: Record<string, boolean>;
  robloxUserId?: string | null;
  robloxUsername?: string | null;
  vatsimCid?: string | null;
  vatsimRatingId?: number | null;
  vatsimRatingShort?: string | null;
  vatsimRatingLong?: string | null;
  tutorialCompleted: boolean;
  statistics: Record<string, number | Record<string, number>>;
  ranks: Record<string, number | null>;
}
