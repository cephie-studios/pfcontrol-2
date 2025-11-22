import crypto from 'crypto';
import dotenv from 'dotenv';

const envFile =
  process.env.NODE_ENV === 'production'
    ? '.env.production'
    : '.env.development';
dotenv.config({ path: envFile });

const ENCRYPTION_KEY = process.env.DB_ENCRYPTION_KEY;
const ALGORITHM = 'aes-256-gcm';

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 128) {
  throw new Error('DB_ENCRYPTION_KEY must be 128 characters long');
}

const key = Buffer.from(ENCRYPTION_KEY, 'utf8').subarray(0, 32);

export function encrypt(text: unknown) {
  if (!text) return null;

  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    let encrypted = cipher.update(JSON.stringify(text), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
      iv: iv.toString('hex'),
      data: encrypted,
      authTag: authTag.toString('hex'),
    };
  } catch (error) {
    console.error('Encryption error:', error);
    return null;
  }
}

export function decrypt(encryptedData: {
  iv: string;
  data: string;
  authTag: string;
}) {
  if (
    !encryptedData ||
    typeof encryptedData !== 'object' ||
    !encryptedData.iv ||
    !encryptedData.data ||
    !encryptedData.authTag
  ) {
    return null;
  }

  try {
    const { iv, data, authTag } = encryptedData;
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(iv, 'hex')
    );

    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    let decrypted = decipher.update(data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  } catch (error) {
    console.error('Decryption error:', error);
    return null;
  }
}
