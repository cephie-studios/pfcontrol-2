import { mainDb } from "./connection.js";
import { encrypt, decrypt } from "../utils/encryption.js";
import { sql } from "kysely";

export interface FlightLogData {
  userId: string;
  username: string;
  sessionId: string;
  action: 'add' | 'update' | 'delete';
  flightId: string;
  oldData?: object | null;
  newData?: object | null;
  ipAddress?: string | null;
}

export async function logFlightAction(logData: FlightLogData) {
  const {
    userId,
    username,
    sessionId,
    action,
    flightId,
    oldData = null,
    newData = null,
    ipAddress = null
  } = logData;

  try {
    const encryptedIP = ipAddress ? JSON.stringify(encrypt(ipAddress)) : null;
    await mainDb
      .insertInto('flight_logs')
      .values({
        id: sql`DEFAULT`,
        user_id: userId,
        username,
        session_id: sessionId,
        action,
        flight_id: flightId,
        old_data: oldData,
        new_data: newData,
        ip_address: encryptedIP,
        timestamp: sql`NOW()`
      })
      .execute();
  } catch (error) {
    console.error('Error logging flight action:', error);
  }
}

export async function cleanupOldFlightLogs(daysToKeep = 30) {
  try {
    const result = await mainDb
      .deleteFrom('flight_logs')
      .where('timestamp', '<', new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000))
      .executeTakeFirst();

    return Number(result?.numDeletedRows ?? 0);
  } catch (error) {
    console.error('Error cleaning up flight logs:', error);
    throw error;
  }
}

let cleanupInterval: NodeJS.Timeout | null = null;

export function startFlightLogsCleanup() {
  const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // Daily

  setTimeout(async () => {
    try {
      await cleanupOldFlightLogs(30);
    } catch (error) {
      console.error('Initial flight logs cleanup failed:', error);
    }
  }, 60 * 1000);

  cleanupInterval = setInterval(async () => {
    try {
      await cleanupOldFlightLogs(30);
    } catch (error) {
      console.error('Scheduled flight logs cleanup failed:', error);
    }
  }, CLEANUP_INTERVAL);
}

export function stopFlightLogsCleanup() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

export interface FlightLogFilters {
  general?: string;
  user?: string;
  action?: 'add' | 'update' | 'delete';
  session?: string;
  flightId?: string;
  date?: string;
  text?: string;
}

export async function getFlightLogs(
  page = 1,
  limit = 50,
  filters: FlightLogFilters = {}
) {
  try {
    let query = mainDb
      .selectFrom('flight_logs')
      .selectAll()
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .offset((page - 1) * limit);

    if (filters.general) {
      const searchPattern = `%${filters.general}%`;
      query = query.where((eb) =>
        eb.or([
          eb('username', 'ilike', searchPattern),
          eb('session_id', 'ilike', searchPattern),
          eb('flight_id', 'ilike', searchPattern),
          eb('user_id', 'ilike', searchPattern),
          eb(sql`old_data::text`, 'ilike', searchPattern),
          eb(sql`new_data::text`, 'ilike', searchPattern),
        ])
      );
    }

    if (filters.user) {
      query = query.where('username', 'ilike', `%${filters.user}%`);
    }
    if (filters.action) {
      query = query.where('action', '=', filters.action);
    }
    if (filters.session) {
      query = query.where('session_id', '=', filters.session);
    }
    if (filters.flightId) {
      query = query.where('flight_id', '=', filters.flightId);
    }
    if (filters.date) {
      const startOfDay = new Date(filters.date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(filters.date);
      endOfDay.setHours(23, 59, 59, 999);
      
      query = query.where('timestamp', '>=', startOfDay);
      query = query.where('timestamp', '<=', endOfDay);
    }
    if (filters.text) {
      const searchPattern = `%${filters.text}%`;
      query = query.where((eb) =>
        eb.or([
          eb(sql`old_data::text`, 'ilike', searchPattern),
          eb(sql`new_data::text`, 'ilike', searchPattern),
        ])
      );
    }

    let countQuery = mainDb
      .selectFrom('flight_logs')
      .select((eb) => eb.fn.count('id').as('count'));

    if (filters.general) {
      const searchPattern = `%${filters.general}%`;
      countQuery = countQuery.where((eb) =>
        eb.or([
          eb('username', 'ilike', searchPattern),
          eb('session_id', 'ilike', searchPattern),
          eb('flight_id', 'ilike', searchPattern),
          eb('user_id', 'ilike', searchPattern),
          eb(sql`old_data::text`, 'ilike', searchPattern),
          eb(sql`new_data::text`, 'ilike', searchPattern),
        ])
      );
    }
    if (filters.user) {
      countQuery = countQuery.where('username', 'ilike', `%${filters.user}%`);
    }
    if (filters.action) {
      countQuery = countQuery.where('action', '=', filters.action);
    }
    if (filters.session) {
      countQuery = countQuery.where('session_id', '=', filters.session);
    }
    if (filters.flightId) {
      countQuery = countQuery.where('flight_id', '=', filters.flightId);
    }
    if (filters.date) {
      const startOfDay = new Date(filters.date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(filters.date);
      endOfDay.setHours(23, 59, 59, 999);
      
      countQuery = countQuery.where('timestamp', '>=', startOfDay);
      countQuery = countQuery.where('timestamp', '<=', endOfDay);
    }
    if (filters.text) {
      const searchPattern = `%${filters.text}%`;
      countQuery = countQuery.where((eb) =>
        eb.or([
          eb(sql`old_data::text`, 'ilike', searchPattern),
          eb(sql`new_data::text`, 'ilike', searchPattern),
        ])
      );
    }

    const logs = await query.execute();
    const total = await countQuery.executeTakeFirst();

    return {
      logs: logs.map(log => ({
        ...log,
        ip_address: log.ip_address ? decrypt(JSON.parse(log.ip_address)) : null,
      })),
      pagination: {
        page,
        limit,
        total: Number(total?.count || 0),
        pages: Math.ceil(Number(total?.count || 0) / limit),
      },
    };
  } catch (error) {
    console.error('Error fetching flight logs:', error);
    throw error;
  }
}

export async function getFlightLogById(logId: string | number) {
  try {
    const log = await mainDb
      .selectFrom('flight_logs')
      .selectAll()
      .where('id', '=', Number(logId))
      .executeTakeFirst();

    if (!log) return null;

    return {
      ...log,
      ip_address: log.ip_address ? decrypt(JSON.parse(log.ip_address)) : null,
    };
  } catch (error) {
    console.error('Error fetching flight log by ID:', error);
    throw error;
  }
}