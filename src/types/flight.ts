import type { Position } from './session';

export interface Flight {
  id: string | number;
  session_id: string;
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
  clearedFL?: string;
  cruisingFL?: string;
  stand?: string;
  gate?: string;
  remark?: string;
  timestamp?: string;
  created_at?: string;
  updated_at?: string;
  status?: string;
  clearance?: boolean | string;
  position?: Position;
  squawk?: string;
  wtc?: string;
  animationState?: {
    updatedFields: string[];
    updateTimestamp: number;
  };
  hidden?: boolean;
  acars_token?: string;
  pdc_remarks?: string;
  user?: {
    discord_username?: string;
    discord_avatar_url?: string;
  };
}

export interface AdminFlight extends Flight {
  userId?: string;
  IP_address?: string;
}
