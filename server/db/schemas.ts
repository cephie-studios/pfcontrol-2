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
    .addColumn('user_id', 'varchar(255)', (col) =>
      col.references('users.id').onDelete('cascade')
    )
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
    .addColumn('user_id', 'varchar(255)', (col) =>
      col.references('users.id').onDelete('cascade')
    )
    .addColumn('role_id', 'integer', (col) =>
      col.references('roles.id').onDelete('cascade')
    )
    .addPrimaryKeyConstraint('user_roles_pkey', ['user_id', 'role_id'])
    .execute();

  // audit_log
  await mainDb.schema
    .createTable('audit_log')
    .ifNotExists()
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('user_id', 'varchar(255)', (col) =>
      col.references('users.id').onDelete('set null')
    )
    .addColumn('action', 'varchar(255)', (col) => col.notNull())
    .addColumn('details', 'jsonb')
    .addColumn('timestamp', 'timestamp', (col) => col.defaultTo('now()'))
    .execute();

  // bans
  await mainDb.schema
    .createTable('bans')
    .ifNotExists()
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('user_id', 'varchar(255)', (col) =>
      col.references('users.id').onDelete('cascade').notNull()
    )
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
    .addColumn('user_id', 'varchar(255)', (col) =>
      col.references('users.id').onDelete('cascade')
    )
    .addColumn('notification_id', 'integer', (col) =>
      col.references('notifications.id').onDelete('cascade')
    )
    .addColumn('read', 'boolean', (col) => col.defaultTo(false))
    .addColumn('read_at', 'timestamp')
    .execute();

  // testers
  await mainDb.schema
    .createTable('testers')
    .ifNotExists()
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('user_id', 'varchar(255)', (col) =>
      col.references('users.id').onDelete('cascade').unique().notNull()
    )
    .addColumn('approved', 'boolean', (col) => col.defaultTo(false))
    .execute();

  // tester_settings
  await mainDb.schema
    .createTable('tester_settings')
    .ifNotExists()
    .addColumn('tester_id', 'integer', (col) =>
      col.references('testers.id').onDelete('cascade').primaryKey()
    )
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

  // chat_report
  await mainDb.schema
    .createTable('chat_report')
    .ifNotExists()
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('session_id', 'varchar(255)', (col) => col.notNull())
    .addColumn('message_id', 'integer', (col) => col.notNull())
    .addColumn('reporter_user_id', 'varchar(255)', (col) => col.notNull())
    .addColumn('reporter_username', 'varchar(255)')
    .addColumn('reported_user_id', 'varchar(255)', (col) => col.notNull())
    .addColumn('reported_username', 'varchar(255)')
    .addColumn('reported_avatar', 'varchar(255)')
    .addColumn('message', 'text', (col) => col.notNull())
    .addColumn('reason', 'text', (col) => col.notNull())
    .addColumn('timestamp', 'timestamp', (col) => col.defaultTo('now()'))
    .addColumn('status', 'varchar(50)', (col) => col.defaultTo('pending'))
    .addColumn('avatar', 'varchar(255)')
    .execute();

  // update_modals
  await mainDb.schema
    .createTable('update_modals')
    .ifNotExists()
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('title', 'varchar(255)', (col) => col.notNull())
    .addColumn('content', 'text', (col) => col.notNull())
    .addColumn('banner_url', 'text')
    .addColumn('is_active', 'boolean', (col) => col.defaultTo(false).notNull())
    .addColumn('published_at', 'timestamp')
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo('now()'))
    .addColumn('updated_at', 'timestamp', (col) => col.defaultTo('now()'))
    .execute();

  // flight_logs
  await mainDb.schema
    .createTable('flight_logs')
    .ifNotExists()
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('user_id', 'varchar(255)', (col) => col.notNull())
    .addColumn('username', 'varchar(255)', (col) => col.notNull())
    .addColumn('session_id', 'varchar(255)', (col) => col.notNull())
    .addColumn('action', 'varchar(50)', (col) => col.notNull())
    .addColumn('flight_id', 'varchar(255)', (col) => col.notNull())
    .addColumn('old_data', 'jsonb')
    .addColumn('new_data', 'jsonb')
    .addColumn('ip_address', 'varchar(255)')
    .addColumn('timestamp', 'timestamp', (col) => col.defaultTo('now()'))
    .execute();

  // feedback
  await mainDb.schema
    .createTable('feedback')
    .ifNotExists()
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('user_id', 'varchar(255)', (col) => col.notNull())
    .addColumn('username', 'varchar(255)', (col) => col.notNull())
    .addColumn('rating', 'integer', (col) => col.notNull())
    .addColumn('comment', 'text')
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo('now()'))
    .addColumn('updated_at', 'timestamp', (col) => col.defaultTo('now()'))
    .execute();

  // api_logs
  await mainDb.schema
    .createTable('api_logs')
    .ifNotExists()
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('user_id', 'varchar(255)')
    .addColumn('username', 'varchar(255)')
    .addColumn('method', 'varchar(10)', (col) => col.notNull())
    .addColumn('path', 'text', (col) => col.notNull())
    .addColumn('status_code', 'integer', (col) => col.notNull())
    .addColumn('response_time', 'integer', (col) => col.notNull())
    .addColumn('ip_address', 'text')
    .addColumn('user_agent', 'text')
    .addColumn('request_body', 'text')
    .addColumn('response_body', 'text')
    .addColumn('error_message', 'text')
    .addColumn('timestamp', 'timestamp', (col) => col.defaultTo('now()'))
    .execute();

  try {
    await mainDb.schema
      .createIndex('idx_api_logs_timestamp')
      .on('api_logs')
      .column('timestamp')
      .execute();
  } catch {
    // Index might already exist
  }

  try {
    await mainDb.schema
      .createIndex('idx_api_logs_user_id')
      .on('api_logs')
      .column('user_id')
      .execute();
  } catch {
    // Index might already exist
  }

  await mainDb.schema
    .createIndex('api_logs_path_idx')
    .ifNotExists()
    .on('api_logs')
    .column('path')
    .execute();

  await mainDb.schema
    .createIndex('api_logs_status_code_idx')
    .ifNotExists()
    .on('api_logs')
    .column('status_code')
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

export async function createGlobalChatTable() {
  await chatsDb.schema
    .createTable('global_chat')
    .ifNotExists()
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('user_id', 'varchar(255)', (col) => col.notNull())
    .addColumn('username', 'varchar(255)')
    .addColumn('avatar', 'varchar(255)')
    .addColumn('station', 'varchar(50)')
    .addColumn('position', 'varchar(50)')
    .addColumn('message', 'jsonb', (col) => col.notNull())
    .addColumn('airport_mentions', 'jsonb')
    .addColumn('user_mentions', 'jsonb')
    .addColumn('sent_at', 'timestamp', (col) => col.defaultTo('now()'))
    .addColumn('deleted_at', 'timestamp')
    .execute();

  // Index for efficient deletion of old messages
  await chatsDb.schema
    .createIndex('global_chat_sent_at_idx')
    .ifNotExists()
    .on('global_chat')
    .column('sent_at')
    .execute();
}
