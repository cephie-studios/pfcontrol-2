import type { Generated } from 'kysely';

export interface DeveloperApiKeysTable {
  id: Generated<string>;
  user_id: string;
  name: string;
  prefix: string;
  secret_hash: string | null;
  scopes: unknown;
  status: string;
  requested_scopes: unknown | null;
  rate_limit_per_minute: number | null;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  reviewer_note: string | null;
  created_at: Date;
  last_used_at: Date | null;
  revoked_at: Date | null;
}
