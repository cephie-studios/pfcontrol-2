import type { Generated } from 'kysely';

export interface UserNotificationsTable {
  id: Generated<number>;
  user_id: string;
  type: string;
  title: string;
  message: string;
  read?: boolean;
  created_at?: Date;
}
