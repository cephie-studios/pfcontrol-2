import { chatsDb } from './connection.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import { validateSessionId } from '../utils/validation.js';
import { incrementStat } from '../utils/statisticsCache.js';
import { mainDb } from './connection.js';
import {
  containsHateSpeech,
  getHateSpeechReason,
} from '../utils/hateSpeechFilter.js';
import { sql } from 'kysely';

export async function ensureChatTable(sessionId: string) {
  const validSessionId = validateSessionId(sessionId);
  const tableName = `chat_${validSessionId}`;
  await chatsDb.schema
    .createTable(tableName)
    .ifNotExists()
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('user_id', 'varchar(20)', (col) => col.notNull())
    .addColumn('username', 'varchar(32)')
    .addColumn('avatar', 'varchar(128)')
    .addColumn('message', 'text', (col) => col.notNull())
    .addColumn('mentions', 'jsonb')
    .addColumn('sent_at', 'timestamp', (col) => col.defaultTo('now()'))
    .execute();
}

export async function addChatMessage(
  sessionId: string,
  {
    userId,
    username,
    avatar,
    message,
    mentions = [],
  }: {
    userId: string;
    username: string;
    avatar: string;
    message: string;
    mentions?: string[];
  }
) {
  const validSessionId = validateSessionId(sessionId);
  await ensureChatTable(validSessionId);
  const encryptedMsg = encrypt(message);
  if (!encryptedMsg) {
    throw new Error('Encryption failed for chat message.');
  }

  if (
    !Array.isArray(mentions) ||
    !mentions.every((m) => typeof m === 'string')
  ) {
    throw new Error('Invalid mentions format: must be an array of strings');
  }

  const tableName = `chat_${validSessionId}`;
  const result = await chatsDb
    .insertInto(tableName)
    .values({
      id: sql`DEFAULT`,
      user_id: String(userId),
      username,
      avatar,
      message: JSON.stringify(encryptedMsg),
      mentions: JSON.stringify(mentions),
    })
    .returningAll()
    .executeTakeFirst();

  incrementStat(userId, 'total_chat_messages_sent');

  let automodded = false;
  let automodReason: string | undefined = undefined;
  if (containsHateSpeech(message)) {
    automodded = true;
    const hateSpeechReason = getHateSpeechReason(message);
    automodReason = hateSpeechReason;
    await mainDb
      .insertInto('chat_report')
      .values({
        id: sql`DEFAULT`,
        session_id: validSessionId,
        message_id: result!.id,
        reporter_user_id: 'automod',
        reporter_username: 'Automod',
        reported_user_id: userId,
        reported_username: username,
        reported_avatar: avatar || '/assets/app/default/avatar.webp',
        message,
        reason: `${hateSpeechReason} (automod)`,
        avatar: '/assets/images/automod.webp',
      })
      .execute();
  }

  return { ...result, message, mentions, automodded, automodReason };
}

export async function getChatMessages(sessionId: string, limit = 50) {
  const validSessionId = validateSessionId(sessionId);
  await ensureChatTable(validSessionId);
  const tableName = `chat_${validSessionId}`;
  const rows = await chatsDb
    .selectFrom(tableName)
    .selectAll()
    .orderBy('sent_at', 'asc')
    .limit(limit)
    .execute();

  return rows.map((row) => {
    let decryptedMsg = '';
    try {
      if (row.message) {
        decryptedMsg = decrypt(JSON.parse(row.message));
      }
    } catch {
      decryptedMsg = '';
    }
    let parsedMentions: string[] = [];
    if (row.mentions) {
      if (typeof row.mentions === 'string') {
        try {
          const parsed = JSON.parse(row.mentions);
          if (Array.isArray(parsed)) {
            parsedMentions = parsed;
          } else {
            parsedMentions = [];
          }
        } catch {
          const trimmed = row.mentions.trim();
          if (trimmed) {
            parsedMentions = trimmed
              .split(',')
              .map((s) => s.trim())
              .filter((s) => s);
          }
        }
      } else if (Array.isArray(row.mentions)) {
        parsedMentions = row.mentions;
      }
    }
    return {
      id: row.id,
      userId: row.user_id,
      username: row.username,
      avatar: row.avatar,
      message: decryptedMsg || '',
      mentions: parsedMentions,
      sent_at: row.sent_at,
    };
  });
}

export async function deleteChatMessage(
  sessionId: string,
  messageId: number,
  userId: string
) {
  const validSessionId = validateSessionId(sessionId);
  await ensureChatTable(validSessionId);
  const tableName = `chat_${validSessionId}`;
  const result = await chatsDb
    .deleteFrom(tableName)
    .where('id', '=', messageId)
    .where('user_id', '=', userId)
    .executeTakeFirst();
  return (result?.numDeletedRows ?? 0) > 0;
}

export async function reportChatMessage(
  sessionId: string,
  messageId: number,
  reporterUserId: string,
  reason: string
) {
  const validSessionId = validateSessionId(sessionId);
  await ensureChatTable(validSessionId);
  const tableName = `chat_${validSessionId}`;

  const messageRow = await chatsDb
    .selectFrom(tableName)
    .select(['user_id', 'message'])
    .where('id', '=', messageId)
    .executeTakeFirst();

  if (!messageRow) {
    throw new Error('Message not found');
  }

  let plainMessage = '';
  try {
    plainMessage = decrypt(JSON.parse(messageRow.message));
  } catch {
    plainMessage = '';
  }

  let reporterUsername = '';
  let reporterAvatar = '/assets/images/automod.webp';
  if (reporterUserId !== 'automod') {
    const reporter = await mainDb
      .selectFrom('users')
      .select(['username', 'avatar'])
      .where('id', '=', reporterUserId)
      .executeTakeFirst();
    reporterUsername = reporter?.username || '';
    reporterAvatar = reporter?.avatar
      ? reporter.avatar.startsWith('http')
        ? reporter.avatar
        : `https://cdn.discordapp.com/avatars/${reporterUserId}/${reporter.avatar}.png`
      : '/assets/app/default/avatar.webp';
  }

  let reportedUsername = '';
  let reportedAvatar = '/assets/app/default/avatar.webp';
  const reportedUser = await mainDb
    .selectFrom('users')
    .select(['username', 'avatar'])
    .where('id', '=', messageRow.user_id)
    .executeTakeFirst();
  reportedUsername = reportedUser?.username || '';
  reportedAvatar = reportedUser?.avatar
    ? reportedUser.avatar.startsWith('http')
      ? reportedUser.avatar
      : `https://cdn.discordapp.com/avatars/${messageRow.user_id}/${reportedUser.avatar}.png`
    : '/assets/app/default/avatar.webp';

  await mainDb
    .insertInto('chat_report')
    .values({
      id: sql`DEFAULT`,
      session_id: validSessionId,
      message_id: messageId,
      reporter_user_id: reporterUserId,
      reporter_username: reporterUsername,
      reported_user_id: messageRow.user_id,
      reported_username: reportedUsername,
      reported_avatar: reportedAvatar,
      message: plainMessage,
      reason,
      avatar: reporterAvatar,
    })
    .execute();
}

export async function reportGlobalChatMessage(
  messageId: number,
  reporterUserId: string,
  reason: string
) {
  const messageRow = await chatsDb
    .selectFrom('global_chat')
    .select(['user_id', 'message'])
    .where('id', '=', messageId)
    .executeTakeFirst();

  if (!messageRow) {
    throw new Error('Message not found');
  }

  let plainMessage = '';
  try {
    if (messageRow.message) {
      const encryptedData =
        typeof messageRow.message === 'string'
          ? JSON.parse(messageRow.message)
          : messageRow.message;
      plainMessage = decrypt(encryptedData) || '';
    }
  } catch (e) {
    console.error('[Report Global Chat] Error decrypting message:', e);
    plainMessage = '';
  }

  let reporterUsername = '';
  let reporterAvatar = '/assets/images/automod.webp';
  if (reporterUserId !== 'automod') {
    const reporter = await mainDb
      .selectFrom('users')
      .select(['username', 'avatar'])
      .where('id', '=', reporterUserId)
      .executeTakeFirst();
    reporterUsername = reporter?.username || '';
    reporterAvatar = reporter?.avatar
      ? reporter.avatar.startsWith('http')
        ? reporter.avatar
        : `https://cdn.discordapp.com/avatars/${reporterUserId}/${reporter.avatar}.png`
      : '/assets/app/default/avatar.webp';
  }

  let reportedUsername = '';
  let reportedAvatar = '/assets/app/default/avatar.webp';
  const reportedUser = await mainDb
    .selectFrom('users')
    .select(['username', 'avatar'])
    .where('id', '=', messageRow.user_id)
    .executeTakeFirst();
  reportedUsername = reportedUser?.username || '';
  reportedAvatar = reportedUser?.avatar
    ? reportedUser.avatar.startsWith('http')
      ? reportedUser.avatar
      : `https://cdn.discordapp.com/avatars/${messageRow.user_id}/${reportedUser.avatar}.png`
    : '/assets/app/default/avatar.webp';

  await mainDb
    .insertInto('chat_report')
    .values({
      id: sql`DEFAULT`,
      session_id: 'global-chat',
      message_id: messageId,
      reporter_user_id: reporterUserId,
      reporter_username: reporterUsername,
      reported_user_id: messageRow.user_id,
      reported_username: reportedUsername,
      reported_avatar: reportedAvatar,
      message: plainMessage,
      reason,
      avatar: reporterAvatar,
    })
    .execute();
}
