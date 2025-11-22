import { mainDb } from './connection.js';
import { decrypt } from '../utils/encryption.js';
import { redisConnection } from './connection.js';
import { sql } from 'kysely';

export interface ApiLogFilters {
  userId?: string;
  username?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export interface ApiLogStats {
  totalRequests: number;
  averageResponseTime: number;
  errorRate: number;
  topEndpoints: Array<{
    path: string;
    count: number;
    avgResponseTime: number;
  }>;
  statusCodeDistribution: Array<{
    statusCode: number;
    count: number;
  }>;
  dailyStats: Array<{
    date: string;
    requestCount: number;
    errorCount: number;
    avgResponseTime: number;
  }>;
}

export async function getApiLogs(
  page = 1,
  limit = 50,
  filters: ApiLogFilters = {}
) {
  try {
    const offset = (page - 1) * limit;

    let query = mainDb
      .selectFrom('api_logs')
      .select([
        'id',
        'user_id',
        'username',
        'method',
        'path',
        'status_code',
        'response_time',
        'ip_address',
        'user_agent',
        'request_body',
        'response_body',
        'error_message',
        'timestamp',
      ])
      .orderBy('timestamp', 'desc');

    if (filters.userId) {
      query = query.where((q) =>
        q.or([
          q('user_id', 'ilike', `%${filters.userId}%`),
          q('username', 'ilike', `%${filters.userId}%`),
        ])
      );
    }

    if (filters.method) {
      query = query.where('method', '=', filters.method.toUpperCase());
    }

    if (filters.path) {
      query = query.where('path', 'ilike', `%${filters.path}%`);
    }

    if (filters.statusCode) {
      query = query.where('status_code', '=', filters.statusCode);
    }

    if (filters.dateFrom) {
      query = query.where('timestamp', '>=', new Date(filters.dateFrom));
    }

    if (filters.dateTo) {
      query = query.where('timestamp', '<=', new Date(filters.dateTo));
    }

    if (filters.search) {
      query = query.where((q) =>
        q.or([
          q('path', 'ilike', `%${filters.search}%`),
          q('username', 'ilike', `%${filters.search}%`),
          q('method', 'ilike', `%${filters.search}%`),
        ])
      );
    }

    let countQuery = mainDb
      .selectFrom('api_logs')
      .select(sql<number>`count(*)`.as('count'));

    if (filters.userId) {
      countQuery = countQuery.where((q) =>
        q.or([
          q('user_id', 'ilike', `%${filters.userId}%`),
          q('username', 'ilike', `%${filters.userId}%`),
        ])
      );
    }
    if (filters.method) {
      countQuery = countQuery.where(
        'method',
        '=',
        filters.method.toUpperCase()
      );
    }
    if (filters.path) {
      countQuery = countQuery.where('path', 'ilike', `%${filters.path}%`);
    }
    if (filters.statusCode) {
      countQuery = countQuery.where('status_code', '=', filters.statusCode);
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
    if (filters.search) {
      countQuery = countQuery.where((q) =>
        q.or([
          q('path', 'ilike', `%${filters.search}%`),
          q('username', 'ilike', `%${filters.search}%`),
          q('method', 'ilike', `%${filters.search}%`),
        ])
      );
    }

    const totalResult = await countQuery.executeTakeFirst();
    const total = Number(totalResult?.count || 0);

    // Get paginated results
    const logs = await query.limit(limit).offset(offset).execute();

    // Decrypt sensitive fields for display
    const decryptedLogs = logs.map((log) => ({
      ...log,
      ip_address: log.ip_address ? decrypt(JSON.parse(log.ip_address)) : null,
      request_body: log.request_body
        ? decrypt(JSON.parse(log.request_body))
        : null,
      response_body: log.response_body
        ? decrypt(JSON.parse(log.response_body))
        : null,
      error_message: log.error_message
        ? decrypt(JSON.parse(log.error_message))
        : null,
    }));

    return {
      logs: decryptedLogs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error('Error fetching API logs:', error);
    throw error;
  }
}

export async function getApiLogById(logId: number | string) {
  try {
    const log = await mainDb
      .selectFrom('api_logs')
      .selectAll()
      .where('id', '=', typeof logId === 'string' ? parseInt(logId) : logId)
      .executeTakeFirst();

    if (!log) return null;

    // Decrypt sensitive fields
    return {
      ...log,
      ip_address: log.ip_address ? decrypt(JSON.parse(log.ip_address)) : null,
      request_body: log.request_body
        ? decrypt(JSON.parse(log.request_body))
        : null,
      response_body: log.response_body
        ? decrypt(JSON.parse(log.response_body))
        : null,
      error_message: log.error_message
        ? decrypt(JSON.parse(log.error_message))
        : null,
    };
  } catch (error) {
    console.error('Error fetching API log by ID:', error);
    throw error;
  }
}

export async function getApiLogStats(days: number = 7): Promise<ApiLogStats> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Total requests and average response time
    const totalStatsResult = await mainDb
      .selectFrom('api_logs')
      .select([
        sql<number>`count(*)`.as('totalRequests'),
        sql<number>`avg(response_time)`.as('averageResponseTime'),
        sql<number>`count(case when status_code >= 400 then 1 end)`.as(
          'errorCount'
        ),
      ])
      .where('timestamp', '>=', cutoffDate)
      .executeTakeFirst();

    const totalRequests = Number(totalStatsResult?.totalRequests || 0);
    const averageResponseTime = Number(
      totalStatsResult?.averageResponseTime || 0
    );
    const errorCount = Number(totalStatsResult?.errorCount || 0);
    const errorRate =
      totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0;

    // Top endpoints
    const topEndpoints = await mainDb
      .selectFrom('api_logs')
      .select([
        'path',
        sql<number>`count(*)`.as('count'),
        sql<number>`avg(response_time)`.as('avgResponseTime'),
      ])
      .where('timestamp', '>=', cutoffDate)
      .groupBy('path')
      .orderBy('count', 'desc')
      .limit(10)
      .execute();

    // Status code distribution
    const statusCodeDistribution = await mainDb
      .selectFrom('api_logs')
      .select(['status_code', sql<number>`count(*)`.as('count')])
      .where('timestamp', '>=', cutoffDate)
      .groupBy('status_code')
      .orderBy('count', 'desc')
      .execute();

    // Daily stats
    const dailyStats = await mainDb
      .selectFrom('api_logs')
      .select([
        sql<string>`date(timestamp)`.as('date'),
        sql<number>`count(*)`.as('requestCount'),
        sql<number>`count(case when status_code >= 400 then 1 end)`.as(
          'errorCount'
        ),
        sql<number>`avg(response_time)`.as('avgResponseTime'),
      ])
      .where('timestamp', '>=', cutoffDate)
      .groupBy(sql`date(timestamp)`)
      .orderBy('date', 'desc')
      .execute();

    return {
      totalRequests,
      averageResponseTime: Math.round(averageResponseTime),
      errorRate: Math.round(errorRate * 100) / 100,
      topEndpoints: topEndpoints.map((endpoint) => ({
        path: endpoint.path,
        count: Number(endpoint.count),
        avgResponseTime: Math.round(Number(endpoint.avgResponseTime)),
      })),
      statusCodeDistribution: statusCodeDistribution.map((status) => ({
        statusCode: status.status_code,
        count: Number(status.count),
      })),
      dailyStats: dailyStats.map((day) => ({
        date: day.date,
        requestCount: Number(day.requestCount),
        errorCount: Number(day.errorCount),
        avgResponseTime: Math.round(Number(day.avgResponseTime)),
      })),
    };
  } catch (error) {
    console.error('Error fetching API log stats:', error);
    throw error;
  }
}

export async function getApiLogStatsLast24Hours(): Promise<
  Array<{
    hour: string;
    successful: number;
    clientErrors: number;
    serverErrors: number;
    other: number;
  }>
> {
  const cacheKey = 'api_logs:stats_24h_hourly';

  try {
    const cached = await redisConnection.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (error) {
    console.warn(
      '[Redis] Failed to read cache for 24h hourly stats:',
      (error as Error)?.message
    );
  }

  try {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - 24);

    const hourlyStats = await mainDb
      .selectFrom('api_logs')
      .select([
        sql<string>`date_trunc('hour', timestamp)`.as('hour'),
        sql<number>`count(case when status_code >= 200 and status_code < 300 then 1 end)`.as(
          'successful'
        ),
        sql<number>`count(case when status_code >= 400 and status_code < 500 then 1 end)`.as(
          'clientErrors'
        ),
        sql<number>`count(case when status_code >= 500 then 1 end)`.as(
          'serverErrors'
        ),
        sql<number>`count(case when (status_code < 200 or (status_code >= 300 and status_code < 400)) then 1 end)`.as(
          'other'
        ),
      ])
      .where('timestamp', '>=', cutoffDate)
      .groupBy(sql`date_trunc('hour', timestamp)`)
      .orderBy('hour', 'asc')
      .execute();

    const result = hourlyStats.map((stat) => ({
      hour: stat.hour,
      successful: Number(stat.successful),
      clientErrors: Number(stat.clientErrors),
      serverErrors: Number(stat.serverErrors),
      other: Number(stat.other),
    }));

    try {
      await redisConnection.set(cacheKey, JSON.stringify(result), 'EX', 900);
    } catch (error) {
      console.warn(
        '[Redis] Failed to set cache for 24h hourly stats:',
        (error as Error)?.message
      );
    }

    return result;
  } catch (error) {
    console.error(
      'Error fetching API log stats for last 24 hours (hourly):',
      error
    );
    throw error;
  }
}
