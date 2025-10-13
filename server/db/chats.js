import chatsPool from './connections/chatsConnection.js';
import { encrypt, decrypt } from '../tools/encryption.js';
import { validateSessionId } from '../utils/validation.js';

export async function ensureChatTable(sessionId) {
    const validSessionId = validateSessionId(sessionId);
    await chatsPool.query(`
        CREATE TABLE IF NOT EXISTS chat_${validSessionId} (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(20) NOT NULL,
            username VARCHAR(32),
            avatar VARCHAR(128),
            message TEXT NOT NULL,
            mentions TEXT[],
            sent_at TIMESTAMP DEFAULT NOW()
        )
    `);
}

export async function addChatMessage(sessionId, { userId, username, avatar, message, mentions = [] }) {
    const validSessionId = validateSessionId(sessionId);
    await ensureChatTable(validSessionId);
    const encryptedMsg = encrypt(message);
    const result = await chatsPool.query(
        `INSERT INTO chat_${validSessionId} (user_id, username, avatar, message, mentions) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [String(userId), username, avatar, encryptedMsg, mentions]
    );
    return { ...result.rows[0], message, mentions };
}

export async function getChatMessages(sessionId, limit = 50) {
    const validSessionId = validateSessionId(sessionId);
    await ensureChatTable(validSessionId);
    const result = await chatsPool.query(
        `SELECT * FROM chat_${validSessionId} ORDER BY sent_at DESC LIMIT $1`,
        [limit]
    );
    return result.rows
        .map(row => {
            let decryptedMsg = '';
            try {
                if (row.message) {
                    decryptedMsg = decrypt(JSON.parse(row.message));
                }
            } catch (e) {
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

export async function deleteChatMessage(sessionId, messageId, userId) {
    const validSessionId = validateSessionId(sessionId);
    await ensureChatTable(validSessionId);
    const result = await chatsPool.query(
        `DELETE FROM chat_${validSessionId} WHERE id = $1 AND user_id = $2 RETURNING *`,
        [messageId, userId]
    );
    return result.rowCount > 0;
}