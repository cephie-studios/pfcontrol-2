import { Kysely, PostgresDialect } from 'kysely';
import {
  createMainTables,
  ensureSessionsAdvancedAtcColumn,
  ensureSessionsArrivalRunwayColumn,
  ensureSessionsNetworkFlagsExclusiveConstraint,
  ensureGlobalChatNetworkKindColumn,
  ensureSessionsDeveloperApiKeyColumn,
  ensureDeveloperApiPolicyColumns,
  ensureDeveloperApiUsageBodyColumns,
  ensureUserHistoryColumns,
  ensureAppSettingsChannelColumn,
  ensureTesterSettingsChannelColumn,
  ensureEventModeColumns,
  ensureFlightReqColumns,
  ensureFlightRobloxUsernameColumn,
  ensureFlightRobloxLinkedColumn,
  ensureDailyDatabaseMetricsTables,
  ensureWebsocketSnapshotsTable,
  ensurePerformanceIndexes,
  ensureSessionsFeedbackEnabledColumn,
  ensureSessionsExternalSessionColumn,
  ensureControllerRatingsCommentAndSessionColumns,
  ensureControllerRatingsModerationColumns,
  ensureUserBioModerationColumns,
  ensurePlatformTokenColumn,
  ensureUserNotificationsIssuerColumns,
  ensureUserNotificationsCreatedAtDefault,
  ensureFlightLogsTrigramIndexes,
  syncVersionFromEnv,
} from './schemas.js';
import pg from 'pg';
import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config({
  path:
    process.env.NODE_ENV === 'production'
      ? '.env.production'
      : process.env.NODE_ENV === 'canary'
        ? '.env.canary'
        : '.env.development',
});

import type { MainDatabase } from './types/connection/MainDatabase.js';

function getSSLConfig(connectionString: string) {
  const url = new URL(connectionString);
  const isLocalhost =
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1' ||
    url.hostname === 'postgres';
  return isLocalhost ? false : { rejectUnauthorized: false };
}

const dbUrl = process.env.POSTGRES_DB_URL;
if (!dbUrl) throw new Error('POSTGRES_DB_URL is not defined');

export const mainDb = new Kysely<MainDatabase>({
  dialect: new PostgresDialect({
    pool: new pg.Pool({
      connectionString: dbUrl,
      ssl: getSSLConfig(dbUrl),
    }),
  }),
});

if (!process.env.REDIS_URL) {
  throw new Error('REDIS_URL is not defined in environment variables');
}
export const redisConnection = new Redis(process.env.REDIS_URL as string);

redisConnection.on('error', (err) => {
  console.error('[Redis] Connection error:', err.message);
});

redisConnection.on('connect', () => {
  console.log('[Redis] Connected successfully');
});

try {
  await createMainTables();
  await ensureSessionsAdvancedAtcColumn();
  await ensureSessionsArrivalRunwayColumn();
  await ensureSessionsNetworkFlagsExclusiveConstraint();
  await ensureGlobalChatNetworkKindColumn();
  await ensureSessionsDeveloperApiKeyColumn();
  await ensureDeveloperApiPolicyColumns();
  await ensureDeveloperApiUsageBodyColumns();
  await ensureUserHistoryColumns();
  await ensureAppSettingsChannelColumn();
  await ensureTesterSettingsChannelColumn();
  await ensureEventModeColumns();
  await ensureFlightReqColumns();
  await ensureFlightRobloxUsernameColumn();
  await ensureFlightRobloxLinkedColumn();
  await ensureDailyDatabaseMetricsTables();
  await ensureWebsocketSnapshotsTable();
  await ensurePerformanceIndexes();
  await ensureSessionsFeedbackEnabledColumn();
  await ensureSessionsExternalSessionColumn();
  await ensureControllerRatingsCommentAndSessionColumns();
  await ensureControllerRatingsModerationColumns();
  await ensureUserBioModerationColumns();
  await ensurePlatformTokenColumn();
  await ensureUserNotificationsIssuerColumns();
  await ensureUserNotificationsCreatedAtDefault();
  await ensureFlightLogsTrigramIndexes();
  await syncVersionFromEnv(redisConnection);
  console.log('[Database] Tables initialized successfully');
} catch (err) {
  console.error('Failed to create tables:', err);
  process.exit(1);
}
