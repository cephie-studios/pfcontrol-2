import { logAdminAction } from '../db/audit.js';

export function createAuditLogger(actionType) {
    return async (req, res, next) => {
        const originalSend = res.send;

        res.send = function (data) {
            if (res.statusCode >= 200 && res.statusCode < 400 && req.user?.userId) {
                logAdminAction({
                    adminId: req.user.userId,
                    adminUsername: req.user.username || 'Unknown',
                    actionType,
                    ipAddress: req.ip || req.connection.remoteAddress || req.socket.remoteAddress,
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

export async function logIPAccess(actionData) {
    try {
        await logAdminAction(actionData);
    } catch (error) {
        console.error('Failed to log IP access:', error);
        throw error;
    }
}