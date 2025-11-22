import { AppSettingsTable } from './main/AppSettingsTable';
import { UsersTable } from './main/UsersTable';
import { SessionsTable } from './main/SessionsTable';
import { RolesTable } from './main/RolesTable';
import { UserRolesTable } from './main/UserRolesTable';
import { AuditLogTable } from './main/AuditLogTable';
import { BansTable } from './main/BansTable';
import { NotificationsTable } from './main/NotificationsTable';
import { UserNotificationsTable } from './main/UserNotificationsTable';
import { TestersTable } from './main/TestersTable';
import { TesterSettingsTable } from './main/TesterSettingsTable';
import { DailyStatisticsTable } from './main/DailyStatisticsTable';
import { ChatReportsTable } from './main/ChatReportsTable';
import { UpdateModalsTable } from './main/UpdateModalsTable';
import { FlightLogsTable } from './main/FlightLogsTable';
import { FeedbackTable } from './main/FeedbackTable';
import { ApiLogsTable } from './main/ApiLogsTable';

export interface MainDatabase {
  app_settings: AppSettingsTable;
  users: UsersTable;
  sessions: SessionsTable;
  roles: RolesTable;
  user_roles: UserRolesTable;
  audit_log: AuditLogTable;
  bans: BansTable;
  notifications: NotificationsTable;
  user_notifications: UserNotificationsTable;
  testers: TestersTable;
  tester_settings: TesterSettingsTable;
  daily_statistics: DailyStatisticsTable;
  chat_report: ChatReportsTable;
  update_modals: UpdateModalsTable;
  flight_logs: FlightLogsTable;
  feedback: FeedbackTable;
  api_logs: ApiLogsTable;
}
