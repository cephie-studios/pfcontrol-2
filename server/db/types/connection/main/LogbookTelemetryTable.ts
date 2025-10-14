export interface LogbookTelemetryTable {
  id: number;
  flight_id: number;
  
  // Position
  timestamp: Date;
  x?: number;
  y?: number;
  latitude?: number;
  longitude?: number;
  
  // Flight Data
  altitude_ft?: number;
  speed_kts?: number;
  heading?: number;
  vertical_speed_fpm?: number;
  
  // Phase
  flight_phase?: string;
}