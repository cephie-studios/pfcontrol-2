import { mainDb } from "./connection.js";
import { encrypt, decrypt } from "../utils/encryption.js"; // Assuming decrypt function exists
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
    // Non-blocking: don't throw, just log
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

  // Initial cleanup after 1 minute
  setTimeout(async () => {
    try {
      await cleanupOldFlightLogs(30);
    } catch (error) {
      console.error('Initial flight logs cleanup failed:', error);
    }
  }, 60 * 1000);

  // Recurring cleanup
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
  user?: string;
  action?: 'add' | 'update' | 'delete';
  session?: string;
  flightId?: string;
  dateFrom?: string;
  dateTo?: string;
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
    if (filters.dateFrom) {
      query = query.where('timestamp', '>=', new Date(filters.dateFrom));
    }
    if (filters.dateTo) {
      query = query.where('timestamp', '<=', new Date(filters.dateTo));
    }

    const logs = await query.execute();
    const total = await mainDb
      .selectFrom('flight_logs')
      .select((eb) => eb.fn.count('id').as('count'))
      .executeTakeFirst();

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