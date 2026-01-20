export interface ControllerRatingsTable {
  id: number;
  controller_id: string;
  pilot_id: string;
  rating: number;
  flight_id: string | null;
  created_at: Date;
}
