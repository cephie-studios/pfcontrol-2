export interface NotificationsTable {
  id: number;
  type: string;
  text: string;
  show?: boolean;
  custom_color?: string;
  created_at?: Date;
  updated_at?: Date;
}