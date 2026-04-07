export interface SessionChatTable {
  id: number;
  session_id: string;
  user_id: string;
  username?: string;
  avatar?: string;
  message: string;
  mentions?: unknown;
  sent_at?: Date;
}
