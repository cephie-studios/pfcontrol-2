import type { Generated } from 'kysely';

export interface ExternalAcarsProvidersTable {
  id: string;
  display_name: string;
  api_base_url: string;
  token_header: string;
  handoff_url: string;
  handoff_api_key: object | null;
  enabled: boolean;
  is_default: boolean;
  created_by: string | null;
  created_at: Generated<Date>;
  updated_by: string | null;
  updated_at: Generated<Date>;
}
