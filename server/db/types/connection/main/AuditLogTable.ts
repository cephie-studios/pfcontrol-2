export interface AuditLogTable {
  id: number;
  admin_id: string;
  admin_username: string;
  action_type: string;
  target_user_id?: string;
  target_username?: string;
  details?: object;
  ip_address?: string;
  user_agent?: string;
  timestamp?: Date;
  created_at?: Date;
}
