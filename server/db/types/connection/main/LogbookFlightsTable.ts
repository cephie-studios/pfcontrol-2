export interface LogbookFlightsTable {
  id: number;
  user_id: string;
  roblox_user_id?: string;
  roblox_username: string;
  
  // Flight Info
  callsign: string;
  aircraft_model?: string;
  aircraft_icao?: string;
  livery?: string;
  
  // Route
  departure_icao?: string;
  arrival_icao?: string;
  route?: string;
  
  // Timestamps
  flight_start?: Date;
  flight_end?: Date;
  duration_minutes?: number;
  
  // Stats
  total_distance_nm?: number;
  max_altitude_ft?: number;
  max_speed_kts?: number;
  average_speed_kts?: number;
  landing_rate_fpm?: number;
  landing_g_force?: number;
  
  // Quality Scores (0-100)
  smoothness_score?: number;
  landing_score?: number;
  route_adherence_score?: number;
  
  // State
  flight_status?: string;
  controller_status?: string;
  logged_from_submit?: boolean;
  controller_managed?: boolean;
  
  // Parking/Gate Detection
  departure_position_x?: number;
  departure_position_y?: number;
  arrival_position_x?: number;
  arrival_position_y?: number;
  
  // State change timestamps
  activated_at?: Date;
  landed_at?: Date;
  
  // Landing waypoint data
  landed_runway?: string;
  landed_airport?: string;
  waypoint_landing_rate?: number;
  
  // Sharing
  share_token?: string;
  
  created_at?: Date;
}