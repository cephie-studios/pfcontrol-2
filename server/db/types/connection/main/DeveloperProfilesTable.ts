export interface DeveloperProfilesTable {
  user_id: string;
  approved_scopes: unknown;
  status: string;
  admin_notice_seq: number;
  notice_dismissed_seq: number;
  admin_notice_detail: string | null;
  default_rate_limit_per_minute: number | null;
  created_at: Date;
  updated_at: Date;
}