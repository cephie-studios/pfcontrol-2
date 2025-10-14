import { logAdminAction } from '../db/audit.js';
import { getClientIp } from '../utils/getIpAddress.js';
import { encrypt } from '../utils/encryption.js';
import { Request, Response, NextFunction } from 'express';
import type { AdminActionData } from '../db/audit.js';

export function createAuditLogger(actionType: string) {
    return async (req: Request, res: Response, next: NextFunction) => {
        const originalSend = res.send;

        res.send = function (data: unknown) {
            if (res.statusCode >= 200 && res.statusCode < 400 && req.user?.userId) {
                const clientIP = getClientIp(req);
                const encryptedIP = encrypt(clientIP);

                logAdminAction({
                    adminId: req.user.userId,
                    adminUsername: req.user.username || 'Unknown',
                    actionType,
                    ipAddress: JSON.stringify(encryptedIP),
                    userAgent: req.get('User-Agent'),
                    details: {
                        method: req.method,
                        url: req.originalUrl,
                        query: req.query,
                        statusCode: res.statusCode,
                        timestamp: new Date().toISOString()
                    }
                }).catch(error => {
                    console.error('Failed to log admin action:', error);
                });
            }

            return originalSend.call(this, data);
        };

        next();
    };
}

export async function logIPAccess(actionData: AdminActionData) {
    try {
        await logAdminAction(actionData);
    } catch (error) {
        console.error('Failed to log IP access:', error);
        throw error;
    }
}