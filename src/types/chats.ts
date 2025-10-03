export interface ChatMessage {
    id: number;
    userId: string;
    username: string;
    avatar?: string;
    message: string;
    sent_at: string;
    mentions?: string[];
}

export interface ChatMention {
    messageId: number;
    mentionedUserId: string;
    mentionerUsername: string;
    message: string;
    sessionId: string;
    timestamp: string;
}