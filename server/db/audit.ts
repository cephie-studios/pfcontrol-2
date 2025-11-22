import { mainDb } from './connection.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import { sql } from 'kysely';

export interface AdminActionData {
  adminId: number | string;
  adminUsername: string;
  actionType: string;
  targetUserId?: number | string | null;
  targetUsername?: string | null;
  details?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function logAdminAction(actionData: AdminActionData) {
  const {
    adminId,
    adminUsername,
    actionType,
    targetUserId = null,
    targetUsername = null,
    details = {},
    ipAddress = null,
    userAgent = null,
  } = actionData;

  try {
    const encryptedIP = ipAddress ? encrypt(ipAddress) : null;

    const result = await mainDb
      .insertInto('audit_log')
      .values({
        id: sql`DEFAULT`,
        admin_id: String(adminId),
        admin_username: adminUsername,
        action_type: actionType,
        target_user_id:
          targetUserId !== null && targetUserId !== undefined
            ? String(targetUserId)
            : undefined,
        target_username:
          targetUsername !== null && targetUsername !== undefined
            ? targetUsername
            : undefined,
        details: details as object,
        ip_address: encryptedIP ? JSON.stringify(encryptedIP) : undefined,
        user_agent:
          userAgent !== null && userAgent !== undefined ? userAgent : undefined,
      })
      .returning(['id', 'timestamp'])
      .executeTakeFirst();

    return result?.id;
  } catch (error) {
    console.error('Error logging admin action:', error);
    throw error;
  }
}

interface AuditLogFilters {
  adminId?: string;
  actionType?: string;
  targetUserId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export async function getAuditLogs(
  page = 1,
  limit = 50,
  filters: AuditLogFilters = {}
) {
  try {
    const offset = (page - 1) * limit;

    let query = mainDb
      .selectFrom('audit_log')
      .select([
        'id',
        'admin_id',
        'admin_username',
        'action_type',
        'target_user_id',
        'target_username',
        'details',
        'ip_address',
        'user_agent',
        'timestamp',
      ]);

    if (filters.adminId) {
      query = query.where((q) =>
        q.or([
          q('admin_id', 'ilike', `%${filters.adminId}%`),
          q('admin_username', 'ilike', `%${filters.adminId}%`),
        ])
      );
    }

    if (filters.actionType) {
      query = query.where('action_type', '=', filters.actionType);
    }

    if (filters.targetUserId) {
      query = query.where((q) =>
        q.or([
          q('target_user_id', 'ilike', `%${filters.targetUserId}%`),
          q('target_username', 'ilike', `%${filters.targetUserId}%`),
        ])
      );
    }

    if (filters.dateFrom) {
      query = query.where('timestamp', '>=', new Date(filters.dateFrom));
    }

    if (filters.dateTo) {
      query = query.where('timestamp', '<=', new Date(filters.dateTo));
    }

    const logsResult = await query
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .offset(offset)
      .execute();

    const logs = logsResult.map((log) => {
      let decryptedIP = null;
      if (log.ip_address) {
        try {
          const parsed = JSON.parse(log.ip_address as string);
          decryptedIP = decrypt(parsed);
        } catch {
          try {
            decryptedIP = decrypt(JSON.parse(log.ip_address as string));
          } catch {
            decryptedIP = null;
          }
        }
      }
      return {
        ...log,
        ip_address: decryptedIP,
        details:
          typeof log.details === 'string'
            ? JSON.parse(log.details)
            : log.details,
      };
    });

    // Count query for pagination
    let countQuery = mainDb
      .selectFrom('audit_log')
      .select(sql<number>`count(*)`.as('count'));
    if (filters.adminId) {
      countQuery = countQuery.where((q) =>
        q.or([
          q('admin_id', 'ilike', `%${filters.adminId}%`),
          q('admin_username', 'ilike', `%${filters.adminId}%`),
        ])
      );
    }
    if (filters.actionType) {
      countQuery = countQuery.where('action_type', '=', filters.actionType);
    }
    if (filters.targetUserId) {
      countQuery = countQuery.where((q) =>
        q.or([
          q('target_user_id', 'ilike', `%${filters.targetUserId}%`),
          q('target_username', 'ilike', `%${filters.targetUserId}%`),
        ])
      );
    }
    if (filters.dateFrom) {
      countQuery = countQuery.where(
        'timestamp',
        '>=',
        new Date(filters.dateFrom)
      );
    }
    if (filters.dateTo) {
      countQuery = countQuery.where(
        'timestamp',
        '<=',
        new Date(filters.dateTo)
      );
    }

    const countResult = await countQuery.executeTakeFirst();
    const totalLogs = Number(countResult?.count ?? 0);

    return {
      logs,
      pagination: {
        page,
        limit,
        total: totalLogs,
        pages: Math.ceil(totalLogs / limit),
      },
    };
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    throw error;
  }
}

export async function getAuditLogById(logId: number | string) {
  try {
    const result = await mainDb
      .selectFrom('audit_log')
      .select([
        'id',
        'admin_id',
        'admin_username',
        'action_type',
        'target_user_id',
        'target_username',
        'details',
        'ip_address',
        'user_agent',
        'timestamp',
      ])
      .where('id', '=', typeof logId === 'string' ? Number(logId) : logId)
      .executeTakeFirst();

    if (!result) {
      return null;
    }

    let decryptedIP = null;
    if (result.ip_address) {
      try {
        const parsed = JSON.parse(result.ip_address as string);
        decryptedIP = decrypt(parsed);
      } catch {
        try {
          decryptedIP = decrypt(JSON.parse(result.ip_address as string));
        } catch {
          decryptedIP = null;
        }
      }
    }

    return {
      ...result,
      ip_address: decryptedIP,
      details:
        typeof result.details === 'string'
          ? JSON.parse(result.details)
          : result.details,
    };
  } catch (error) {
    console.error('Error fetching audit log by ID:', error);
    throw error;
  }
}

export async function cleanupOldAuditLogs(daysToKeep = 14) {
  try {
    const result = await mainDb
      .deleteFrom('audit_log')
      .where(
        'timestamp',
        '<',
        new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000)
      )
      .executeTakeFirst();

    return Number(result?.numDeletedRows ?? 0);
  } catch (error) {
    console.error('Error cleaning up audit logs:', error);
    throw error;
  }
}

let cleanupInterval: NodeJS.Timeout | null = null;

function startAutomaticCleanup() {
  const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000;

  setTimeout(async () => {
    try {
      await cleanupOldAuditLogs(14);
    } catch (error) {
      console.error('Initial audit log cleanup failed:', error);
    }
  }, 60 * 1000);

  cleanupInterval = setInterval(async () => {
    try {
      await cleanupOldAuditLogs(14);
    } catch (error) {
      console.error('Scheduled audit log cleanup failed:', error);
    }
  }, CLEANUP_INTERVAL);
}

startAutomaticCleanup();
