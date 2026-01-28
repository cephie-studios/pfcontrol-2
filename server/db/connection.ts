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

// create databases if they don't exist
async function ensureDatabasesExist() {
  const mainDbUrl = process.env.POSTGRES_DB_URL;
  if (!mainDbUrl) {
    throw new Error('POSTGRES_DB_URL is not defined');
  }

  const url = new URL(mainDbUrl);
  const baseConnectionString = `postgresql://${url.username}:${url.password}@${url.host}/postgres`;

  const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';

  const client = new pg.Client({
    connectionString: baseConnectionString,
    ssl: isLocalhost ? false : { rejectUnauthorized: false },
  });

  try {
    await client.connect();

    const flightsDbName = 'pfcontrol_flights';
    const flightsResult = await client.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [flightsDbName]
    );
    if (flightsResult.rows.length === 0) {
      await client.query(`CREATE DATABASE ${flightsDbName}`);
      console.log(`[Database] Created database: ${flightsDbName}`);
    }

    const chatsDbName = 'pfcontrol_chats';
    const chatsResult = await client.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [chatsDbName]
    );
    if (chatsResult.rows.length === 0) {
      await client.query(`CREATE DATABASE ${chatsDbName}`);
      console.log(`[Database] Created database: ${chatsDbName}`);
    }
  } catch (error) {
    console.error('[Database] Error ensuring databases exist:', error);
    throw error;
  } finally {
    await client.end();
  }
}

await ensureDatabasesExist();

function getSSLConfig(connectionString: string) {
  const url = new URL(connectionString);
  const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  return isLocalhost ? false : { rejectUnauthorized: false };
}

export const mainDb = new Kysely<MainDatabase>({
  dialect: new PostgresDialect({
    pool: new pg.Pool({
      connectionString: process.env.POSTGRES_DB_URL,
      ssl: getSSLConfig(process.env.POSTGRES_DB_URL as string),
    }),
  }),
});

export const flightsDb = new Kysely<FlightsDatabase>({
  dialect: new PostgresDialect({
    pool: new pg.Pool({
      connectionString: process.env.POSTGRES_DB_URL_FLIGHTS,
      ssl: getSSLConfig(process.env.POSTGRES_DB_URL_FLIGHTS as string),
    }),
  }),
});

export const chatsDb = new Kysely<ChatsDatabase>({
  dialect: new PostgresDialect({
    pool: new pg.Pool({
      connectionString: process.env.POSTGRES_DB_URL_CHATS,
      ssl: getSSLConfig(process.env.POSTGRES_DB_URL_CHATS as string),
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
  await createGlobalChatTable();
  console.log('[Database] Tables initialized successfully');
} catch (err) {
  console.error('Failed to create tables:', err);
  process.exit(1);
}
