export interface LogbookActiveFlightsTable {
  id: number;
  roblox_username: string;
  callsign?: string;
  flight_id?: number;
  
  // Current state
  last_update?: Date;
  last_altitude?: number;
  last_speed?: number;
  last_heading?: number;
  last_x?: number;
  last_y?: number;
  
  // Flight phase tracking
  current_phase?: string;
  takeoff_detected?: boolean;
  landing_detected?: boolean;
  
  // Departure detection
  initial_position_x?: number;
  initial_position_y?: number;
  initial_position_time?: Date;
  movement_started?: boolean;
  movement_start_time?: Date;
  
  // Arrival detection
  stationary_since?: Date;
  stationary_position_x?: number;
  stationary_position_y?: number;
  stationary_notification_sent?: boolean;
  
  // For landing rate calculation
  approach_altitudes?: number[];
  approach_timestamps?: Date[];
  
  // Waypoint data collection
  collected_waypoints?: object;
  
  created_at?: Date;
}