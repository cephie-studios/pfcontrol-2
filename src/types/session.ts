export type Position = 'ALL' | 'DEL' | 'GND' | 'TWR' | 'APP';

export interface SessionInfo {
  sessionId: string;
  accessId: string;
  airportIcao: string;
  createdAt: string;
  createdBy: string;
  isPFATC: boolean;
  activeRunway?: string;
  customName?: string;
  isLegacy: boolean;
  flightCount: number;
  atis?: {
    letter: string;
    text: string;
    timestamp: string;
  };
}

export interface SessionUser {
  id: string;
  username: string;
  avatar: string | null;
  joinedAt: number;
  position: Position;
  roles: {
    id: number;
    name: string;
    color: string;
    icon: string;
    priority: number;
  }[];
}

export interface ChatMention {
  id: string;
  userId: string;
  username: string;
  message: string;
  timestamp: number;
  sessionId: string;
}
