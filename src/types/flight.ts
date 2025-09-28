import type { Position } from "./session";

export interface Flight {
    id: string | number;
    session_id?: string;
    callsign?: string;
    aircraft?: string;
    aircraft_type?: string;
    flightType?: string;
    flight_type?: string;
    departure?: string;
    arrival?: string;
    alternate?: string;
    route?: string;
    sid?: string;
    star?: string;
    runway?: string;
    clearedFL?: string;
    cfl?: string;
    cruisingFL?: string;
    rfl?: string;
    stand?: string;
    remark?: string;
    timestamp?: string;
    created_at?: string;
    updated_at?: string;
    status?: string;
    clearance?: boolean | string;
    position?: Position;
    squawk?: string;
    wtc?: string;
    userId?: string;
    IP_address?: string;
    animationState?: {
        updatedFields: string[];
        updateTimestamp: number;
    };
}