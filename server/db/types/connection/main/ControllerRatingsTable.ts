import type { Generated } from 'kysely';

export interface ControllerRatingsTable {
  id: Generated<number>;
  controller_id: string;
  pilot_id: string;
  rating: number;
  flight_id: string | null;
  created_at: Generated<Date>;
}