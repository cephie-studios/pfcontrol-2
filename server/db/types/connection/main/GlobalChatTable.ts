export interface GlobalChatTable {
  id: number;
  user_id: string;
  username?: string;
  avatar?: string;
  station?: string;
  position?: string;
  message: unknown;
  airport_mentions?: unknown;
  user_mentions?: unknown;
  sent_at?: Date;
  deleted_at?: Date | null;
}
