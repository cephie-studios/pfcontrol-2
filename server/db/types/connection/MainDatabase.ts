import { AppSettingsTable } from "./main/AppSettingsTable";
import { UsersTable } from "./main/UsersTable";
import { SessionsTable } from "./main/SessionsTable";
import { RolesTable } from "./main/RolesTable";
import { UserRolesTable } from "./main/UserRolesTable";
import { AuditLogTable } from "./main/AuditLogTable";
import { BansTable } from "./main/BansTable";
import { NotificationsTable } from "./main/NotificationsTable";
import { UserNotificationsTable } from "./main/UserNotificationsTable";
import { TestersTable } from "./main/TestersTable";
import { TesterSettingsTable } from "./main/TesterSettingsTable";
import { DailyStatisticsTable } from "./main/DailyStatisticsTable";

export interface MainDatabase {
  app_settings: AppSettingsTable;
  users: UsersTable;
  sessions: SessionsTable;
  roles: RolesTable;
  user_roles: UserRolesTable
  audit_log: AuditLogTable;
  bans: BansTable;
  notifications: NotificationsTable;
  user_notifications: UserNotificationsTable;
  testers: TestersTable;
  tester_settings: TesterSettingsTable;
  daily_statistics: DailyStatisticsTable;
}