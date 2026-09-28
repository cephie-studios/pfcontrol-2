import type { Generated } from 'kysely';

export interface SessionClaimReportsTable {
  id: Generated<string>;
  request_id: string;
  session_id: string;
  key_id: string;
  developer_user_id: string;
  requester_name: string;
  attempts_24h: Generated<number>;
  reporter_id: string;
  status: Generated<string>;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  created_at: Generated<Date>;
}
