export interface FlightsDatabase {
  // Dynamic schema: each session gets its own flights_{sessionId} table
  [tableName: string]: {
    id: string;
    session_id: string;
    user_id?: string;
    ip_address?: string;
    callsign?: string;
    aircraft?: string;
    flight_type?: string;
    departure?: string;
    arrival?: string;
    alternate?: string;
    route?: string;
    sid?: string;
    star?: string;
    runway?: string;
    clearedfl?: string;
    cruisingfl?: string;
    stand?: string;
    gate?: string;
    remark?: string;
    timestamp?: string;
    created_at?: Date;
    updated_at?: Date;
    status?: string;
    clearance?: string;
    position?: object;
    squawk?: string;
    wtc?: string;
    hidden?: boolean;
    acars_token?: string;
    pdc_remarks?: string;
  };
}