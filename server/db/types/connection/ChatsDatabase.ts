export interface ChatsDatabase {
  // Dynamic schema: each session gets its own chat_{sessionId} table
  [tableName: string]: {
    id: number;
    user_id: string;
    username?: string;
    avatar?: string;
    message: string;
    mentions?: string[];
    sent_at?: Date;
  };
}