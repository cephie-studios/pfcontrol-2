import { mainDb, flightsDb } from "./connection";
import { cleanupOldStatistics } from './statistics';
import { getAllSessions } from './sessions';
import { sql } from 'kysely';
import { redisConnection } from './connection';
import { decrypt } from '../utils/encryption';
import { getAdminIds, isAdmin } from '../middleware/admin';
import { getActiveUsers } from "../websockets/sessionUsersWebsocket";

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
        console.warn(`Could not count flights for session ${session.session_id}`);
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

    console.log('Statistics backfilled successfully');
  } catch (error) {
    console.error('Error backfilling statistics:', error);
  }
}

export async function getDailyStatistics(days = 30) {
  try {
    await cleanupOldStatistics();

    const result = await mainDb
      .selectFrom('daily_statistics')
      .select([
        'date',
        mainDb.fn.coalesce('logins_count', sql`0`).as('logins_count'),
        mainDb.fn.coalesce('new_sessions_count', sql`0`).as('new_sessions_count'),
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

    return result;
  } catch (error) {
    console.error('Error fetching daily statistics:', error);
    return [];
  }
}

export async function getTotalStatistics() {
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

    return {
      total_logins: Number(dailyStatsResult?.total_logins) || 0,
      total_sessions: directStats.total_sessions,
      total_flights: directStats.total_flights,
      total_users: directStats.total_users,
    };
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

export async function getAllUsers(page = 1, limit = 50, search = '', filterAdmin = 'all') {
  try {
    const offset = (page - 1) * limit;
    const cacheKey = `allUsers:${page}:${limit}:${search}:${filterAdmin}`;

    // Check Redis cache first
    const cached = await redisConnection.get(cacheKey);
    let rawUsers = null;
    let totalUsers = 0;

    if (cached) {
      const parsed = JSON.parse(cached);
      rawUsers = parsed.users;
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
          'r.permissions as role_permissions'
        ])
        .orderBy('u.last_login', 'desc');

      // Apply search filter
      if (search && search.trim()) {
        query = query.where((eb) =>
          eb.or([
            eb('u.username', 'ilike', `%${search.trim()}%`),
            eb('u.id', '=', search.trim())
          ])
        );
      }

      // Apply admin filter
      if (filterAdmin === 'admin' || filterAdmin === 'non-admin') {
        const adminIds = getAdminIds();
        if (adminIds.length > 0) {
          if (filterAdmin === 'admin') {
            query = query.where('u.id', 'in', adminIds);
          } else {
            query = query.where('u.id', 'not in', adminIds);
          }
        } else if (filterAdmin === 'admin') {
          return {
            users: [],
            pagination: { page, limit, total: 0, pages: 0 }
          };
        }
      }

      const countQuery = query.clearSelect().select(({ fn }) => fn.countAll().as('count'));
      const countResult = await countQuery.executeTakeFirst();
      totalUsers = Number(countResult?.count) || 0;

      rawUsers = await query.limit(limit).offset(offset).execute();

      await redisConnection.set(cacheKey, JSON.stringify({ users: rawUsers, total: totalUsers }), 'EX', 300);  // 5 minutes
    }

    interface RawUser {
      id: string;
      username: string;
      discriminator: string;
      avatar: string | null;
      last_login: Date | null;
      ip_address: string | object | null;
      is_vpn: boolean;
      total_sessions_created: number;
      total_minutes: number;
      created_at: Date;
      settings: string | null;
      roblox_username: string | null;
      role_id: string | null;
      role_name?: string | null;
      role_permissions?: string | object | null;
      [key: string]: unknown;
    }

    const usersWithAdminStatus = (rawUsers as RawUser[]).map((user: RawUser) => {
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
          if (typeof user.role_permissions === 'string') {
            rolePermissions = JSON.parse(user.role_permissions);
          } else if (typeof user.role_permissions === 'object') {
            rolePermissions = user.role_permissions;
          }
        }
      } catch (error) {
        console.warn(`Failed to parse role permissions for user ${user.id}:`, error);
        rolePermissions = null;
      }

      let decryptedIP = null;
      if (user.ip_address) {
        try {
          if (typeof user.ip_address === 'string' && user.ip_address.trim().startsWith('{')) {
            const parsed = JSON.parse(user.ip_address);
            decryptedIP = decrypt(parsed);
          } else if (
            typeof user.ip_address === 'object' &&
            (user.ip_address as { iv?: string; data?: string; authTag?: string }).iv &&
            (user.ip_address as { iv?: string; data?: string; authTag?: string }).data &&
            (user.ip_address as { iv?: string; data?: string; authTag?: string }).authTag
          ) {
            decryptedIP = decrypt(user.ip_address as { iv: string; data: string; authTag: string });
          } else {
            decryptedIP = user.ip_address;
          }
        } catch {
          console.warn(`Failed to parse/decrypt ip_address for user ${user.id}`);
          decryptedIP = user.ip_address;
        }
      }
      user.ip_address = decryptedIP;

      return {
        ...user,
        is_admin: isAdmin(user.id),
        settings: decryptedSettings,
        roleId: user.role_id,
        roleName: user.role_name,
        rolePermissions: rolePermissions
      };
    });

    return {
      users: usersWithAdminStatus,
      pagination: {
        page,
        limit,
        total: totalUsers,
        pages: Math.ceil(totalUsers / limit)
      }
    };
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
}

export async function getAdminSessions() {
  try {
    // Get all sessions with user info
    const sessions = await mainDb
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
        'u.avatar'
      ])
      .orderBy('s.created_at', 'desc')
      .execute();

    const activeUsers = getActiveUsers();

    const sessionsWithFlights = await Promise.all(
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
        const activeSessionUsers = activeUsers.get(session.session_id) || [];
        return {
          ...session,
          flight_count,
          active_users: activeSessionUsers,
          active_user_count: activeSessionUsers.length
        };
      })
    );

    return sessionsWithFlights;
  } catch (error) {
    console.error('Error fetching admin sessions:', error);
    throw error;
  }
}


export async function syncUserSessionCounts() {
  try {
    const sessionCounts = await mainDb
      .selectFrom('sessions')
      .select([
        'created_by',
        mainDb.fn.countAll().as('session_count')
      ])
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
      .where('id', 'not in', sessionCounts.map(r => r.created_by))
      .execute();

    return { message: 'Session counts synced successfully', updatedUsers: sessionCounts.length };
  } catch (error) {
    console.error('Error syncing user session counts:', error);
    throw error;
  }
}