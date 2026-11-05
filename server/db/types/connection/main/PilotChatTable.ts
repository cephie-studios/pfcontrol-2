export interface PilotChatTable {
  id: number;
  session_id: string;
  flight_id: string;
  sender: 'pilot' | 'atc';
  user_id: string;
  username?: string;
  avatar?: string;
  station?: string | null;
  callsign?: string | null;
  message: string;
  blocked?: boolean;
  sent_at?: Date;
}
