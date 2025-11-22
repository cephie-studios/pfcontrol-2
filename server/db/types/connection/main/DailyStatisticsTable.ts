export interface DailyStatisticsTable {
  id: number;
  date: Date;
  logins_count?: number;
  new_sessions_count?: number;
  new_flights_count?: number;
  new_users_count?: number;
  created_at?: Date;
  updated_at?: Date;
}
