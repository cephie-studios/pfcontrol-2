import { Request, Response, NextFunction } from 'express';
import { mainDb } from '../db/connection.js';
import { encrypt } from '../utils/encryption.js';
import { getClientIp } from '../utils/getIpAddress.js';
import { JwtPayloadClient } from '../types/JwtPayload.js';
import { sql } from 'kysely';

interface RequestWithUser extends Request {
  user?: JwtPayloadClient;
}

export interface ApiLogEntry {
  user_id: string | null;
  username: string | null;
  method: string;
  path: string;
  status_code: number;
  response_time: number;
  ip_address: string;
  user_agent: string | null;
  request_body: string | null;
  response_body: string | null;
  error_message: string | null;
  timestamp: Date;
}

const EXCLUDED_PATHS = [
  '/health',
  '/api/data/metar',
  '/api/data/airports',
  '/api/data/airlines',
  '/api/data/aircrafts',
  '/api/data/frequencies',
  '/api/admin/api-logs',
  '/assets',
  '.css',
  '.js',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.svg',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
];

const SENSITIVE_FIELDS = ['token', 'secret', 'key', 'authorization'];

function shouldLogRequest(path: string): boolean {
  return !EXCLUDED_PATHS.some((excluded) =>
    path.toLowerCase().includes(excluded.toLowerCase())
  );
}

function sanitizeObject(obj: unknown): unknown {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item));
  } else {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();

      if (SENSITIVE_FIELDS.some((field) => lowerKey.includes(field))) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeObject(value);
      }
    }

    return sanitized;
  }
}

function truncateString(str: string, maxLength: number = 10000): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength) + '... [TRUNCATED]';
}

export async function logApiCall(logEntry: ApiLogEntry): Promise<void> {
  try {
    const ipAddress = Array.isArray(logEntry.ip_address)
      ? logEntry.ip_address.join(', ')
      : logEntry.ip_address;

    const encryptedIpAddress = encrypt(ipAddress);

    const encryptedRequestBody = logEntry.request_body
      ? encrypt(logEntry.request_body)
      : null;

    const encryptedResponseBody = logEntry.response_body
      ? encrypt(logEntry.response_body)
      : null;

    const encryptedErrorMessage = logEntry.error_message
      ? encrypt(logEntry.error_message)
      : null;

    await mainDb
      .insertInto('api_logs')
      .values({
        id: sql`DEFAULT`,
        user_id: logEntry.user_id,
        username: logEntry.username,
        method: logEntry.method,
        path: logEntry.path,
        status_code: logEntry.status_code,
        response_time: logEntry.response_time,
        ip_address: JSON.stringify(encryptedIpAddress),
        user_agent: logEntry.user_agent,
        request_body: encryptedRequestBody
          ? JSON.stringify(encryptedRequestBody)
          : null,
        response_body: encryptedResponseBody
          ? JSON.stringify(encryptedResponseBody)
          : null,
        error_message: encryptedErrorMessage
          ? JSON.stringify(encryptedErrorMessage)
          : null,
        timestamp: logEntry.timestamp,
      })
      .execute();
  } catch (error) {
    console.error('Failed to log API call:', error);
    // Logging failures shouldn't break the API
  }
}

export function apiLogger() {
  return async (req: RequestWithUser, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const originalSend = res.send;
    let responseBody: string | null = null;
    const errorMessage: string | null = null;

    if (!shouldLogRequest(req.path)) {
      return next();
    }

    res.send = function (data) {
      try {
        if (data && typeof data === 'object') {
          responseBody = truncateString(JSON.stringify(sanitizeObject(data)));
        } else if (typeof data === 'string') {
          responseBody = truncateString(data);
        }
      } catch {
        responseBody = '[SERIALIZATION_ERROR]';
      }
      return originalSend.call(this, data);
    };

    res.on('finish', async () => {
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      try {
        let requestBody: string | null = null;

        if (req.body && Object.keys(req.body).length > 0) {
          try {
            requestBody = truncateString(
              JSON.stringify(sanitizeObject(req.body))
            );
          } catch {
            requestBody = '[SERIALIZATION_ERROR]';
          }
        }

        const ipAddress = getClientIp(req);
        const finalIpAddress = Array.isArray(ipAddress)
          ? ipAddress.join(', ')
          : ipAddress;

        const logEntry: ApiLogEntry = {
          user_id: req.user?.userId || null,
          username: req.user?.username || null,
          method: req.method,
          path: req.originalUrl || req.path,
          status_code: res.statusCode,
          response_time: responseTime,
          ip_address: finalIpAddress,
          user_agent: req.get('User-Agent') || null,
          request_body: requestBody,
          response_body: responseBody,
          error_message: errorMessage,
          timestamp: new Date(),
        };

        setImmediate(() => logApiCall(logEntry));
      } catch (error) {
        console.error('Error creating API log entry:', error);
      }
    });

    next();
  };
}

// Cleanup function to remove old logs
export async function cleanupOldApiLogs(
  daysToKeep: number = 30
): Promise<void> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await mainDb
      .deleteFrom('api_logs')
      .where('timestamp', '<', cutoffDate)
      .execute();

    console.log(`Cleaned up ${result.length} old API log entries`);
  } catch (error) {
    console.error('Failed to cleanup old API logs:', error);
  }
}
