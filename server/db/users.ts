import { encrypt, decrypt } from "../utils/encryption.js";
import type { Settings } from "./types/Settings.js";
import { mainDb } from "./connection.js";
import { sql } from "kysely";
import { redisConnection } from "./connection.js";
import { incrementStat } from '../utils/statisticsCache.js';

async function invalidateUserCache(userId: string) {
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

export async function getUserById(userId: string) {
  const cacheKey = `user:${userId}`;
  
  let cached = null;
  try {
    cached = await redisConnection.get(cacheKey);
  } catch (error) {
    if (error instanceof Error) {
      console.warn(`[Redis] Failed to read cache for user ${userId}:`, error.message);
    } else {
      console.warn(`[Redis] Failed to read cache for user ${userId}:`, error);
    }
  }
  
  if (cached) {
    return JSON.parse(cached);
  }

  const user = await mainDb
    .selectFrom("users")
    .leftJoin("roles", "users.role_id", "roles.id")
    .selectAll("users")
    .select("roles.permissions as role_permissions")
    .where("users.id", "=", userId)
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
    await redisConnection.set(cacheKey, JSON.stringify(result), "EX", 60 * 30); // cache for 30 minutes
  } catch (error) {
    if (error instanceof Error) {
      console.warn(`[Redis] Failed to set cache for user ${userId}:`, error.message);
    } else {
      console.warn(`[Redis] Failed to set cache for user ${userId}:`, error);
    }
  }
  
  return result;
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
      flightRowOpacity: 100
    },
    departureTableColumns: {
      time: true,
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
      pdc: true,
      hide: true,
      delete: true
    },
    arrivalsTableColumns: {
      time: true,
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
      hide: true
    },
    acars: {
      notesEnabled: true,
      chartsEnabled: true,
      terminalWidth: 50,
      notesWidth: 20
    },
    tutorialCompleted: false,
    displayControllerStatsOnProfile: true,
    displayPilotStatsOnProfile: true,
    displayLinkedAccountsOnProfile: true,
    hideFromLeaderboard: false,
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
  return await getUserById(userId);
}

export async function unlinkRobloxAccount(userId: string) {
  await mainDb
    .updateTable('users')
    .set({
      roblox_user_id: undefined,
      roblox_username: undefined,
      roblox_access_token: undefined,
      roblox_refresh_token: undefined,
      updated_at: sql`NOW()`
    })
    .where('id', '=', userId)
    .execute();

  await invalidateUserCache(userId);
  return await getUserById(userId);
}

export async function updateVatsimAccount(userId: string, { vatsimCid, ratingId, ratingShort, ratingLong }: { vatsimCid: string; ratingId: number; ratingShort: string; ratingLong: string }) {
  await mainDb
    .updateTable('users')
    .set({
      vatsim_cid: vatsimCid,
      vatsim_rating_id: ratingId,
      vatsim_rating_short: ratingShort,
      vatsim_rating_long: ratingLong,
      updated_at: sql`NOW()`
    })
    .where('id', '=', userId)
    .execute();

  await invalidateUserCache(userId);
  return await getUserById(userId);
}

export async function unlinkVatsimAccount(userId: string) {
  await mainDb
    .updateTable('users')
    .set({
      vatsim_cid: undefined,
      vatsim_rating_id: undefined,
      vatsim_rating_short: undefined,
      vatsim_rating_long: undefined,
      updated_at: sql`NOW()`
    })
    .where('id', '=', userId)
    .execute();

  await invalidateUserCache(userId);
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