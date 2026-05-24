import { sql } from "kysely";
import path from "path";
import { fileURLToPath } from "url";
import { mainDb } from "./connection.js";
import type Redis from "ioredis";
import { DEPLOYMENT, prefixKey } from "../utils/cacheTtl.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function createMainTables() {
  // app_settings
  await mainDb.schema
    .createTable("app_settings")
    .ifNotExists()
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("version", "varchar(50)", (col) => col.notNull())
    .addColumn("updated_at", "timestamptz", (col) => col.notNull())
    .addColumn("updated_by", "varchar(255)", (col) => col.notNull())
    .addColumn("channel", "varchar(50)", (col) =>
      col.notNull().defaultTo("production")
    )
    .execute();

  // roles (must be created before users)
  await mainDb.schema
    .createTable("roles")
    .ifNotExists()
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("name", "varchar(255)", (col) => col.unique().notNull())
    .addColumn("description", "text")
    .addColumn("permissions", "jsonb", (col) => col.notNull())
    .addColumn("color", "varchar(50)")
    .addColumn("icon", "varchar(255)")
    .addColumn("priority", "integer")
    .addColumn("created_at", "timestamptz", (col) => col.defaultTo("now()"))
    .addColumn("updated_at", "timestamptz", (col) => col.defaultTo("now()"))
    .execute();

  // users
  await mainDb.schema
    .createTable("users")
    .ifNotExists()
    .addColumn("id", "varchar(255)", (col) => col.primaryKey())
    .addColumn("username", "varchar(255)", (col) => col.notNull())
    .addColumn("discriminator", "varchar(10)")
    .addColumn("avatar", "text")
    .addColumn("access_token", "text")
    .addColumn("refresh_token", "text")
    .addColumn("last_login", "timestamptz")
    .addColumn("ip_address", "text")
    .addColumn("is_vpn", "boolean")
    .addColumn("last_session_created", "timestamptz")
    .addColumn("last_session_deleted", "timestamptz")
    .addColumn("settings", "jsonb")
    .addColumn("settings_updated_at", "timestamptz")
    .addColumn("total_sessions_created", "integer", (col) => col.defaultTo(0))
    .addColumn("total_minutes", "integer", (col) => col.defaultTo(0))
    .addColumn("vatsim_cid", "varchar(50)")
    .addColumn("vatsim_rating_id", "integer")
    .addColumn("vatsim_rating_short", "varchar(10)")
    .addColumn("vatsim_rating_long", "varchar(255)")
    .addColumn("created_at", "timestamptz", (col) => col.defaultTo("now()"))
    .addColumn("updated_at", "timestamptz", (col) => col.defaultTo("now()"))
    .addColumn("roblox_user_id", "varchar(255)")
    .addColumn("roblox_username", "varchar(255)")
    .addColumn("roblox_access_token", "text")
    .addColumn("roblox_refresh_token", "text")
    .addColumn("role_id", "integer", (col) =>
      col.references("roles.id").onDelete("set null")
    )
    .addColumn("tutorial_completed", "boolean", (col) => col.defaultTo(false))
    .addColumn("statistics", "jsonb")
    .addColumn("fingerprint_id", "varchar(255)")
    .addColumn("ip_hash", "varchar(64)")
    .execute();

  await mainDb.schema
    .createIndex("idx_users_fingerprint_id")
    .ifNotExists()
    .on("users")
    .column("fingerprint_id")
    .execute();

  await mainDb.schema
    .createIndex("idx_users_ip_hash")
    .ifNotExists()
    .on("users")
    .column("ip_hash")
    .execute();

  // sessions
  await mainDb.schema
    .createTable("sessions")
    .ifNotExists()
    .addColumn("session_id", "varchar(255)", (col) => col.primaryKey())
    .addColumn("access_id", "varchar(255)", (col) => col.notNull())
    .addColumn("active_runway", "varchar(10)")
    .addColumn("airport_icao", "varchar(10)", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) => col.defaultTo("now()"))
    .addColumn("created_by", "varchar(255)", (col) =>
      col.notNull().references("users.id").onDelete("cascade")
    )
    .addColumn("is_pfatc", "boolean", (col) => col.defaultTo(false))
    .addColumn("is_advanced_atc", "boolean", (col) => col.defaultTo(false))
    .addColumn("flight_strips", "jsonb")
    .addColumn("atis", "jsonb")
    .addColumn("custom_name", "varchar(255)")
    .addColumn("refreshed_at", "timestamptz")
    .addCheckConstraint(
      "sessions_pfatc_advanced_exclusive",
      sql`NOT (is_pfatc AND is_advanced_atc)`
    )
    .execute();

  await mainDb.schema
    .createIndex("idx_sessions_created_by")
    .ifNotExists()
    .on("sessions")
    .column("created_by")
    .execute();

  await mainDb.schema
    .createIndex("idx_sessions_airport_icao")
    .ifNotExists()
    .on("sessions")
    .column("airport_icao")
    .execute();

  // user_roles
  await mainDb.schema
    .createTable("user_roles")
    .ifNotExists()
    .addColumn("user_id", "varchar(255)", (col) =>
      col.references("users.id").onDelete("cascade")
    )
    .addColumn("role_id", "integer", (col) =>
      col.references("roles.id").onDelete("cascade")
    )
    .addColumn("assigned_at", "timestamptz", (col) => col.defaultTo("now()"))
    .addPrimaryKeyConstraint("user_roles_pkey", ["user_id", "role_id"])
    .execute();

  // audit_log
  await mainDb.schema
    .createTable("audit_log")
    .ifNotExists()
    .addColumn("id", "bigserial", (col) => col.primaryKey())
    .addColumn("admin_id", "varchar(255)", (col) => col.notNull())
    .addColumn("admin_username", "varchar(255)", (col) => col.notNull())
    .addColumn("action_type", "varchar(100)", (col) => col.notNull())
    .addColumn("target_user_id", "varchar(255)")
    .addColumn("target_username", "varchar(255)")
    .addColumn("details", "jsonb")
    .addColumn("ip_address", "text")
    .addColumn("user_agent", "text")
    .addColumn("created_at", "timestamptz", (col) => col.defaultTo("now()"))
    .execute();

  await mainDb.schema
    .createIndex("idx_audit_log_created_at")
    .ifNotExists()
    .on("audit_log")
    .column("created_at")
    .execute();

  // bans
  await mainDb.schema
    .createTable("bans")
    .ifNotExists()
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("user_id", "varchar(255)")
    .addColumn("ip_address", "text")
    .addColumn("username", "varchar(255)")
    .addColumn("reason", "text")
    .addColumn("banned_by", "varchar(255)", (col) => col.notNull())
    .addColumn("banned_at", "timestamptz", (col) => col.defaultTo("now()"))
    .addColumn("expires_at", "timestamptz")
    .addColumn("active", "boolean", (col) => col.defaultTo(true))
    .addColumn("fingerprint_id", "varchar(255)")
    .execute();

  await mainDb.schema
    .createIndex("idx_bans_user_id")
    .ifNotExists()
    .on("bans")
    .column("user_id")
    .execute();

  // notifications
  await mainDb.schema
    .createTable("notifications")
    .ifNotExists()
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("type", "varchar(50)", (col) => col.notNull())
    .addColumn("text", "text", (col) => col.notNull())
    .addColumn("show", "boolean", (col) => col.defaultTo(true))
    .addColumn("custom_color", "varchar(50)")
    .addColumn("created_at", "timestamptz", (col) => col.defaultTo("now()"))
    .addColumn("updated_at", "timestamptz", (col) => col.defaultTo("now()"))
    .execute();

  // user_notifications
  await mainDb.schema
    .createTable("user_notifications")
    .ifNotExists()
    .addColumn("id", "bigserial", (col) => col.primaryKey())
    .addColumn("user_id", "varchar(255)", (col) =>
      col.references("users.id").onDelete("cascade").notNull()
    )
    .addColumn("type", "varchar(50)", (col) => col.notNull())
    .addColumn("title", "varchar(255)", (col) => col.notNull())
    .addColumn("message", "text", (col) => col.notNull())
    .addColumn("read", "boolean", (col) => col.defaultTo(false))
    .addColumn("created_at", "timestamptz", (col) => col.defaultTo("now()"))
    .execute();

  await mainDb.schema
    .createIndex("idx_user_notif_user_id")
    .ifNotExists()
    .on("user_notifications")
    .column("user_id")
    .execute();

  // testers
  await mainDb.schema
    .createTable("testers")
    .ifNotExists()
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("user_id", "varchar(255)", (col) =>
      col.references("users.id").onDelete("cascade").unique().notNull()
    )
    .addColumn("username", "varchar(255)", (col) => col.notNull())
    .addColumn("added_by", "varchar(255)", (col) => col.notNull())
    .addColumn("added_by_username", "varchar(255)", (col) => col.notNull())
    .addColumn("notes", "text")
    .addColumn("created_at", "timestamptz", (col) => col.defaultTo("now()"))
    .addColumn("updated_at", "timestamptz", (col) => col.defaultTo("now()"))
    .execute();

  // tester_settings
  await mainDb.schema
    .createTable("tester_settings")
    .ifNotExists()
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("setting_key", "varchar(255)", (col) => col.unique().notNull())
    .addColumn("setting_value", "boolean", (col) => col.notNull())
    .addColumn("updated_at", "timestamptz", (col) => col.defaultTo("now()"))
    .execute();

  // daily_statistics
  await mainDb.schema
    .createTable("daily_statistics")
    .ifNotExists()
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("date", "date", (col) => col.notNull().unique())
    .addColumn("logins_count", "integer", (col) => col.defaultTo(0))
    .addColumn("new_sessions_count", "integer", (col) => col.defaultTo(0))
    .addColumn("new_flights_count", "integer", (col) => col.defaultTo(0))
    .addColumn("new_users_count", "integer", (col) => col.defaultTo(0))
    .addColumn("created_at", "timestamptz", (col) => col.defaultTo("now()"))
    .addColumn("updated_at", "timestamptz", (col) => col.defaultTo("now()"))
    .execute();

  // chat_report
  await mainDb.schema
    .createTable("chat_report")
    .ifNotExists()
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("session_id", "varchar(255)", (col) => col.notNull())
    .addColumn("message_id", "integer", (col) => col.notNull())
    .addColumn("reporter_user_id", "varchar(255)", (col) => col.notNull())
    .addColumn("reporter_username", "varchar(255)")
    .addColumn("reported_user_id", "varchar(255)", (col) => col.notNull())
    .addColumn("reported_username", "varchar(255)")
    .addColumn("reported_avatar", "varchar(255)")
    .addColumn("reporter_avatar", "varchar(255)")
    .addColumn("message", "text", (col) => col.notNull())
    .addColumn("reason", "text", (col) => col.notNull())
    .addColumn("status", "varchar(50)", (col) => col.defaultTo("pending"))
    .addColumn("created_at", "timestamptz", (col) => col.defaultTo("now()"))
    .execute();

  await mainDb.schema
    .createIndex("idx_chat_report_status")
    .ifNotExists()
    .on("chat_report")
    .column("status")
    .execute();

  // update_modals
  await mainDb.schema
    .createTable("update_modals")
    .ifNotExists()
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("title", "varchar(255)", (col) => col.notNull())
    .addColumn("content", "text", (col) => col.notNull())
    .addColumn("banner_url", "text")
    .addColumn("is_active", "boolean", (col) => col.defaultTo(false).notNull())
    .addColumn("published_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (col) => col.defaultTo("now()"))
    .addColumn("updated_at", "timestamptz", (col) => col.defaultTo("now()"))
    .execute();

  // flight_logs
  await mainDb.schema
    .createTable("flight_logs")
    .ifNotExists()
    .addColumn("id", "bigserial", (col) => col.primaryKey())
    .addColumn("user_id", "varchar(255)", (col) => col.notNull())
    .addColumn("username", "varchar(255)", (col) => col.notNull())
    .addColumn("session_id", "varchar(255)", (col) => col.notNull())
    .addColumn("action", "varchar(50)", (col) => col.notNull())
    .addColumn("flight_id", "varchar(255)", (col) => col.notNull())
    .addColumn("old_data", "jsonb")
    .addColumn("new_data", "jsonb")
    .addColumn("ip_address", "varchar(255)")
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo("now()")
    )
    .execute();

  await mainDb.schema
    .createIndex("idx_flight_logs_session_id")
    .ifNotExists()
    .on("flight_logs")
    .column("session_id")
    .execute();

  await mainDb.schema
    .createIndex("idx_flight_logs_created_at")
    .ifNotExists()
    .on("flight_logs")
    .column("created_at")
    .execute();

  // feedback
  await mainDb.schema
    .createTable("feedback")
    .ifNotExists()
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("user_id", "varchar(255)", (col) => col.notNull())
    .addColumn("username", "varchar(255)", (col) => col.notNull())
    .addColumn("rating", "integer", (col) => col.notNull())
    .addColumn("comment", "text")
    .addColumn("created_at", "timestamptz", (col) => col.defaultTo("now()"))
    .addColumn("updated_at", "timestamptz", (col) => col.defaultTo("now()"))
    .execute();

  // api_logs
  await mainDb.schema
    .createTable("api_logs")
    .ifNotExists()
    .addColumn("id", "bigserial", (col) => col.primaryKey())
    .addColumn("user_id", "varchar(255)")
    .addColumn("username", "varchar(255)")
    .addColumn("method", "varchar(10)", (col) => col.notNull())
    .addColumn("path", "text", (col) => col.notNull())
    .addColumn("status_code", "integer", (col) => col.notNull())
    .addColumn("response_time", "integer", (col) => col.notNull())
    .addColumn("ip_address", "text", (col) => col.notNull())
    .addColumn("user_agent", "text")
    .addColumn("request_body", "text")
    .addColumn("response_body", "text")
    .addColumn("error_message", "text")
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo("now()")
    )
    .execute();

  await mainDb.schema
    .createIndex("idx_api_logs_created_at")
    .ifNotExists()
    .on("api_logs")
    .column("created_at")
    .execute();

  await mainDb.schema
    .createIndex("idx_api_logs_user_id")
    .ifNotExists()
    .on("api_logs")
    .column("user_id")
    .execute();

  await mainDb.schema
    .createIndex("api_logs_path_idx")
    .ifNotExists()
    .on("api_logs")
    .column("path")
    .execute();

  await mainDb.schema
    .createIndex("api_logs_status_code_idx")
    .ifNotExists()
    .on("api_logs")
    .column("status_code")
    .execute();

  // controller_ratings
  await mainDb.schema
    .createTable("controller_ratings")
    .ifNotExists()
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("controller_id", "varchar(255)", (col) => col.notNull())
    .addColumn("pilot_id", "varchar(255)", (col) => col.notNull())
    .addColumn("rating", "integer", (col) => col.notNull())
    .addColumn("flight_id", "varchar(255)")
    .addColumn("created_at", "timestamptz", (col) => col.defaultTo("now()"))
    .execute();

  await mainDb.schema
    .createIndex("idx_ctrl_ratings_controller")
    .ifNotExists()
    .on("controller_ratings")
    .column("controller_id")
    .execute();

  await mainDb.schema
    .createTable("flights")
    .ifNotExists()
    .addColumn("id", "varchar(36)", (col) => col.primaryKey())
    .addColumn("session_id", "varchar(255)", (col) => col.notNull())
    .addColumn("user_id", "varchar(36)")
    .addColumn("ip_address", "varchar(45)")
    .addColumn("callsign", "varchar(16)")
    .addColumn("aircraft", "varchar(16)")
    .addColumn("flight_type", "varchar(16)")
    .addColumn("departure", "varchar(4)")
    .addColumn("arrival", "varchar(4)")
    .addColumn("alternate", "varchar(4)")
    .addColumn("route", "text")
    .addColumn("sid", "varchar(16)")
    .addColumn("star", "varchar(16)")
    .addColumn("runway", "varchar(10)")
    .addColumn("clearedfl", "varchar(8)")
    .addColumn("cruisingfl", "varchar(8)")
    .addColumn("stand", "varchar(8)")
    .addColumn("gate", "varchar(8)")
    .addColumn("remark", "text")
    .addColumn("flight_plan_time", "varchar(32)")
    .addColumn("status", "varchar(16)")
    .addColumn("clearance", "text")
    .addColumn("position", "jsonb")
    .addColumn("squawk", "varchar(8)")
    .addColumn("wtc", "varchar(4)")
    .addColumn("hidden", "boolean", (col) => col.defaultTo(false))
    .addColumn("acars_token", "varchar(64)")
    .addColumn("pdc_remarks", "text")
    .addColumn("created_at", "timestamptz", (col) => col.defaultTo("now()"))
    .addColumn("updated_at", "timestamptz", (col) => col.defaultTo("now()"))
    .execute();

  await mainDb.schema
    .createIndex("idx_flights_session_id")
    .ifNotExists()
    .on("flights")
    .column("session_id")
    .execute();

  await mainDb.schema
    .createIndex("idx_flights_callsign")
    .ifNotExists()
    .on("flights")
    .column("callsign")
    .execute();

  await mainDb.schema
    .createTable("session_chat")
    .ifNotExists()
    .addColumn("id", "bigserial", (col) => col.primaryKey())
    .addColumn("session_id", "varchar(255)", (col) => col.notNull())
    .addColumn("user_id", "varchar(36)", (col) => col.notNull())
    .addColumn("username", "varchar(255)")
    .addColumn("avatar", "varchar(255)")
    .addColumn("message", "text", (col) => col.notNull())
    .addColumn("mentions", "jsonb")
    .addColumn("sent_at", "timestamptz", (col) => col.defaultTo("now()"))
    .execute();

  await mainDb.schema
    .createIndex("idx_session_chat_session_sent")
    .ifNotExists()
    .on("session_chat")
    .columns(["session_id", "sent_at"])
    .execute();

  await mainDb.schema
    .createTable("global_chat")
    .ifNotExists()
    .addColumn("id", "bigserial", (col) => col.primaryKey())
    .addColumn("user_id", "varchar(255)", (col) => col.notNull())
    .addColumn("username", "varchar(255)")
    .addColumn("avatar", "varchar(255)")
    .addColumn("station", "varchar(50)")
    .addColumn("position", "varchar(50)")
    .addColumn("message", "jsonb", (col) => col.notNull())
    .addColumn("airport_mentions", "jsonb")
    .addColumn("user_mentions", "jsonb")
    .addColumn("sent_at", "timestamptz", (col) => col.defaultTo("now()"))
    .addColumn("deleted_at", "timestamptz")
    .addColumn("network_kind", "varchar(20)", (col) =>
      col.defaultTo("pfatc").notNull()
    )
    .execute();

  await mainDb.schema
    .createIndex("global_chat_sent_at_idx")
    .ifNotExists()
    .on("global_chat")
    .column("sent_at")
    .execute();

  // vpn_exceptions
  await mainDb.schema
    .createTable("vpn_exceptions")
    .ifNotExists()
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("user_id", "varchar(255)", (col) =>
      col.references("users.id").onDelete("cascade").unique().notNull()
    )
    .addColumn("username", "varchar(255)", (col) => col.notNull())
    .addColumn("added_by", "varchar(255)", (col) => col.notNull())
    .addColumn("added_by_username", "varchar(255)", (col) => col.notNull())
    .addColumn("notes", "text")
    .addColumn("created_at", "timestamptz", (col) => col.defaultTo("now()"))
    .addColumn("updated_at", "timestamptz", (col) => col.defaultTo("now()"))
    .execute();

  // vpn_gate_settings
  await mainDb.schema
    .createTable("vpn_gate_settings")
    .ifNotExists()
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("setting_key", "varchar(255)", (col) => col.unique().notNull())
    .addColumn("setting_value", "boolean", (col) => col.notNull())
    .addColumn("updated_at", "timestamptz", (col) => col.defaultTo("now()"))
    .execute();

  // developer_applications
  await mainDb.schema
    .createTable("developer_applications")
    .ifNotExists()
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("user_id", "varchar(255)", (col) =>
      col.notNull().references("users.id").onDelete("cascade")
    )
    .addColumn("who_text", "text", (col) => col.notNull())
    .addColumn("why_text", "text", (col) => col.notNull())
    .addColumn("requested_scopes", "jsonb", (col) => col.notNull())
    .addColumn("status", "varchar(32)", (col) =>
      col.notNull().defaultTo("pending")
    )
    .addColumn("reviewed_by", "varchar(255)")
    .addColumn("reviewed_at", "timestamptz")
    .addColumn("reviewer_note", "text")
    .addColumn("approved_scopes", "jsonb")
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo("now()")
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.notNull().defaultTo("now()")
    )
    .execute();

  await mainDb.schema
    .createIndex("idx_developer_applications_user_id")
    .ifNotExists()
    .on("developer_applications")
    .column("user_id")
    .execute();

  await mainDb.schema
    .createIndex("idx_developer_applications_status")
    .ifNotExists()
    .on("developer_applications")
    .column("status")
    .execute();

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_developer_applications_one_pending
    ON developer_applications (user_id)
    WHERE status = 'pending'
  `.execute(mainDb);

  // developer_profiles
  await mainDb.schema
    .createTable("developer_profiles")
    .ifNotExists()
    .addColumn("user_id", "varchar(255)", (col) =>
      col.primaryKey().references("users.id").onDelete("cascade")
    )
    .addColumn("approved_scopes", "jsonb", (col) => col.notNull())
    .addColumn("status", "varchar(32)", (col) =>
      col.notNull().defaultTo("active")
    )
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo("now()")
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.notNull().defaultTo("now()")
    )
    .execute();

  // developer_api_keys
  await mainDb.schema
    .createTable("developer_api_keys")
    .ifNotExists()
    .addColumn("id", "bigserial", (col) => col.primaryKey())
    .addColumn("user_id", "varchar(255)", (col) =>
      col.notNull().references("users.id").onDelete("cascade")
    )
    .addColumn("name", "varchar(255)", (col) => col.notNull())
    .addColumn("prefix", "varchar(64)", (col) => col.notNull())
    .addColumn("secret_hash", "varchar(64)", (col) => col.notNull())
    .addColumn("scopes", "jsonb", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo("now()")
    )
    .addColumn("last_used_at", "timestamptz")
    .addColumn("revoked_at", "timestamptz")
    .execute();

  await mainDb.schema
    .createIndex("idx_developer_api_keys_user_id")
    .ifNotExists()
    .on("developer_api_keys")
    .column("user_id")
    .execute();

  await mainDb.schema
    .createIndex("idx_developer_api_keys_secret_hash")
    .ifNotExists()
    .on("developer_api_keys")
    .column("secret_hash")
    .execute();

  // developer_api_usage
  await mainDb.schema
    .createTable("developer_api_usage")
    .ifNotExists()
    .addColumn("id", "bigserial", (col) => col.primaryKey())
    .addColumn("key_id", "bigint", (col) =>
      col.notNull().references("developer_api_keys.id").onDelete("cascade")
    )
    .addColumn("user_id", "varchar(255)", (col) =>
      col.notNull().references("users.id").onDelete("cascade")
    )
    .addColumn("scope_id", "varchar(128)", (col) => col.notNull())
    .addColumn("method", "varchar(10)", (col) => col.notNull())
    .addColumn("path", "text", (col) => col.notNull())
    .addColumn("status_code", "integer", (col) => col.notNull())
    .addColumn("duration_ms", "integer", (col) => col.notNull())
    .addColumn("ip_hash", "varchar(64)")
    .addColumn("client_ip", "varchar(128)")
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo("now()")
    )
    .execute();

  await mainDb.schema
    .createIndex("idx_developer_api_usage_key_created")
    .ifNotExists()
    .on("developer_api_usage")
    .columns(["key_id", "created_at"])
    .execute();

  await mainDb.schema
    .createIndex("idx_developer_api_usage_user_created")
    .ifNotExists()
    .on("developer_api_usage")
    .columns(["user_id", "created_at"])
    .execute();
}

export async function ensureSessionsAdvancedAtcColumn() {
  await sql`
    ALTER TABLE sessions
    ADD COLUMN IF NOT EXISTS is_advanced_atc boolean NOT NULL DEFAULT false
  `.execute(mainDb);
}

export async function ensureSessionsNetworkFlagsExclusiveConstraint() {
  await sql`
    UPDATE sessions
    SET is_advanced_atc = false
    WHERE is_pfatc IS true AND is_advanced_atc IS true
  `.execute(mainDb);

  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'sessions_pfatc_advanced_exclusive'
      ) THEN
        ALTER TABLE sessions
        ADD CONSTRAINT sessions_pfatc_advanced_exclusive
        CHECK (NOT (is_pfatc AND is_advanced_atc));
      END IF;
    END $$;
  `.execute(mainDb);
}

export async function ensureGlobalChatNetworkKindColumn() {
  await sql`
    ALTER TABLE global_chat
    ADD COLUMN IF NOT EXISTS network_kind varchar(20) NOT NULL DEFAULT 'pfatc'
  `.execute(mainDb);
}

export async function ensureSessionsDeveloperApiKeyColumn() {
  await sql`
    ALTER TABLE sessions
    ADD COLUMN IF NOT EXISTS developer_api_key_id bigint
    REFERENCES developer_api_keys(id) ON DELETE SET NULL
  `.execute(mainDb);

  await mainDb.schema
    .createIndex("idx_sessions_developer_api_key_id")
    .ifNotExists()
    .on("sessions")
    .column("developer_api_key_id")
    .execute();
}

export async function ensureDeveloperApiPolicyColumns() {
  await sql`
    ALTER TABLE developer_profiles
    ADD COLUMN IF NOT EXISTS admin_notice_seq integer NOT NULL DEFAULT 0
  `.execute(mainDb);
  await sql`
    ALTER TABLE developer_profiles
    ADD COLUMN IF NOT EXISTS notice_dismissed_seq integer NOT NULL DEFAULT 0
  `.execute(mainDb);
  await sql`
    ALTER TABLE developer_profiles
    ADD COLUMN IF NOT EXISTS admin_notice_detail text
  `.execute(mainDb);
  await sql`
    ALTER TABLE developer_profiles
    ADD COLUMN IF NOT EXISTS default_rate_limit_per_minute integer
  `.execute(mainDb);
  await sql`
    ALTER TABLE developer_profiles
    ADD COLUMN IF NOT EXISTS notification_email varchar(320)
  `.execute(mainDb);

  await sql`
    ALTER TABLE developer_api_keys
    ADD COLUMN IF NOT EXISTS status varchar(16) NOT NULL DEFAULT 'active'
  `.execute(mainDb);
  await sql`
    ALTER TABLE developer_api_keys
    ADD COLUMN IF NOT EXISTS requested_scopes jsonb
  `.execute(mainDb);
  await sql`
    ALTER TABLE developer_api_keys
    ADD COLUMN IF NOT EXISTS rate_limit_per_minute integer
  `.execute(mainDb);
  await sql`
    ALTER TABLE developer_api_keys
    ADD COLUMN IF NOT EXISTS reviewed_by varchar(255)
  `.execute(mainDb);
  await sql`
    ALTER TABLE developer_api_keys
    ADD COLUMN IF NOT EXISTS reviewed_at timestamptz
  `.execute(mainDb);
  await sql`
    ALTER TABLE developer_api_keys
    ADD COLUMN IF NOT EXISTS reviewer_note text
  `.execute(mainDb);

  await sql`
    ALTER TABLE developer_api_keys
    ALTER COLUMN secret_hash DROP NOT NULL
  `.execute(mainDb);

  await sql`
    UPDATE developer_api_keys SET status = 'active' WHERE status IS NULL OR status = ''
  `.execute(mainDb);

  await sql`
    ALTER TABLE developer_api_usage
    ADD COLUMN IF NOT EXISTS client_ip varchar(128)
  `.execute(mainDb);
}

export async function ensureAppSettingsChannelColumn() {
  await sql`
    ALTER TABLE app_settings
    ADD COLUMN IF NOT EXISTS channel varchar(50) NOT NULL DEFAULT 'production'
  `.execute(mainDb);

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_app_settings_channel ON app_settings (channel)
  `.execute(mainDb);

  // Seed the canary row from the production row if it doesn't exist yet
  await sql`
    INSERT INTO app_settings (version, channel, updated_at, updated_by)
    SELECT version, 'canary', now(), 'system'
    FROM app_settings
    WHERE channel = 'production'
    ON CONFLICT (channel) DO NOTHING
  `.execute(mainDb);
}

export async function ensureEventModeColumns() {
  await sql`
    ALTER TABLE app_settings
    ADD COLUMN IF NOT EXISTS pfatc_event_mode boolean NOT NULL DEFAULT false
  `.execute(mainDb);

  await sql`
    ALTER TABLE app_settings
    ADD COLUMN IF NOT EXISTS aatc_event_mode boolean NOT NULL DEFAULT false
  `.execute(mainDb);
}

export async function ensureFlightReqColumns() {
  await sql`
    ALTER TABLE flights
    ADD COLUMN IF NOT EXISTS req_at timestamptz NULL
  `.execute(mainDb);

  await sql`
    ALTER TABLE flights
    ADD COLUMN IF NOT EXISTS req_phase varchar(4) NULL
  `.execute(mainDb);
}

export async function ensurePerformanceIndexes() {
  await sql`
    CREATE INDEX IF NOT EXISTS idx_flights_session_updated
    ON flights (session_id, updated_at DESC)
  `.execute(mainDb);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_flights_arrival_updated
    ON flights (arrival, updated_at DESC)
  `.execute(mainDb);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_sessions_pfatc_airport
    ON sessions (airport_icao)
    WHERE is_pfatc = true
  `.execute(mainDb);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_sessions_aatc_airport
    ON sessions (airport_icao)
    WHERE is_advanced_atc = true
  `.execute(mainDb);
}

export async function syncVersionFromEnv(redis?: Redis) {
  const envVersion = process.env.APP_VERSION?.trim();
  if (!envVersion) {
    return;
  }

  await mainDb
    .insertInto("app_settings")
    .values({
      version: envVersion,
      channel: DEPLOYMENT,
      updated_at: new Date(),
      updated_by: "system",
    })
    .onConflict((oc) =>
      oc.column("channel").doUpdateSet({
        version: envVersion,
        updated_at: new Date(),
        updated_by: "system",
      })
    )
    .execute();

  if (redis) {
    try {
      await redis.del(prefixKey("app:version"));
    } catch (error) {
      console.warn("[Version] Failed to invalidate version cache:", error);
    }
  }

  console.log(`[Version] Synced channel '${DEPLOYMENT}' to ${envVersion}`);
}