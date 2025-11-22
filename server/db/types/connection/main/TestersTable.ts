export interface TestersTable {
  id: number;
  user_id: string;
  username: string;
  added_by: string;
  added_by_username: string;
  notes?: string;
  created_at?: Date;
  updated_at?: Date;
}
