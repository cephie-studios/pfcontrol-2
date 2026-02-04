import { mainDb, flightsDb, chatsDb } from './connection.js';

export async function createMainTables() {
  // app_settings
  await mainDb.schema
    .createTable('app_settings')
    .ifNotExists()
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('version', 'varchar(50)', (col) => col.notNull())
    .addColumn('updated_at', 'timestamp', (col) => col.notNull())
    .addColumn('updated_by', 'varchar(255)', (col) => col.notNull())
    .execute();

  // roles (must be created before users because users references roles)
  await mainDb.schema
    .createTable('roles')
    .ifNotExists()
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('name', 'varchar(255)', (col) => col.unique().notNull())
    .addColumn('description', 'text')
    .addColumn('permissions', 'jsonb', (col) => col.notNull())
    .addColumn('color', 'varchar(50)')
    .addColumn('icon', 'varchar(255)')
    .addColumn('priority', 'integer')
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo('now()'))
    .addColumn('updated_at', 'timestamp', (col) => col.defaultTo('now()'))
    .execute();

  // users
  await mainDb.schema
    .createTable('users')
    .ifNotExists()
    .addColumn('id', 'varchar(255)', (col) => col.primaryKey())
    .addColumn('username', 'varchar(255)', (col) => col.notNull())
    .addColumn('discriminator', 'varchar(10)', (col) => col.notNull())
    .addColumn('avatar', 'text')
    .addColumn('access_token', 'text')
    .addColumn('refresh_token', 'text')
    .addColumn('last_login', 'timestamp')
    .addColumn('ip_address', 'text')
    .addColumn('is_vpn', 'boolean')
    .addColumn('sessions', 'text')
    .addColumn('last_session_created', 'timestamp')
    .addColumn('last_session_deleted', 'timestamp')
    .addColumn('settings', 'text')
    .addColumn('settings_updated_at', 'timestamp')
    .addColumn('total_sessions_created', 'integer', (col) => col.defaultTo(0))
    .addColumn('total_minutes', 'integer', (col) => col.defaultTo(0))
    .addColumn('vatsim_cid', 'varchar(50)')
    .addColumn('vatsim_rating_id', 'integer')
    .addColumn('vatsim_rating_short', 'varchar(10)')
    .addColumn('vatsim_rating_long', 'varchar(255)')
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo('now()'))
    .addColumn('updated_at', 'timestamp', (col) => col.defaultTo('now()'))
    .addColumn('roblox_user_id', 'varchar(255)')
    .addColumn('roblox_username', 'varchar(255)')
    .addColumn('roblox_access_token', 'text')
    .addColumn('roblox_refresh_token', 'text')
    .addColumn('role_id', 'integer', (col) =>
      col.references('roles.id').onDelete('set null')
    )
    .addColumn('tutorialCompleted', 'boolean', (col) => col.defaultTo(false))
    .addColumn('statistics', 'text')
    .execute();

  // sessions
  await mainDb.schema
    .createTable('sessions')
    .ifNotExists()
    .addColumn('session_id', 'varchar(255)', (col) => col.primaryKey())
    .addColumn('access_id', 'varchar(255)', (col) => col.notNull())
    .addColumn('active_runway', 'varchar(10)')
    .addColumn('airport_icao', 'varchar(10)', (col) => col.notNull())
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo('now()'))
    .addColumn('created_by', 'varchar(255)', (col) => col.notNull())
    .addColumn('is_pfatc', 'boolean', (col) => col.defaultTo(false))
    .addColumn('flight_strips', 'text')
    .addColumn('atis', 'text')
    .addColumn('custom_name', 'varchar(255)')
    .addColumn('refreshed_at', 'timestamp')
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
    .addColumn('assigned_at', 'timestamp', (col) => col.defaultTo('now()'))
    .addPrimaryKeyConstraint('user_roles_pkey', ['user_id', 'role_id'])
    .execute();

  // audit_log
  await mainDb.schema
    .createTable('audit_log')
    .ifNotExists()
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('admin_id', 'varchar(255)', (col) => col.notNull())
    .addColumn('admin_username', 'varchar(255)', (col) => col.notNull())
    .addColumn('action_type', 'varchar(100)', (col) => col.notNull())
    .addColumn('target_user_id', 'varchar(255)')
    .addColumn('target_username', 'varchar(255)')
    .addColumn('details', 'jsonb')
    .addColumn('ip_address', 'text')
    .addColumn('user_agent', 'text')
    .addColumn('timestamp', 'timestamp', (col) => col.defaultTo('now()'))
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo('now()'))
    .execute();

  // bans
  await mainDb.schema
    .createTable('bans')
    .ifNotExists()
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('user_id', 'varchar(255)')
    .addColumn('ip_address', 'text')
    .addColumn('username', 'varchar(255)')
    .addColumn('reason', 'text')
    .addColumn('banned_by', 'varchar(255)', (col) => col.notNull())
    .addColumn('banned_at', 'timestamp', (col) => col.defaultTo('now()'))
    .addColumn('expires_at', 'timestamp')
    .addColumn('active', 'boolean', (col) => col.defaultTo(true))
    .execute();

  // notifications
  await mainDb.schema
    .createTable('notifications')
    .ifNotExists()
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('type', 'varchar(50)', (col) => col.notNull())
    .addColumn('text', 'text', (col) => col.notNull())
    .addColumn('show', 'boolean', (col) => col.defaultTo(true))
    .addColumn('custom_color', 'varchar(50)')
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo('now()'))
    .addColumn('updated_at', 'timestamp', (col) => col.defaultTo('now()'))
    .execute();

  // user_notifications
  await mainDb.schema
    .createTable('user_notifications')
    .ifNotExists()
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('user_id', 'varchar(255)', (col) =>
      col.references('users.id').onDelete('cascade').notNull()
    )
    .addColumn('type', 'varchar(50)', (col) => col.notNull())
    .addColumn('title', 'varchar(255)', (col) => col.notNull())
    .addColumn('message', 'text', (col) => col.notNull())
    .addColumn('read', 'boolean', (col) => col.defaultTo(false))
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo('now()'))
    .execute();

  // testers
  await mainDb.schema
    .createTable('testers')
    .ifNotExists()
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('user_id', 'varchar(255)', (col) =>
      col.references('users.id').onDelete('cascade').unique().notNull()
    )
    .addColumn('username', 'varchar(255)', (col) => col.notNull())
    .addColumn('added_by', 'varchar(255)', (col) => col.notNull())
    .addColumn('added_by_username', 'varchar(255)', (col) => col.notNull())
    .addColumn('notes', 'text')
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo('now()'))
    .addColumn('updated_at', 'timestamp', (col) => col.defaultTo('now()'))
    .execute();

  // tester_settings
  await mainDb.schema
    .createTable('tester_settings')
    .ifNotExists()
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('setting_key', 'varchar(255)', (col) => col.unique().notNull())
    .addColumn('setting_value', 'boolean', (col) => col.notNull())
    .addColumn('updated_at', 'timestamp', (col) => col.defaultTo('now()'))
    .execute();

  // daily_statistics
  await mainDb.schema
    .createTable('daily_statistics')
    .ifNotExists()
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('date', 'date', (col) => col.notNull().unique())
    .addColumn('logins_count', 'integer', (col) => col.defaultTo(0))
    .addColumn('new_sessions_count', 'integer', (col) => col.defaultTo(0))
    .addColumn('new_flights_count', 'integer', (col) => col.defaultTo(0))
    .addColumn('new_users_count', 'integer', (col) => col.defaultTo(0))
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo('now()'))
    .addColumn('updated_at', 'timestamp', (col) => col.defaultTo('now()'))
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
    .addColumn('timestamp', 'timestamp', (col) => col.notNull().defaultTo('now()'))
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
    .addColumn('ip_address', 'text', (col) => col.notNull())
    .addColumn('user_agent', 'text')
    .addColumn('request_body', 'text')
    .addColumn('response_body', 'text')
    .addColumn('error_message', 'text')
    .addColumn('timestamp', 'timestamp', (col) => col.notNull().defaultTo('now()'))
    .execute();

  // api_logs indexes
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

  // controller_ratings
  await mainDb.schema
    .createTable('controller_ratings')
    .ifNotExists()
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('controller_id', 'varchar(255)', (col) => col.notNull())
    .addColumn('pilot_id', 'varchar(255)', (col) => col.notNull())
    .addColumn('rating', 'integer', (col) => col.notNull())
    .addColumn('flight_id', 'varchar(255)')
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo('now()'))
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
    .addColumn('ip_address', 'text')
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
