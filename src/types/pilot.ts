export interface Role {
    id: number;
    name: string;
    description: string | null;
    color: string;
    icon: string;
    priority: number;
}

export interface PilotProfile {
    user: {
        id: string;
        username: string;
        discriminator: string;
        avatar: string | null;
        roblox_username: string | null;
        roblox_user_id?: string | null;
        vatsim_cid: string | null;
        vatsim_rating_short: string | null;
        vatsim_rating_long: string | null;
        member_since: string;
        is_admin: boolean;
        roles: Role[];
        role_name: string | null;
        role_description: string | null;
    };
    stats: {
        total_flights: number;
        total_hours: number;
        total_flight_time_minutes: number;
        total_distance_nm: number;
        favorite_aircraft: string | null;
        favorite_departure: string | null;
        best_landing_rate: number | null;
        average_landing_score: number | null;
        highest_altitude: number | null;
        longest_flight_distance: number | null;
    };
    recentFlights: Array<{
        id: number;
        callsign: string;
        aircraft_model: string | null;
        aircraft_icao: string | null;
        departure_icao: string;
        arrival_icao: string;
        duration_minutes: number | null;
        total_distance_nm: number | null;
        landing_rate_fpm: number | null;
        flight_end: string;
    }>;
    activityData: Array<{
        month: string;
        flight_count: number;
        total_minutes: number;
    }>;
    privacySettings: {
        displayControllerStatsOnProfile: boolean;
        displayPilotStatsOnProfile: boolean;
        displayLinkedAccountsOnProfile: boolean;
    };
}