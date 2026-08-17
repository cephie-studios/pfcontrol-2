import type { Generated } from 'kysely';

export interface ControllerRatingsTable {
  id: Generated<number>;
  controller_id: string;
  pilot_id: string;
  rating: number;
  flight_id: string | null;
  session_id: string | null;
  comment: string | null;
  reported: Generated<boolean>;
  report_reason: string | null;
  reported_at: Date | null;
  automod_flagged: Generated<boolean>;
  automod_reason: string | null;
  created_at: Generated<Date>;
}
