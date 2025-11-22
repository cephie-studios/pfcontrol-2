import { Kysely, PostgresDialect } from 'kysely';
import { createMainTables, createGlobalChatTable } from './schemas.js';
import pg from 'pg';
import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config({
  path:
    process.env.NODE_ENV === 'production'
      ? '.env.production'
      : '.env.development',
});

import type { MainDatabase } from './types/connection/MainDatabase';
import type { FlightsDatabase } from './types/connection/FlightsDatabase';
import type { ChatsDatabase } from './types/connection/ChatsDatabase';

export const mainDb = new Kysely<MainDatabase>({
  dialect: new PostgresDialect({
    pool: new pg.Pool({
      connectionString: process.env.POSTGRES_DB_URL,
      ssl: { rejectUnauthorized: false },
    }),
  }),
});

export const flightsDb = new Kysely<FlightsDatabase>({
  dialect: new PostgresDialect({
    pool: new pg.Pool({
      connectionString: process.env.POSTGRES_DB_URL_FLIGHTS,
      ssl: { rejectUnauthorized: false },
    }),
  }),
});

export const chatsDb = new Kysely<ChatsDatabase>({
  dialect: new PostgresDialect({
    pool: new pg.Pool({
      connectionString: process.env.POSTGRES_DB_URL_CHATS,
      ssl: { rejectUnauthorized: false },
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

createMainTables().catch((err) => {
  console.error('Failed to create main tables:', err);
  process.exit(1);
});

createGlobalChatTable().catch((err) => {
  console.error('Failed to create global chat table:', err);
  process.exit(1);
});
