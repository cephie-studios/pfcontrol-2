import { redisConnection } from '../db/connection.js';
import { getChatMessagesFromDb } from '../db/chats.js';
import { keys, TTL } from './keys.js';
import { perfAsync } from './perf.js';

const CHAT_RECENT_LIMIT = 100;

export type CachedChatMessage = Awaited<
  ReturnType<typeof getChatMessagesFromDb>
>[number];

export async function getCachedSessionChatMessages(
  sessionId: string,
  limit = 50
): Promise<CachedChatMessage[]> {
  const cacheKey = keys.chatRecent(sessionId);
  try {
    const cached = await redisConnection.get(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached) as CachedChatMessage[];
      return parsed.slice(-limit);
    }
  } catch {
    // ignore
  }

  return perfAsync(
    'getChatMessages',
    async () => {
      const messages = await getChatMessagesFromDb(sessionId, limit);
      try {
        await redisConnection.setex(
          cacheKey,
          TTL.CHAT_RECENT_SEC,
          JSON.stringify(messages.slice(-CHAT_RECENT_LIMIT))
        );
      } catch {
        // ignore
      }
      return messages;
    },
    { sessionId }
  );
}

export async function pushSessionChatMessage(
  sessionId: string,
  message: CachedChatMessage
): Promise<void> {
  const cacheKey = keys.chatRecent(sessionId);
  try {
    const cached = await redisConnection.get(cacheKey);
    const list: CachedChatMessage[] = cached ? JSON.parse(cached) : [];
    list.push(message);
    const trimmed = list.slice(-CHAT_RECENT_LIMIT);
    await redisConnection.setex(
      cacheKey,
      TTL.CHAT_RECENT_SEC,
      JSON.stringify(trimmed)
    );
  } catch {
    // ignore
  }
}

export async function invalidateSessionChatCache(
  sessionId: string
): Promise<void> {
  try {
    await redisConnection.del(keys.chatRecent(sessionId));
  } catch {
    // ignore
  }
}

export type GlobalChatMessageDto = {
  id: number;
  userId: string;
  username: string | null;
  avatar: string | null;
  station: string | null;
  position: string | null;
  message: string;
  airportMentions: unknown;
  userMentions: unknown;
  sent_at: Date | null;
};

export async function getCachedGlobalChatMessages(
  networkKind: 'pfatc' | 'aatc',
  loader: () => Promise<GlobalChatMessageDto[]>
): Promise<GlobalChatMessageDto[]> {
  const cacheKey = keys.chatGlobal(networkKind);
  try {
    const cached = await redisConnection.get(cacheKey);
    if (cached) return JSON.parse(cached) as GlobalChatMessageDto[];
  } catch {
    // ignore
  }

  const messages = await loader();
  try {
    await redisConnection.setex(
      cacheKey,
      TTL.CHAT_RECENT_SEC,
      JSON.stringify(messages)
    );
  } catch {
    // ignore
  }
  return messages;
}

export async function invalidateGlobalChatCache(
  networkKind: 'pfatc' | 'aatc'
): Promise<void> {
  try {
    await redisConnection.del(keys.chatGlobal(networkKind));
  } catch {
    // ignore
  }
}
