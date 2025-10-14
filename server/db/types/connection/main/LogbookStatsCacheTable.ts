export interface LogbookStatsCacheTable {
  user_id: string;
  
  // Totals
  total_flights?: number;
  total_hours?: number;
  total_flight_time_minutes?: number;
  total_distance_nm?: number;
  
  // Favorites
  favorite_aircraft?: string;
  favorite_aircraft_count?: number;
  favorite_airline?: string;
  favorite_airline_count?: number;
  favorite_departure?: string;
  favorite_departure_count?: number;
  
  // Records
  smoothest_landing_rate?: number;
  smoothest_landing_flight_id?: number;
  best_landing_rate?: number;
  average_landing_score?: number;
  highest_altitude?: number;
  longest_flight_distance?: number;
  longest_flight_id?: number;
  
  last_updated?: Date;
}