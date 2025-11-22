export interface FeedbackTable {
  id: number;
  user_id: string;
  username: string;
  rating: number;
  comment?: string;
  created_at?: Date;
  updated_at?: Date;
}
