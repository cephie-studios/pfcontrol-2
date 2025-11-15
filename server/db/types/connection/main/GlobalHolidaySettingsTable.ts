export interface GlobalHolidaySettingsTable {
  id: number;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
  updated_by: string; // User ID who made the change
}
