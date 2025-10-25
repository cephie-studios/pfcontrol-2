import io from 'socket.io-client';
import type { ChatMessage, ChatMention } from '../types/chats';

const SOCKET_URL = import.meta.env.VITE_SERVER_URL;

export function createChatSocket(
    sessionId: string,
    accessId: string,
    userId: string,
    onMessage: (msg: ChatMessage) => void,
    onMessageDeleted?: (data: { messageId: number }) => void,
    onDeleteError?: (data: { messageId: number; error: string }) => void,
    onActiveChatUsers?: (users: string[]) => void,
    onMention?: (mention: ChatMention) => void,
    onMessageAutomodded?: (data: { messageId: number }) => void
) {
    const socket = io(SOCKET_URL, {
        withCredentials: true,
        path: '/sockets/chat',
        query: { sessionId, accessId, userId },
        transports: ['websocket', 'polling'],
        upgrade: true,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
        timeout: 10000
    });
    socket.emit('joinSession', sessionId);

    socket.on('chatMessage', onMessage);
    
    if (onMessageDeleted) {
        socket.on('messageDeleted', onMessageDeleted);
    }

    if (onDeleteError) {
        socket.on('deleteError', onDeleteError);
    }

    if (onActiveChatUsers) {
        socket.on('activeChatUsers', onActiveChatUsers);
    }

    if (onMention) {
        socket.on('mention', onMention);
    }

    if (onMessageAutomodded) {
        socket.on('messageAutomodded', onMessageAutomodded);
    }

    return {
        socket,
        deleteMessage: (messageId: number, userId: string) => {
            socket.emit('deleteMessage', { messageId, userId });
        }
    };
}