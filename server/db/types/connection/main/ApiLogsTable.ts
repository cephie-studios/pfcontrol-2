export interface ApiLogsTable {
  id: number;
  user_id: string | null;
  username: string | null;
  method: string;
  path: string;
  status_code: number;
  response_time: number;
  ip_address: string;
  user_agent: string | null;
  request_body: string | null;
  response_body: string | null;
  error_message: string | null;
  timestamp: Date;
}