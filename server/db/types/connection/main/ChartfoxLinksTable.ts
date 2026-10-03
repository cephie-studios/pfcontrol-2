export interface ChartfoxLinksTable {
  user_id: string;
  chartfox_user_id: number | null;
  chartfox_name: string | null;
  access_token: string;
  refresh_token: string | null;
  expires_at: Date;
  scopes: string | null;
  created_at?: Date;
  updated_at?: Date;
}
