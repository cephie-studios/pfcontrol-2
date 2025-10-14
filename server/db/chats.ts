import { chatsDb } from "./connection";
import { encrypt, decrypt } from "../utils/encryption";
import { validateSessionId } from "../utils/validation";
import { sql } from "kysely";

export async function ensureChatTable(sessionId: string) {
  const validSessionId = validateSessionId(sessionId);
  const tableName = `chat_${validSessionId}`;
  await chatsDb.schema
    .createTable(tableName)
    .ifNotExists()
    .addColumn("id", "serial", col => col.primaryKey())
    .addColumn("user_id", "varchar(20)", col => col.notNull())
    .addColumn("username", "varchar(32)")
    .addColumn("avatar", "varchar(128)")
    .addColumn("message", "text", col => col.notNull())
    .addColumn("mentions", "jsonb")
    .addColumn("sent_at", "timestamp", col => col.defaultTo('CURRENT_TIMESTAMP'))
    .execute();
}

export async function addChatMessage(sessionId: string, { userId, username, avatar, message, mentions = [] }: { userId: string, username: string, avatar: string, message: string, mentions?: string[] }) {
  const validSessionId = validateSessionId(sessionId);
  await ensureChatTable(validSessionId);
  const encryptedMsg = encrypt(message);
  if (!encryptedMsg) {
    throw new Error("Encryption failed for chat message.");
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
      mentions
    })
    .returningAll()
    .executeTakeFirst();

  return { ...result, message, mentions };
}

export async function getChatMessages(sessionId: string, limit = 50) {
  const validSessionId = validateSessionId(sessionId);
  await ensureChatTable(validSessionId);
  const tableName = `chat_${validSessionId}`;
  const rows = await chatsDb
    .selectFrom(tableName)
    .selectAll()
    .orderBy('sent_at', 'desc')
    .limit(limit)
    .execute();

  return rows
    .map(row => {
      let decryptedMsg = '';
      try {
        if (row.message) {
          decryptedMsg = decrypt(JSON.parse(row.message));
        }
      } catch {
        decryptedMsg = '';
      }
      return {
        id: row.id,
        userId: row.user_id,
        username: row.username,
        avatar: row.avatar,
        message: decryptedMsg || '',
        mentions: row.mentions || [],
        sent_at: row.sent_at
      };
    })
    .reverse();
}
export async function deleteChatMessage(sessionId: string, messageId: number, userId: string) {
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