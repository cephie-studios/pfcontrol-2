import pool from '../db/connections/connection.js';

export async function validateSessionAccess(sessionId, accessId) {
    if (!sessionId || !accessId) {
        return false;
    }

    try {
        const result = await pool.query(
            'SELECT session_id, access_id FROM sessions WHERE session_id = $1 AND access_id = $2',
            [sessionId, accessId]
        );

        return result.rowCount > 0;
    } catch (error) {
        console.error('Session access validation error:', error);
        return false;
    }
}

export async function validateSessionOwnership(sessionId, userId) {
    if (!sessionId || !userId) return false;

    try {
        const result = await pool.query(
            'SELECT 1 FROM sessions WHERE session_id = $1 AND created_by = $2',
            [sessionId, userId]
        );
        return result.rowCount > 0;
    } catch (error) {
        console.error('Session ownership validation error:', error);
        return false;
    }
}

export function requireSessionAccess(req, res, next) {
    const { sessionId } = req.params;
    const accessId = (req.query && req.query.accessId) || (req.body && req.body.accessId);

    if (!sessionId || !accessId) {
        return res.status(400).json({
            error: 'Session ID and access ID are required'
        });
    }

    validateSessionAccess(sessionId, accessId)
        .then(isValid => {
            if (!isValid) {
                return res.status(403).json({
                    error: 'Invalid session access'
                });
            }
            next();
        })
        .catch(error => {
            console.error('Session access validation error:', error);
            res.status(500).json({
                error: 'Session validation failed'
            });
        });
}

// New middleware for operations that require ownership
export function requireSessionOwnership(req, res, next) {
    const { sessionId } = req.params || req.body;
    const userId = req.user?.userId;

    if (!sessionId || !userId) {
        return res.status(400).json({
            error: 'Session ID and authentication are required'
        });
    }

    validateSessionOwnership(sessionId, userId)
        .then(isOwner => {
            if (!isOwner) {
                return res.status(403).json({
                    error: 'Only session owner can perform this action'
                });
            }
            next();
        })
        .catch(error => {
            console.error('Session ownership validation error:', error);
            res.status(500).json({
                error: 'Session ownership validation failed'
            });
        });
}