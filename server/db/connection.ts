import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';

import type { MainDatabase } from './types/connection/MainDatabase';
import type { FlightsDatabase } from './types/connection/FlightsDatabase';
import type { ChatsDatabase } from './types/connection/ChatsDatabase';

export const mainDb = new Kysely<MainDatabase>({
  dialect: new PostgresDialect({
    pool: new pg.Pool({
      connectionString: process.env.POSTGRES_DB_URL,
      ssl: { rejectUnauthorized: false }
    })
  })
});

export const flightsDb = new Kysely<FlightsDatabase>({
  dialect: new PostgresDialect({
    pool: new pg.Pool({
      connectionString: process.env.POSTGRES_DB_URL_FLIGHTS,
      ssl: { rejectUnauthorized: false }
    })
  })
});

export const chatsDb = new Kysely<ChatsDatabase>({
  dialect: new PostgresDialect({
    pool: new pg.Pool({
      connectionString: process.env.POSTGRES_DB_URL_CHATS,
      ssl: { rejectUnauthorized: false }
    })
  })
});