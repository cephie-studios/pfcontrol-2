import { encrypt, decrypt } from "../utils/encryption.js";
import type { Settings } from "./types/Settings.js";
import { mainDb } from "./connection.js";
import { sql } from "kysely";
import { redisConnection } from "./connection.js";
import { incrementStat } from '../utils/statisticsCache.js';
import { getUserRoles } from './roles.js';

export async function invalidateUserCache(userId: string) {
  try {
    await redisConnection.del(`user:${userId}`);
  } catch (error) {
    if (error instanceof Error) {
      console.warn(`[Redis] Failed to invalidate cache for user ${userId}:`, error.message);
    } else {
      console.warn(`[Redis] Failed to invalidate cache for user ${userId}:`, error);
    }
  }
}

async function invalidateUsernameCache(username: string) {
  try {
    await redisConnection.del(`user:username:${username}`);
  } catch (error) {
    if (error instanceof Error) {
      console.warn(`[Redis] Failed to invalidate username cache for ${username}:`, error.message);
    } else {
      console.warn(`[Redis] Failed to invalidate username cache for ${username}:`, error);
    }
  }
}

export async function getUserById(userId: string) {
  const cacheKey = `user:${userId}`;
  
  let cached = null;
  try {
    cached = await redisConnection.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (error) {
    if (error instanceof Error) {
      console.warn('[Redis] Failed to read cache for user:', error.message);
    }
  }
  
  if (cached) {
    const user = JSON.parse(cached);
    return await applyGlobalHolidayOverride(user);
  }

  const user = await mainDb
    .selectFrom("users")
    .leftJoin("roles", "users.role_id", "roles.id")
    .selectAll("users")
    .select("roles.permissions as role_permissions")
    .select("roles.name as role_name")
    .where("users.id", "=", userId)
    .executeTakeFirst();

  if (!user) return null;

  const userRoles = await getUserRoles(userId);
  const mergedPermissions: Record<string, boolean> = {};
  for (const role of userRoles) {
    if (role.permissions) {
      Object.assign(mergedPermissions, role.permissions);
    }
  }

  if (Object.keys(mergedPermissions).length === 0 && user.role_permissions) {
    Object.assign(mergedPermissions, user.role_permissions);
  }

  const safeDecrypt = (encryptedData: string | null | undefined, fieldName: string) => {
    if (!encryptedData) return null;
    try {
      return decrypt(JSON.parse(encryptedData));
    } catch (error) {
      console.error(`Failed to decrypt ${fieldName} for user ${userId}:`, error);
      return null;
    }
  };

  const result = {
    ...user,
    access_token: safeDecrypt(user.access_token, 'access_token'),
    refresh_token: safeDecrypt(user.refresh_token, 'refresh_token'),
    sessions: safeDecrypt(user.sessions, 'sessions') || [],
    settings: safeDecrypt(user.settings, 'settings'),
    ip_address: safeDecrypt(user.ip_address, 'ip_address'),
    role_permissions: mergedPermissions,
    statistics: user.statistics || {},
  };

  try {
    await redisConnection.set(cacheKey, JSON.stringify(result), 'EX', 86400);
  } catch (error) {
    if (error instanceof Error) {
      console.warn('[Redis] Failed to set cache for user:', error.message);
    }
  }
  
  return await applyGlobalHolidayOverride(result);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function applyGlobalHolidayOverride(user: any) {
  try {
    const { getGlobalHolidaySettings } = await import('./globalHolidaySettings.js');
    const globalSettings = await getGlobalHolidaySettings();
    
    if (!globalSettings.enabled && user.settings?.holidayTheme) {
      return {
        ...user,
        settings: {
          ...user.settings,
          holidayTheme: {
            ...user.settings.holidayTheme,
            enabled: false
          }
        }
      };
    }
    
    return user;
  } catch (error) {
    console.warn('Failed to check global holiday settings, returning user as-is:', error);
    return user;
  }
}

export async function getUserByUsername(username: string) {
  const cacheKey = `user:username:${username}`;
  
  let cached = null;
  try {
    cached = await redisConnection.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (error) {
    if (error instanceof Error) {
      console.warn(`[Redis] Failed to read cache for username ${username}:`, error.message);
    } else {
      console.warn(`[Redis] Failed to read cache for username ${username}:`, error);
    }
  }
  
  if (cached) {
    const user = JSON.parse(cached);
    return await applyGlobalHolidayOverride(user);
  }

  const user = await mainDb
    .selectFrom("users")
    .leftJoin("roles", "users.role_id", "roles.id")
    .selectAll("users")
    .select("roles.permissions as role_permissions")
    .where("users.username", "=", username)
    .executeTakeFirst();

  if (!user) return null;

  const result = {
    ...user,
    access_token: user.access_token ? decrypt(JSON.parse(user.access_token)) : null,
    refresh_token: user.refresh_token ? decrypt(JSON.parse(user.refresh_token)) : null,
    sessions: user.sessions ? decrypt(JSON.parse(user.sessions)) : null,
    settings: user.settings ? decrypt(JSON.parse(user.settings)) : null,
    ip_address: user.ip_address ? decrypt(JSON.parse(user.ip_address)) : null,
    role_permissions: user.role_permissions || null,
    statistics: user.statistics || {},
  };

  try {
    await redisConnection.set(cacheKey, JSON.stringify(result), "EX", 60 * 30);
  } catch (error) {
    if (error instanceof Error) {
      console.warn(`[Redis] Failed to set cache for username ${username}:`, error.message);
    } else {
      console.warn(`[Redis] Failed to set cache for username ${username}:`, error);
    }
  }
  
  return await applyGlobalHolidayOverride(result);
}

export async function createOrUpdateUser(userData: {
  id: string;
  username: string;
  discriminator?: string;
  avatar?: string;
  accessToken: string;
  refreshToken: string;
  ipAddress: string;
  isVpn?: boolean;
}) {
  const {
    id,
    username,
    discriminator = '0',
    avatar,
    accessToken,
    refreshToken,
    ipAddress,
    isVpn = false
  } = userData;

  const defaultSettings = {
    sounds: {
      startupSound: { enabled: true, volume: 100 },
      chatNotificationSound: { enabled: true, volume: 100 },
      newStripSound: { enabled: true, volume: 100 },
      acarsBeep: { enabled: true, volume: 100 },
      acarsChatPop: { enabled: true, volume: 100 }
    },
    backgroundImage: {
      selectedImage: null,
      useCustomBackground: false,
      favorites: []
    },
    layout: {
      showCombinedView: false,
      flightRowOpacity: 100,
      chartDrawerViewMode: 'legacy' as const
    },
    departureTableColumns: {
      time: true as const,
      callsign: true,
      stand: true,
      aircraft: true,
      wakeTurbulence: true,
      flightType: true,
      arrival: true,
      runway: true,
      sid: true,
      rfl: true,
      cfl: true,
      squawk: true,
      clearance: true,
      status: true,
      remark: true,
      route: true,
      pdc: true,
      hide: true,
      delete: true
    },
    arrivalsTableColumns: {
      time: true as const,
      callsign: true,
      gate: true,
      aircraft: true,
      wakeTurbulence: true,
      flightType: true,
      departure: true,
      runway: true,
      star: true,
      rfl: true,
      cfl: true,
      squawk: true,
      status: true,
      remark: true,
      route: true,
      hide: true
    },
    acars: {
      notesEnabled: true,
      chartsEnabled: true,
      autoRedirectToAcars: true,
      terminalWidth: 50,
      notesWidth: 20
    },
    notificationViewMode: 'list' as const,
    tutorialCompleted: false,
    displayStatsOnProfile: true,
    displayLinkedAccountsOnProfile: true,
    hideFromLeaderboard: false,
    displayBackgroundOnProfile: true,
    bio: '',
    holidayTheme: {
      enabled: true,
      snowEffect: true,
      music: true,
      musicVolume: 50,
      animations: true,
      santa: true,
    },
  };

  const encryptedAccessToken = encrypt(accessToken);
  const encryptedRefreshToken = encrypt(refreshToken);
  const encryptedIP = encrypt(ipAddress);
  const encryptedSettings = encrypt(defaultSettings);
  const encryptedSessions = encrypt([]);

  await mainDb
    .insertInto('users')
    .values({
      id,
      username,
      discriminator,
      avatar,
      access_token: JSON.stringify(encryptedAccessToken),
      refresh_token: JSON.stringify(encryptedRefreshToken),
      ip_address: JSON.stringify(encryptedIP),
      is_vpn: isVpn,
      sessions: JSON.stringify(encryptedSessions),
      settings: JSON.stringify(encryptedSettings),
      last_login: sql`NOW()`,
      updated_at: sql`NOW()`,
      created_at: sql`NOW()`
    })
    .onConflict((oc) =>
      oc.column('id').doUpdateSet({
        username,
        discriminator,
        avatar,
        access_token: JSON.stringify(encryptedAccessToken),
        refresh_token: JSON.stringify(encryptedRefreshToken),
        last_login: sql`NOW()`,
        ip_address: JSON.stringify(encryptedIP),
        is_vpn: isVpn,
        updated_at: sql`NOW()`
      })
    )
    .execute();

    await invalidateUserCache(id);
  return await getUserById(id);
}

export async function updateUserSettings(id: string, settings: Settings) {
  const existingUser = await getUserById(id);
  if (!existingUser) {
    throw new Error('User not found');
  }

  const mergedSettings = { ...existingUser.settings, ...settings };
  const encryptedSettings = encrypt(mergedSettings);

  await mainDb
    .updateTable('users')
    .set({
      settings: JSON.stringify(encryptedSettings),
      settings_updated_at: sql`NOW()`,
      updated_at: sql`NOW()`
    })
    .where('id', '=', id)
    .execute();

  await invalidateUserCache(id);
  await invalidateUsernameCache(existingUser.username);
  return await getUserById(id);
}

export async function addSessionToUser(userId: string, sessionId: string) {
  const user = await getUserById(userId);
  if (!user) throw new Error('User not found');

  const sessions = [...user.sessions, sessionId];
  const encryptedSessions = encrypt(sessions);

  await mainDb
    .updateTable('users')
    .set({
      sessions: JSON.stringify(encryptedSessions),
      last_session_created: sql`NOW()`,
      total_sessions_created: sql`total_sessions_created + 1`,
      updated_at: sql`NOW()`
    })
    .where('id', '=', userId)
    .execute();

  incrementStat(userId, 'total_sessions_created');
  await invalidateUserCache(userId);
  return await getUserById(userId);
}

export async function removeSessionFromUser(userId: string, sessionId: string) {
  const user = await getUserById(userId);
  if (!user) throw new Error('User not found');

  const sessions = (user.sessions || []).filter((s: string) => s !== sessionId);
  const encryptedSessions = encrypt(sessions);

  await mainDb
    .updateTable('users')
    .set({
      sessions: JSON.stringify(encryptedSessions),
      updated_at: sql`NOW()`
    })
    .where('id', '=', userId)
    .execute();

  await invalidateUserCache(userId);
  return await getUserById(userId);
}

export async function updateRobloxAccount(userId: string, { robloxUserId, robloxUsername, accessToken, refreshToken }: { robloxUserId: string; robloxUsername: string; accessToken: string; refreshToken: string }) {
  const user = await getUserById(userId);
  if (!user) throw new Error('User not found');

  await mainDb
    .updateTable('users')
    .set({
      roblox_user_id: robloxUserId,
      roblox_username: robloxUsername,
      roblox_access_token: accessToken,
      roblox_refresh_token: refreshToken,
      updated_at: sql`NOW()`
    })
    .where('id', '=', userId)
    .execute();

  await invalidateUserCache(userId);
  await invalidateUsernameCache(user.username);
  return await getUserById(userId);
}

export async function unlinkRobloxAccount(userId: string) {
  const user = await getUserById(userId);
  if (!user) throw new Error('User not found');

  await mainDb
    .updateTable('users')
    .set({
      roblox_user_id: null,
      roblox_username: null,
      roblox_access_token: null,
      roblox_refresh_token: null,
      updated_at: sql`NOW()`
    })
    .where('id', '=', userId)
    .execute();

  await invalidateUserCache(userId);
  await invalidateUsernameCache(user.username);
  return await getUserById(userId);
}

export async function updateVatsimAccount(userId: string, { vatsimCid, ratingId, ratingShort, ratingLong }: { vatsimCid: string; ratingId: number; ratingShort?: string; ratingLong?: string }) {
  const user = await getUserById(userId);
  if (!user) throw new Error('User not found');

  await mainDb
    .updateTable('users')
    .set({
      vatsim_cid: vatsimCid,
      vatsim_rating_id: ratingId,
      vatsim_rating_short: ratingShort ?? undefined,
      vatsim_rating_long: ratingLong ?? undefined,
      updated_at: sql`NOW()`
    })
    .where('id', '=', userId)
    .execute();

  await invalidateUserCache(userId);
  await invalidateUsernameCache(user.username);
  return await getUserById(userId);
}

export async function unlinkVatsimAccount(userId: string) {
  const user = await getUserById(userId);
  if (!user) throw new Error('User not found');

  await mainDb
    .updateTable('users')
    .set({
      vatsim_cid: null,
      vatsim_rating_id: null,
      vatsim_rating_short: null,
      vatsim_rating_long: null,
      updated_at: sql`NOW()`
    })
    .where('id', '=', userId)
    .execute();

  await invalidateUserCache(userId);
  await invalidateUsernameCache(user.username);
  return await getUserById(userId);
}

export async function updateTutorialStatus(id: string, completed: boolean) {
  const existingUser = await getUserById(id);
  if (!existingUser) throw new Error('User not found');

  const mergedSettings = { ...existingUser.settings, tutorialCompleted: completed };
  const encryptedSettings = encrypt(mergedSettings);

  await mainDb
    .updateTable('users')
    .set({
      settings: JSON.stringify(encryptedSettings),
      settings_updated_at: sql`NOW()`,
      updated_at: sql`NOW()`
    })
    .where('id', '=', id)
    .execute();

  await invalidateUserCache(id);
  await invalidateUsernameCache(existingUser.username);
  return await getUserById(id);
}

export async function updateUserStatistics(userId: string, stats: Record<string, unknown>) {
  const existingUser = await getUserById(userId);
  if (!existingUser) throw new Error('User not found');

  const existingStats = (existingUser.statistics ?? {}) as Record<string, unknown>;
  const mergedStats: Record<string, unknown> = {
    ...existingStats,
    ...stats,
    last_updated: new Date().toISOString()
  };

  await mainDb
    .updateTable('users')
    .set({
      statistics: JSON.stringify(mergedStats),
      updated_at: sql`NOW()`
    })
    .where('id', '=', userId)
    .execute();

  await invalidateUserCache(userId);
}

