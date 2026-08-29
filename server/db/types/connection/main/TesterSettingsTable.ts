export interface TesterSettingsTable {
  id: number;
  setting_key: string;
  setting_value: boolean;
  channel: string;
  updated_at?: Date;
}
