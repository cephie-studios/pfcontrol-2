import io from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SERVER_URL;

export interface GlobalChatMessage {
  id: number;
  userId: string;
  username: string | null;
  avatar: string | null;
  station: string | null;
  position: string | null;
  message: string;
  airportMentions: string[] | null;
  userMentions: string[] | null;
  sent_at: Date;
  automodded?: boolean;
}

export interface GlobalChatMention {
  messageId: string;
  mentionedUserId: string;
  mentionerUsername: string;
  message: string;
  timestamp: string;
  airport?: string;
}

export interface ConnectedGlobalChatUser {
  id: string;
  username: string;
  avatar: string | null;
  station: string | null;
  position: string | null;
}

export function createGlobalChatSocket(
  userId: string,
  station: string | null,
  position: string | null,
  onMessage: (msg: GlobalChatMessage) => void,
  onMessageDeleted?: (data: { messageId: number }) => void,
  onDeleteError?: (data: { messageId: number; error: string }) => void,
  onActiveGlobalChatUsers?: (users: string[]) => void,
  onMessageAutomodded?: (data: { messageId: number; reason: string }) => void,
  onMention?: (mention: GlobalChatMention) => void,
  onAirportMention?: (mention: GlobalChatMention) => void,
  onConnectedGlobalChatUsers?: (users: ConnectedGlobalChatUser[]) => void
) {
  const socket = io(SOCKET_URL, {
    withCredentials: true,
    path: '/sockets/global-chat',
    query: {
      userId,
      station: station || '',
      position: position || '',
    },
    transports: ['websocket', 'polling'],
    upgrade: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
    timeout: 10000,
  });

  socket.on('globalChatMessage', onMessage);

  if (onMessageDeleted) {
    socket.on('globalMessageDeleted', onMessageDeleted);
  }

  if (onDeleteError) {
    socket.on('deleteError', onDeleteError);
  }

  if (onActiveGlobalChatUsers) {
    socket.on('activeGlobalChatUsers', onActiveGlobalChatUsers);
  }

  if (onMessageAutomodded) {
    socket.on('messageAutomodded', onMessageAutomodded);
  }

  if (onMention) {
    socket.on('globalChatMention', onMention);
  }

  if (onAirportMention) {
    socket.on('airportMention', onAirportMention);
  }

  if (onConnectedGlobalChatUsers) {
    socket.on('connectedGlobalChatUsers', onConnectedGlobalChatUsers);
  }

  return {
    socket,
    deleteMessage: (messageId: number, userId: string) => {
      socket.emit('deleteGlobalMessage', { messageId, userId });
    },
  };
}
