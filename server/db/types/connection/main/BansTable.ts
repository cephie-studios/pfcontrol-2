export interface BansTable {
  id: number;
  user_id?: string;
  ip_address?: string;
  username?: string;
  reason?: string;
  banned_by: string;
  banned_at?: Date;
  expires_at?: Date;
  active?: boolean;
}
