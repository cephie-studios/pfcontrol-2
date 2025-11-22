export interface FlightLogsTable {
  id: number;
  user_id: string;
  username: string;
  session_id: string;
  action: 'add' | 'update' | 'delete';
  flight_id: string;
  old_data: object | null;
  new_data: object | null;
  ip_address: string | null;
  timestamp: Date;
}
