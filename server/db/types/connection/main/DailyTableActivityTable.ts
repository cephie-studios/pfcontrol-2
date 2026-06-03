export interface DailyTableActivityTable {
  activity_date: Date;
  table_name: string;
  rows_inserted: number;
  rows_deleted: number;
  table_bytes: number;
  row_count: number;
  created_at?: Date;
  updated_at?: Date;
}

export interface DailyDatabaseTotalsTable {
  activity_date: Date;
  total_bytes: number;
  created_at?: Date;
}
