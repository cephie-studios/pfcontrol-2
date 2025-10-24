import { mainDb, flightsDb, chatsDb } from './connection.js';

export async function createMainTables() {
  // app_settings
  await mainDb.schema
    .createTable('app_settings')
    .ifNotExists()
    .addColumn('key', 'varchar(255)', (col) => col.primaryKey())
    .addColumn('value', 'text')
    .execute();

  // users (assuming based on typical UsersTable interface)
  await mainDb.schema
    .createTable('users')
    .ifNotExists()
    .addColumn('id', 'varchar(255)', (col) => col.primaryKey())
    .addColumn('username', 'varchar(255)', (col) => col.unique().notNull())
    .addColumn('email', 'varchar(255)', (col) => col.unique().notNull())
    .addColumn('password_hash', 'varchar(255)', (col) => col.notNull())
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo('now()'))
    .addColumn('updated_at', 'timestamp', (col) => col.defaultTo('now()'))
    .addColumn('statistics', 'jsonb', (col) => col.defaultTo('{}'))
    .execute();

  // sessions
  await mainDb.schema
    .createTable('sessions')
    .ifNotExists()
    .addColumn('id', 'varchar(255)', (col) => col.primaryKey())
    .addColumn('user_id', 'varchar(255)', (col) => col.references('users.id').onDelete('cascade'))
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo('now()'))
    .addColumn('expires_at', 'timestamp')
    .execute();

  // roles
  await mainDb.schema
    .createTable('roles')
    .ifNotExists()
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('name', 'varchar(255)', (col) => col.unique().notNull())
    .addColumn('description', 'text')
    .execute();

  // user_roles
  await mainDb.schema
    .createTable('user_roles')
    .ifNotExists()
    .addColumn('user_id', 'varchar(255)', (col) => col.references('users.id').onDelete('cascade'))
    .addColumn('role_id', 'integer', (col) => col.references('roles.id').onDelete('cascade'))
    .addPrimaryKeyConstraint('user_roles_pkey', ['user_id', 'role_id'])
    .execute();

  // audit_log
  await mainDb.schema
    .createTable('audit_log')
    .ifNotExists()
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('user_id', 'varchar(255)', (col) => col.references('users.id').onDelete('set null'))
    .addColumn('action', 'varchar(255)', (col) => col.notNull())
    .addColumn('details', 'jsonb')
    .addColumn('timestamp', 'timestamp', (col) => col.defaultTo('now()'))
    .execute();

  // bans
  await mainDb.schema
    .createTable('bans')
    .ifNotExists()
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('user_id', 'varchar(255)', (col) => col.references('users.id').onDelete('cascade').notNull())
    .addColumn('reason', 'text')
    .addColumn('banned_at', 'timestamp', (col) => col.defaultTo('now()'))
    .addColumn('expires_at', 'timestamp')
    .execute();

  // notifications
  await mainDb.schema
    .createTable('notifications')
    .ifNotExists()
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('title', 'varchar(255)', (col) => col.notNull())
    .addColumn('message', 'text', (col) => col.notNull())
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo('now()'))
    .execute();

  // user_notifications
  await mainDb.schema
    .createTable('user_notifications')
    .ifNotExists()
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('user_id', 'varchar(255)', (col) => col.references('users.id').onDelete('cascade'))
    .addColumn('notification_id', 'integer', (col) => col.references('notifications.id').onDelete('cascade'))
    .addColumn('read', 'boolean', (col) => col.defaultTo(false))
    .addColumn('read_at', 'timestamp')
    .execute();

  // testers
  await mainDb.schema
    .createTable('testers')
    .ifNotExists()
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('user_id', 'varchar(255)', (col) => col.references('users.id').onDelete('cascade').unique().notNull())
    .addColumn('approved', 'boolean', (col) => col.defaultTo(false))
    .execute();

  // tester_settings
  await mainDb.schema
    .createTable('tester_settings')
    .ifNotExists()
    .addColumn('tester_id', 'integer', (col) => col.references('testers.id').onDelete('cascade').primaryKey())
    .addColumn('settings', 'jsonb')
    .execute();

  // daily_statistics
  await mainDb.schema
    .createTable('daily_statistics')
    .ifNotExists()
    .addColumn('date', 'date', (col) => col.primaryKey())
    .addColumn('flights_count', 'integer', (col) => col.defaultTo(0))
    .addColumn('users_count', 'integer', (col) => col.defaultTo(0))
    .execute();
}

// Helper to create a dynamic flights table for a session
export async function createFlightsTable(sessionId: string) {
  const tableName = `flights_${sessionId}`;
  await flightsDb.schema
    .createTable(tableName)
    .ifNotExists()
    .addColumn('id', 'varchar(255)', (col) => col.primaryKey())
    .addColumn('session_id', 'varchar(255)', (col) => col.notNull())
    .addColumn('user_id', 'varchar(255)')
    .addColumn('ip_address', 'varchar(45)')
    .addColumn('callsign', 'varchar(255)')
    .addColumn('aircraft', 'varchar(255)')
    .addColumn('flight_type', 'varchar(50)')
    .addColumn('departure', 'varchar(10)')
    .addColumn('arrival', 'varchar(10)')
    .addColumn('alternate', 'varchar(10)')
    .addColumn('route', 'text')
    .addColumn('sid', 'varchar(50)')
    .addColumn('star', 'varchar(50)')
    .addColumn('runway', 'varchar(10)')
    .addColumn('clearedfl', 'varchar(10)')
    .addColumn('cruisingfl', 'varchar(10)')
    .addColumn('stand', 'varchar(10)')
    .addColumn('gate', 'varchar(10)')
    .addColumn('remark', 'text')
    .addColumn('timestamp', 'varchar(255)')
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo('now()'))
    .addColumn('updated_at', 'timestamp', (col) => col.defaultTo('now()'))
    .addColumn('status', 'varchar(50)')
    .addColumn('clearance', 'text')
    .addColumn('position', 'jsonb')
    .addColumn('squawk', 'varchar(10)')
    .addColumn('wtc', 'varchar(5)')
    .addColumn('hidden', 'boolean', (col) => col.defaultTo(false))
    .addColumn('acars_token', 'varchar(255)')
    .addColumn('pdc_remarks', 'text')
    .execute();
}

export async function createChatsTable(sessionId: string) {
  const tableName = `chat_${sessionId}`;
  await chatsDb.schema
    .createTable(tableName)
    .ifNotExists()
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('user_id', 'varchar(255)', (col) => col.notNull())
    .addColumn('username', 'varchar(255)')
    .addColumn('avatar', 'varchar(255)')
    .addColumn('message', 'text', (col) => col.notNull())
    .addColumn('mentions', 'jsonb')
    .addColumn('sent_at', 'timestamp', (col) => col.defaultTo('now()'))
    .execute();
}