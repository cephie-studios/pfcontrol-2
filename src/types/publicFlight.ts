export interface Flight {
    id: string;
    callsign: string;
    departure_icao: string;
    arrival_icao: string;
    aircraft_icao: string;
    aircraft_model: string | null;
    livery: string | null;
    route: string | null;
    flight_status: string;
    controller_status?: string | null;
    duration_minutes: number | null;
    total_distance_nm: number | null;
    max_altitude_ft: number | null;
    max_speed_kts: number | null;
    average_speed_kts: number | null;
    landing_rate_fpm: number | null;
    landing_score: number | null;
    smoothness_score: number | null;
    created_at: string;
    completed_at: string | null;
    flight_start?: string | null;
    discord_username?: string | null;
    discord_discriminator?: string | null;
    roblox_username?: string | null;
    is_active?: boolean;
    current_altitude?: number | null;
    current_speed?: number | null;
    current_heading?: number | null;
    current_phase?: string | null;
    last_update?: string | null;
    landing_detected?: boolean;
    telemetry_count?: number;
}

export interface TelemetryPoint {
    timestamp: string;
    altitude_ft: number;
    speed_kts: number;
    heading: number;
    vertical_speed_fpm: number;
    flight_phase: string;
    x: number;
    y: number;
}