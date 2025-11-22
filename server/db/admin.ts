import { mainDb, flightsDb } from './connection.js';
import { cleanupOldStatistics } from './statistics.js';
import { getAllSessions } from './sessions.js';
import { sql } from 'kysely';
import { redisConnection } from './connection.js';
import { decrypt } from '../utils/encryption.js';
import { getAdminIds, isAdmin } from '../middleware/admin.js';
import { getActiveUsersForSession } from '../websockets/sessionUsersWebsocket.js';
import { getUserRoles } from './roles.js';

type RawUser = {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  last_login: Date | null;
  ip_address: string | null;
  is_vpn: boolean;
  total_sessions_created: number;
  total_minutes: number;
  created_at: Date | undefined;
  settings: string | null;
  roblox_username: string | null;
  role_id: number | null;
  role_name: string | null;
  role_permissions: unknown;
};

type ProcessedUser = RawUser & {
  is_admin: boolean;
  settings: unknown;
  roles: unknown[];
  current_sessions_count: number;
  cached?: boolean;
};

async function calculateDirectStatistics() {
  try {
    const usersResult = await mainDb
      .selectFrom('users')
      .select(({ fn }) => fn.countAll().as('count'))
      .executeTakeFirst();

    const sessionsResult = await mainDb
      .selectFrom('sessions')
      .select(({ fn }) => fn.countAll().as('count'))
      .executeTakeFirst();

    const sessions = await getAllSessions();
    let totalFlights = 0;

    for (const session of sessions) {
      try {
        const tableName = `flights_${session.session_id}`;
        const flightResult = await flightsDb
          .selectFrom(tableName)
          .select(({ fn }) => fn.countAll().as('count'))
          .executeTakeFirst();
        totalFlights += Number(flightResult?.count) || 0;
      } catch {
        console.warn(
          `Could not count flights for session ${session.session_id}`
        );
      }
    }

    return {
      total_logins: 0,
      total_sessions: Number(sessionsResult?.count) || 0,
      total_flights: totalFlights,
      total_users: Number(usersResult?.count) || 0,
    };
  } catch (error) {
    console.error('Error calculating direct statistics:', error);
    return {
      total_logins: 0,
      total_sessions: 0,
      total_flights: 0,
      total_users: 0,
    };
  }
}

async function backfillStatistics() {
  try {
    const directStats = await calculateDirectStatistics();

    const today = new Date();

    await mainDb
      .insertInto('daily_statistics')
      .values({
        id: sql`DEFAULT`,
        date: today,
        logins_count: 0,
        new_sessions_count: directStats.total_sessions,
        new_flights_count: directStats.total_flights,
        new_users_count: directStats.total_users,
      })
      .onConflict((oc) =>
        oc.column('date').doUpdateSet({
          new_sessions_count: directStats.total_sessions,
          new_flights_count: directStats.total_flights,
          new_users_count: directStats.total_users,
          updated_at: mainDb.fn('NOW'),
        })
      )
      .execute();
  } catch (error) {
    console.error('Error backfilling statistics:', error);
  }
}

export async function getDailyStatistics(days = 30) {
  const cacheKey = `admin:daily_stats:${days}`;

  try {
    const cached = await redisConnection.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (error) {
    if (error instanceof Error) {
      console.warn(
        `[Redis] Failed to read cache for daily stats (${days} days):`,
        error.message
      );
    }
  }

  try {
    await cleanupOldStatistics();

    const result = await mainDb
      .selectFrom('daily_statistics')
      .select([
        'date',
        mainDb.fn.coalesce('logins_count', sql`0`).as('logins_count'),
        mainDb.fn
          .coalesce('new_sessions_count', sql`0`)
          .as('new_sessions_count'),
        mainDb.fn.coalesce('new_flights_count', sql`0`).as('new_flights_count'),
        mainDb.fn.coalesce('new_users_count', sql`0`).as('new_users_count'),
      ])
      .where('date', '>=', new Date(Date.now() - days * 24 * 60 * 60 * 1000))
      .orderBy('date', 'asc')
      .execute();

    if (result.length === 0) {
      await backfillStatistics();
      return getDailyStatistics(days);
    }

    try {
      await redisConnection.set(cacheKey, JSON.stringify(result), 'EX', 300);
    } catch (error) {
      if (error instanceof Error) {
        console.warn(
          `[Redis] Failed to set cache for daily stats (${days} days):`,
          error.message
        );
      }
    }

    return result;
  } catch (error) {
    console.error('Error fetching daily statistics:', error);
    return [];
  }
}

export async function getTotalStatistics() {
  const cacheKey = 'admin:total_stats';

  try {
    const cached = await redisConnection.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (error) {
    if (error instanceof Error) {
      console.warn(
        '[Redis] Failed to read cache for total stats:',
        error.message
      );
    }
  }

  try {
    const directStats = await calculateDirectStatistics();

    const dailyStatsResult = await mainDb
      .selectFrom('daily_statistics')
      .select(({ fn }) => [
        fn.coalesce(fn.sum('logins_count'), sql`0`).as('total_logins'),
        fn.coalesce(fn.sum('new_sessions_count'), sql`0`).as('total_sessions'),
        fn.coalesce(fn.sum('new_flights_count'), sql`0`).as('total_flights'),
        fn.coalesce(fn.sum('new_users_count'), sql`0`).as('total_users'),
      ])
      .executeTakeFirst();

    const result = {
      total_logins: Number(dailyStatsResult?.total_logins) || 0,
      total_sessions: directStats.total_sessions,
      total_flights: directStats.total_flights,
      total_users: directStats.total_users,
    };

    try {
      await redisConnection.set(cacheKey, JSON.stringify(result), 'EX', 300);
    } catch (error) {
      if (error instanceof Error) {
        console.warn(
          '[Redis] Failed to set cache for total stats:',
          error.message
        );
      }
    }

    return result;
  } catch (error) {
    console.error('Error fetching total statistics:', error);
    return {
      total_logins: 0,
      total_sessions: 0,
      total_flights: 0,
      total_users: 0,
    };
  }
}

export async function getAllUsers(
  page = 1,
  limit = 50,
  search = '',
  filterAdmin = 'all'
) {
  try {
    const offset = (page - 1) * limit;
    const cacheKey = `allUsers:${page}:${limit}:${search}:${filterAdmin}`;

    const cached = await redisConnection.get(cacheKey);
    let filteredUsers: ProcessedUser[] = [];
    let totalUsers = 0;

    if (cached) {
      // Use cached data directly (already processed)
      const parsed = JSON.parse(cached);
      filteredUsers = parsed.users;
      totalUsers = parsed.total;
    } else {
      // Build query with Kysely
      let query = mainDb
        .selectFrom('users as u')
        .leftJoin('roles as r', 'u.role_id', 'r.id')
        .select([
          'u.id',
          'u.username',
          'u.discriminator',
          'u.avatar',
          'u.last_login',
          'u.ip_address',
          'u.is_vpn',
          'u.total_sessions_created',
          'u.total_minutes',
          'u.created_at',
          'u.settings',
          'u.roblox_username',
          'u.role_id',
          'r.name as role_name',
          'r.permissions as role_permissions',
        ])
        .orderBy('u.last_login', 'desc');

      if (search && search.trim()) {
        query = query.where((eb) =>
          eb.or([
            eb('u.username', 'ilike', `%${search.trim()}%`),
            eb('u.id', '=', search.trim()),
          ])
        );
      }

      if (filterAdmin === 'admin' || filterAdmin === 'non-admin') {
        const adminIds = getAdminIds();
        if (adminIds.length > 0) {
          if (filterAdmin === 'admin') {
            query = query.where('u.id', 'in', adminIds);
          } else {
            query = query.where('u.id', 'not in', adminIds);
          }
        } else {
          return {
            users: [],
            pagination: { page, limit, total: 0, pages: 0 },
          };
        }
      }

      const countQuery = query
        .clearSelect()
        .clearOrderBy()
        .select(({ fn }) => fn.countAll().as('count'));
      const countResult = await countQuery.executeTakeFirst();
      totalUsers = Number(countResult?.count) || 0;

      const rows = await query.limit(limit).offset(offset).execute();
      const rawUsers: RawUser[] = rows.map((r) => ({
        id: r.id,
        username: r.username,
        discriminator: r.discriminator,
        avatar: r.avatar ?? null,
        last_login: r.last_login ?? null,
        ip_address: r.ip_address ?? null,
        is_vpn: Boolean(r.is_vpn),
        total_sessions_created: Number(r.total_sessions_created ?? 0),
        total_minutes: Number(r.total_minutes ?? 0),
        created_at: r.created_at,
        settings: r.settings ?? null,
        roblox_username: r.roblox_username ?? null,
        role_id: r.role_id ?? null,
        role_name: r.role_name ?? null,
        role_permissions: r.role_permissions ?? null,
      }));

      // Fetch roles for multi-role support
      const userIds = rawUsers.map((u) => u.id);
      const allUserRoles = await Promise.all(
        userIds.map((userId) => getUserRoles(userId))
      );

      // Process users with admin status, settings decryption, etc.
      const usersWithAdminStatus = rawUsers.map((user, index) => {
        let decryptedSettings = null;
        try {
          if (user.settings) {
            decryptedSettings = decrypt(JSON.parse(user.settings));
          }
        } catch {
          console.warn(`Failed to decrypt settings for user ${user.id}`);
        }

        let rolePermissions = null;
        try {
          if (user.role_permissions) {
            rolePermissions =
              typeof user.role_permissions === 'string'
                ? JSON.parse(user.role_permissions)
                : user.role_permissions;
          }
        } catch (error) {
          console.warn(
            `Failed to parse role permissions for user ${user.id}:`,
            error
          );
        }
        user.role_permissions = rolePermissions;

        let decryptedIP = user.ip_address;
        if (user.ip_address) {
          try {
            if (
              typeof user.ip_address === 'string' &&
              user.ip_address.trim().startsWith('{')
            ) {
              decryptedIP = decrypt(JSON.parse(user.ip_address));
            } else {
              const isEncryptedObject = (
                val: unknown
              ): val is { iv: string; data: string; authTag: string } => {
                if (typeof val !== 'object' || val === null) return false;
                const obj = val as Record<string, unknown>;
                return (
                  typeof obj.iv === 'string' &&
                  typeof obj.data === 'string' &&
                  typeof obj.authTag === 'string'
                );
              };

              if (isEncryptedObject(user.ip_address)) {
                decryptedIP = decrypt(user.ip_address);
              }
            }
          } catch {
            console.warn(`Failed to decrypt IP for user ${user.id}`);
          }
        }

        return {
          ...user,
          ip_address: decryptedIP,
          is_admin: isAdmin(user.id),
          settings: decryptedSettings,
          roles: allUserRoles[index],
          current_sessions_count: 0,
        };
      });

      const usersWithCacheStatus = await Promise.all(
        usersWithAdminStatus.map(async (user) => {
          const isCached = await redisConnection.exists(`user:${user.id}`);
          return { ...user, cached: isCached === 1 };
        })
      );

      filteredUsers = usersWithCacheStatus;
      if (filterAdmin === 'cached') {
        filteredUsers = usersWithCacheStatus.filter((user) => user.cached);
        totalUsers = filteredUsers.length;
        filteredUsers = filteredUsers.slice(0, limit);
      }

      await redisConnection.set(
        cacheKey,
        JSON.stringify({ users: filteredUsers, total: totalUsers }),
        'EX',
        300
      );
    }

    return {
      users: filteredUsers,
      pagination: {
        page,
        limit,
        total: totalUsers,
        pages: Math.ceil(totalUsers / limit),
      },
    };
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
}

export async function getAdminSessions(page = 1, limit = 100, search = '') {
  try {
    const offset = (page - 1) * limit;

    let query = mainDb
      .selectFrom('sessions as s')
      .leftJoin('users as u', 's.created_by', 'u.id')
      .select([
        's.session_id',
        's.access_id',
        's.airport_icao',
        's.active_runway',
        sql`(s.created_at AT TIME ZONE 'UTC')`.as('created_at'),
        's.created_by',
        's.is_pfatc',
        'u.username',
        'u.discriminator',
        'u.avatar',
      ])
      .orderBy('s.created_at', 'desc');

    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      query = query.where((eb) =>
        eb.or([
          eb('s.session_id', 'ilike', searchTerm),
          eb('s.airport_icao', 'ilike', searchTerm),
          eb('u.username', 'ilike', searchTerm),
          eb('s.created_by', 'ilike', searchTerm),
        ])
      );
    }

    const countQuery = query
      .clearSelect()
      .clearOrderBy()
      .select(({ fn }) => fn.countAll().as('count'));
    const countResult = await countQuery.executeTakeFirst();
    const total = Number(countResult?.count) || 0;
    const pages = Math.ceil(total / limit);

    const sessions = await query.limit(limit).offset(offset).execute();

    const sessionsWithDetails = await Promise.all(
      sessions.map(async (session) => {
        let flight_count = 0;
        try {
          const tableName = `flights_${session.session_id}`;
          const flightResult = await flightsDb
            .selectFrom(tableName)
            .select(({ fn }) => fn.countAll().as('count'))
            .executeTakeFirst();
          flight_count = Number(flightResult?.count) || 0;
        } catch {
          // Table may not exist, keep flight_count as 0
        }
        const activeSessionUsers = await getActiveUsersForSession(
          session.session_id
        );
        return {
          ...session,
          flight_count,
          active_users: activeSessionUsers,
          active_user_count: activeSessionUsers.length,
        };
      })
    );

    return {
      sessions: sessionsWithDetails,
      pagination: {
        page,
        limit,
        total,
        pages,
      },
    };
  } catch (error) {
    console.error('Error fetching admin sessions:', error);
    throw error;
  }
}

export async function syncUserSessionCounts() {
  try {
    const sessionCounts = await mainDb
      .selectFrom('sessions')
      .select(['created_by', mainDb.fn.countAll().as('session_count')])
      .groupBy('created_by')
      .execute();

    for (const row of sessionCounts) {
      await mainDb
        .updateTable('users')
        .set({ total_sessions_created: Number(row.session_count) })
        .where('id', '=', row.created_by)
        .execute();
    }

    await mainDb
      .updateTable('users')
      .set({ total_sessions_created: 0 })
      .where(
        'id',
        'not in',
        sessionCounts.map((r) => r.created_by)
      )
      .execute();

    return {
      message: 'Session counts synced successfully',
      updatedUsers: sessionCounts.length,
    };
  } catch (error) {
    console.error('Error syncing user session counts:', error);
    throw error;
  }
}

export async function invalidateAllUsersCache() {
  try {
    let cursor = '0';
    const keysToDelete: string[] = [];
    do {
      const [newCursor, keys] = await redisConnection.scan(
        cursor,
        'MATCH',
        'allUsers:*',
        'COUNT',
        100
      );
      cursor = newCursor;
      keysToDelete.push(...keys);
    } while (cursor !== '0');

    if (keysToDelete.length > 0) {
      await redisConnection.del(...keysToDelete);
    }
  } catch (error) {
    console.warn('[Redis] Failed to invalidate allUsers cache:', error);
  }
}
