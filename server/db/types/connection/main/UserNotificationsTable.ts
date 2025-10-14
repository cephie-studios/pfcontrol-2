export interface UserNotificationsTable {
  id: number;
  user_id: string;
  type: string;
  title: string;
  message: string;
  read?: boolean;
  created_at?: Date;
}