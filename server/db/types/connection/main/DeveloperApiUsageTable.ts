import type { Generated } from 'kysely';

export interface DeveloperApiUsageTable {
  id: Generated<string>;
  key_id: string;
  user_id: string;
  scope_id: string;
  method: string;
  path: string;
  status_code: number;
  duration_ms: number;
  ip_hash: string | null;
  client_ip: string | null;
  created_at: Date;
}
