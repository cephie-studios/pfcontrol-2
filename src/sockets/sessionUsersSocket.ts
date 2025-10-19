import { io, Socket } from 'socket.io-client';
import type { SessionUser } from '../types/session';
import type { ChatMention } from '../types/session';

const SOCKET_URL = import.meta.env.VITE_SERVER_URL;

export interface FieldEditingState {
    userId: string;
    username: string;
    avatar: string | null;
    flightId: string | number;
    fieldName: string;
    timestamp: number;
}

interface CustomSocket extends Socket {
    emitAtisGenerated?: (data: unknown) => void;
    emitFieldEditingStart?: (flightId: string | number, fieldName: string) => void;
    emitFieldEditingStop?: (flightId: string | number, fieldName: string) => void;
    emitPositionChange?: (position: string) => void;
}

export function createSessionUsersSocket(
    sessionId: string,
    accessId: string,
    user: { userId: string; username: string; avatar: string | null },
    onUsersUpdate: (users: SessionUser[]) => void,
    onConnect?: () => void,
    onDisconnect?: () => void,
    onReconnecting?: () => void,
    onReconnect?: () => void,
    onMention?: (mention: ChatMention) => void,
    onFieldEditingUpdate?: (editingStates: FieldEditingState[]) => void,
    position?: string
) {
    const socket = io(SOCKET_URL, {
        withCredentials: true,
        path: '/sockets/session-users',
        query: {
            sessionId,
            accessId,
            user: JSON.stringify(user),
            position: position || 'APP'
        },
        transports: ['websocket', 'polling'],
        upgrade: true,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
        timeout: 10000
    }) as CustomSocket;

    if (onConnect) {
        socket.on('connect', onConnect);
    }
    if (onDisconnect) {
        socket.on('disconnect', onDisconnect);
    }
    if (onReconnecting) {
        socket.on('reconnecting', onReconnecting);
    }
    if (onReconnect) {
        socket.on('reconnect', onReconnect);
    }
    
    socket.on('sessionUsersUpdate', onUsersUpdate);
    
    if (onMention) {
        socket.on('chatMention', onMention);
    }

    if (onFieldEditingUpdate) {
        socket.on('fieldEditingUpdate', onFieldEditingUpdate);
    }

    socket.emitAtisGenerated = (data: unknown) => {
        socket.emit('atisGenerated', data);
    };

    socket.emitFieldEditingStart = (flightId: string | number, fieldName: string) => {
        socket.emit('fieldEditingStart', { flightId, fieldName });
    };

    socket.emitFieldEditingStop = (flightId: string | number, fieldName: string) => {
        socket.emit('fieldEditingStop', { flightId, fieldName });
    };

    socket.emitPositionChange = (position: string) => {
        socket.emit('positionChange', { position });
    };

    let activityTimer: NodeJS.Timeout;
    const sendActivityPing = () => socket.emit('activityPing');
    document.addEventListener('mousemove', () => {
      clearTimeout(activityTimer);
      activityTimer = setTimeout(sendActivityPing, 1000);
    });
    document.addEventListener('keydown', () => {
      clearTimeout(activityTimer);
      activityTimer = setTimeout(sendActivityPing, 1000);
    });

    return socket;
}