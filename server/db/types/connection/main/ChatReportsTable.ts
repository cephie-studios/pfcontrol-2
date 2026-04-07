export interface ChatReportsTable {
  id: number;
  session_id: string;
  message_id: number;
  reporter_user_id: string;
  reported_user_id: string;
  message: string;
  reason: string;
  created_at?: Date;
  status?: 'pending' | 'resolved';
  reporter_avatar?: string;
  reported_username?: string;
  reporter_username?: string;
  reported_avatar?: string;
}
