export interface SessionsTable {
  session_id: string;
  access_id: string;
  active_runway?: string;
  airport_icao: string;
  created_at?: Date;
  created_by: string;
  is_pfatc?: boolean;
  flight_strips?: string;
  atis?: string;
  custom_name?: string;
  refreshed_at?: Date;
}