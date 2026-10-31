import { Generated } from 'kysely';

export interface AppSettingsTable {
  id: Generated<number>;
  version: string;
  updated_at: Date;
  updated_by: string;
  channel: string;
  pfatc_event_mode: boolean | null;
  aatc_event_mode: boolean | null;
  feedback_banner_enabled: Generated<boolean>;
  external_acars_legacy_redirect: Generated<boolean>;
}
