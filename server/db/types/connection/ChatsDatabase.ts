export interface ChatsDatabase {
  global_chat: {
    id: number;
    user_id: string;
    username?: string;
    avatar?: string;
    station?: string;
    position?: string;
    message: string;
    airport_mentions?: string;
    user_mentions?: string;
    sent_at?: Date;
    deleted_at?: Date;
  };
  // Dynamic schema: each session gets its own chat_{sessionId} table
  [tableName: string]: {
    id: number;
    user_id: string;
    username?: string;
    avatar?: string;
    message: string;
    mentions?: string;
    sent_at?: Date;
  };
}
