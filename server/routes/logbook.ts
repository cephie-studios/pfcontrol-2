import { Request, Response } from 'express';
import { JwtPayloadClient } from '../types/JwtPayload';
import express from 'express';
import requireAuth from '../middleware/auth.js';
import { isAdmin, requireAdmin } from '../middleware/admin.js';
import {
    getUserFlights,
    getFlightById,
    getActiveFlightData,
    getFlightTelemetry,
    getUserStats,
    createFlight,
    startActiveFlightTracking,
    deleteFlightById,
    getActiveFlightByUsername,
    updateUserStatsCache,
    completeFlightByCallsign,
    generateShareToken,
    getFlightByShareToken,
    getPublicPilotProfile
} from '../db/logbook.js';
import {
    getUserNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification
} from '../db/userNotifications.js';
import { mainDb } from '../db/connection';

function isJwtPayloadClient(user: unknown): user is JwtPayloadClient {
    return (
        typeof user === 'object' &&
        user !== null &&
        'userId' in user &&
        typeof (user as Record<string, unknown>).userId === 'string'
    );
}

const router = express.Router();

// Public route - must be before requireAuth middleware
router.get('/public/:shareToken', async (req, res) => {
    try {
        const flight = await getFlightByShareToken(req.params.shareToken);

        if (!flight) {
            return res.status(404).json({ error: 'Flight not found' });
        }

        res.json(flight);
    } catch (error) {
        console.error('Error fetching shared flight:', error);
        res.status(500).json({ error: 'Failed to fetch flight' });
    }
});

// Public route for telemetry - must be before requireAuth
router.get('/public/:shareToken/telemetry', async (req, res) => {
    try {
        const flight = await getFlightByShareToken(req.params.shareToken);

        if (!flight) {
            return res.status(404).json({ error: 'Flight not found' });
        }

        const hasId = typeof flight === 'object' && flight !== null && 'id' in flight && typeof (flight.id) === 'number';
        const flightId = hasId ? (flight as { id: number }).id : undefined;
        if (!flightId) {
            return res.status(400).json({ error: 'Invalid flight id' });
        }
        const telemetry = await getFlightTelemetry(flightId);
        res.json(telemetry);
    } catch (error: unknown) {
        console.error('Error fetching shared flight telemetry:', error);
        res.status(500).json({ error: 'Failed to fetch telemetry' });
    }
});

// Public route for pilot profile - must be before requireAuth
router.get('/pilot/:username', async (req, res) => {
    try {
        const profile = await getPublicPilotProfile(req.params.username);

        if (!profile) {
            return res.status(404).json({ error: 'Pilot not found' });
        }

        res.json(profile);
    } catch (error) {
        console.error('Error fetching pilot profile:', error);
        res.status(500).json({ error: 'Failed to fetch pilot profile' });
    }
});

// Public route to check if a callsign is being tracked
router.get('/check-tracking/:callsign', async (req, res) => {
    try {
        const { callsign } = req.params;
        const activeFlight = await mainDb
            .selectFrom('logbook_flights')
            .select(['id', 'roblox_username', 'share_token'])
            .where(mainDb.fn('UPPER', ['callsign']), '=', callsign.toUpperCase())
            .where('flight_status', 'in', ['active', 'pending'])
            .limit(1)
            .execute();

        if (activeFlight.length > 0) {
            res.json({
                isTracked: true,
                flightId: activeFlight[0].id,
                username: activeFlight[0].roblox_username,
                shareToken: activeFlight[0].share_token
            });
        } else {
            res.json({ isTracked: false });
        }
    } catch (error) {
        console.error('Error checking flight tracking:', error);
        res.status(500).json({ error: 'Failed to check tracking status' });
    }
});

// All routes below require authentication
router.use(requireAuth);

// GET: /api/logbook/flights - Get user's flights with pagination and filters
router.get('/flights', async (req: Request, res: Response) => {
    try {
        if (!isJwtPayloadClient(req.user)) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { page = 1, limit = 20, status = 'completed' } = req.query;

    const pageNum = typeof page === 'string' ? parseInt(page) : Array.isArray(page) && typeof page[0] === 'string' ? parseInt(page[0]) : Number(page);
    const limitNum = typeof limit === 'string' ? parseInt(limit) : Array.isArray(limit) && typeof limit[0] === 'string' ? parseInt(limit[0]) : Number(limit);
    const statusStr = typeof status === 'string' ? status : Array.isArray(status) && typeof status[0] === 'string' ? status[0] : undefined;

        const result = await getUserFlights(
            req.user.userId,
            pageNum,
            limitNum,
            statusStr
        );

        res.json(result);
    } catch (error) {
        console.error('Error fetching flights:', error);
        res.status(500).json({ error: 'Failed to fetch flights' });
    }
});

// GET: /api/logbook/flights/:id - Get single flight details (with real-time data if active)
router.get('/flights/:id', async (req: Request, res: Response) => {
    try {
        if (!isJwtPayloadClient(req.user)) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const flightId = parseInt(req.params.id);
        const flight = await getActiveFlightData(flightId);

        if (!flight) {
            return res.status(404).json({ error: 'Flight not found' });
        }

        // Ensure user owns this flight
        if (flight.user_id !== req.user.userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json(flight);
    } catch (error) {
        console.error('Error fetching flight:', error);
        res.status(500).json({ error: 'Failed to fetch flight' });
    }
});

// GET: /api/logbook/flights/:id/telemetry - Get flight telemetry for graphs
router.get('/flights/:id/telemetry', async (req: Request, res: Response) => {
    try {
        if (!isJwtPayloadClient(req.user)) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const flightId = parseInt(req.params.id);
        const flight = await getFlightById(flightId);

        if (!flight) {
            return res.status(404).json({ error: 'Flight not found' });
        }

        // Ensure user owns this flight
        if (flight.user_id !== req.user.userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const telemetry = await getFlightTelemetry(flightId);

        res.json(telemetry);
    } catch (error) {
        console.error('Error fetching telemetry:', error);
        res.status(500).json({ error: 'Failed to fetch telemetry' });
    }
});

// GET: /api/logbook/stats - Get user statistics
router.get('/stats', async (req: Request, res: Response) => {
    try {
        if (!isJwtPayloadClient(req.user)) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const stats = await getUserStats(req.user.userId);
        res.json(stats);
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

// POST: /api/logbook/stats/refresh - Refresh user statistics cache
router.post('/stats/refresh', async (req: Request, res: Response) => {
    try {
        if (!isJwtPayloadClient(req.user)) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        await updateUserStatsCache(req.user.userId);
        const stats = await getUserStats(req.user.userId);
        res.json({ success: true, stats });
    } catch (error) {
        console.error('Error refreshing stats:', error);
        res.status(500).json({ error: 'Failed to refresh statistics' });
    }
});

// POST: /api/logbook/flights/start - Start tracking a flight
router.post('/flights/start', async (req: Request, res: Response) => {
    try {
        if (!isJwtPayloadClient(req.user)) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { robloxUsername, callsign, departureIcao, arrivalIcao, route, aircraftIcao } = req.body;

        // Validate required fields
        if (!robloxUsername || !callsign) {
            return res.status(400).json({ error: 'Roblox username and callsign are required' });
        }

        // Check if user already has an active flight
        const existingActiveFlight = await getActiveFlightByUsername(robloxUsername);
        if (existingActiveFlight) {
            return res.status(400).json({
                error: 'You already have an active flight',
                details: `Flight ${existingActiveFlight.callsign} is still active. Complete or cancel it before starting a new flight.`,
                activeFlightId: existingActiveFlight.flight_id
            });
        }

        // Get user's Roblox user ID from their account (if connected)
        const userResult = await (await import('../db/users.js')).getUserById(req.user.userId);
        const robloxUserId = userResult?.roblox_user_id || null;

        // Create flight entry
        const flightId = await createFlight({
            userId: req.user.userId,
            robloxUserId,
            robloxUsername,
            callsign,
            departureIcao,
            arrivalIcao,
            route,
            aircraftIcao
        });

        // Start active tracking
        if (typeof flightId === 'number') {
            await startActiveFlightTracking(robloxUsername, callsign, flightId);
        }

        res.json({
            success: true,
            flightId,
            message: 'Flight tracking started'
        });
    } catch (error) {
        console.error('Error starting flight tracking:', error);
        res.status(500).json({ error: 'Failed to start flight tracking' });
    }
});

// DELETE: /api/logbook/flights/:id - Delete a flight (users can only delete pending flights, admins can delete any)
router.delete('/flights/:id', async (req: Request, res: Response) => {
    try {
        if (!isJwtPayloadClient(req.user)) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const flightId = parseInt(req.params.id);
        const userIsAdmin = isAdmin(req.user.userId);

        const result = await deleteFlightById(flightId, req.user.userId, userIsAdmin);

        if (!result.success) {
            return res.status(result.error === 'Flight not found' ? 404 : 403).json({ error: result.error });
        }

        res.json({ success: true, message: 'Flight deleted successfully' });
    } catch (error) {
        console.error('Error deleting flight:', error);
        res.status(500).json({ error: 'Failed to delete flight' });
    }
});

// GET: /api/logbook/debug/raw-stats - Get raw stats cache data
router.get('/debug/raw-stats', requireAdmin, async (req, res) => {
    try {
        if (!isJwtPayloadClient(req.user)) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const result = await mainDb
            .selectFrom('logbook_stats_cache')
            .selectAll()
            .where('user_id', '=', req.user.userId)
            .execute();

        res.json(result[0] || null);
    } catch (error) {
        console.error('Error fetching raw stats:', error);
        res.status(500).json({ error: 'Failed to fetch raw stats' });
    }
});

// GET: /api/logbook/debug/raw-flights - Get all flights with full data
router.get('/debug/raw-flights', requireAdmin, async (req, res) => {
    try {
        if (!req.user || !isJwtPayloadClient(req.user)) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const result = await mainDb
            .selectFrom('logbook_flights')
            .selectAll()
            .where('user_id', '=', req.user.userId)
            .orderBy('created_at', 'desc')
            .execute();

        res.json(result);
    } catch (error) {
        console.error('Error fetching raw flights:', error);
        res.status(500).json({ error: 'Failed to fetch raw flights' });
    }
});

// GET: /api/logbook/debug/active-tracking - Get active flight tracking data
router.get('/debug/active-tracking', requireAdmin, async (req, res) => {
    try {
        const result = await mainDb
            .selectFrom('logbook_active_flights as af')
            .leftJoin('logbook_flights as f', 'af.flight_id', 'f.id')
            .select([
                (eb) => eb.ref('af.flight_id').as('flight_id'),
                (eb) => eb.ref('af.roblox_username').as('roblox_username'),
                (eb) => eb.ref('af.callsign').as('callsign'),
                (eb) => eb.ref('f.callsign').as('f_callsign'),
                (eb) => eb.ref('f.departure_icao').as('departure_icao'),
                (eb) => eb.ref('f.arrival_icao').as('arrival_icao'),
                (eb) => eb.ref('f.flight_status').as('flight_status'),
            ])
            .execute();

        res.json(result);
    } catch (error) {
        console.error('Error fetching active tracking:', error);
        res.status(500).json({ error: 'Failed to fetch active tracking' });
    }
});

// DELETE: /api/logbook/debug/clear-telemetry/:flightId - Clear telemetry for a flight
router.delete('/debug/clear-telemetry/:flightId', requireAdmin, async (req, res) => {
    try {
        const flightId = parseInt(req.params.flightId);

        await mainDb
            .deleteFrom('logbook_telemetry')
            .where('flight_id', '=', flightId)
            .execute();

        res.json({ success: true, message: 'Telemetry cleared' });
    } catch (error) {
        console.error('Error clearing telemetry:', error);
        res.status(500).json({ error: 'Failed to clear telemetry' });
    }
});

// POST: /api/logbook/debug/reset-stats - Reset stats cache for user
router.post('/debug/reset-stats', requireAdmin, async (req, res) => {
    try {
        if (!isJwtPayloadClient(req.user)) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        await mainDb
            .deleteFrom('logbook_stats_cache')
            .where('user_id', '=', req.user.userId)
            .execute();

        await mainDb
            .insertInto('logbook_stats_cache')
            .values({ user_id: req.user.userId })
            .execute();

        await updateUserStatsCache(req.user.userId);

        const stats = await getUserStats(req.user.userId);

        res.json({ success: true, stats });
    } catch (error) {
        console.error('Error resetting stats:', error);
        res.status(500).json({ error: 'Failed to reset stats' });
    }
});

// POST: /api/logbook/debug/recalculate-flight/:flightId - Recalculate stats for a specific flight
router.post('/debug/recalculate-flight/:flightId', requireAdmin, async (req, res) => {
    try {
        const flightId = parseInt(req.params.flightId);

        // Get telemetry count
        const telemetryResult = await mainDb
            .selectFrom('logbook_telemetry')
            .select(mainDb.fn.countAll().as('count'))
            .where('flight_id', '=', flightId)
            .execute();

        const flight = await getFlightById(flightId);

        // Defensive: handle string | number | bigint
        let telemetryPoints = 0;
        const countVal = telemetryResult[0]?.count;
        if (typeof countVal === 'string') telemetryPoints = parseInt(countVal);
        else if (typeof countVal === 'number') telemetryPoints = countVal;
        else if (typeof countVal === 'bigint') telemetryPoints = Number(countVal);

        res.json({
            success: true,
            flight,
            telemetryPoints
        });
    } catch (error) {
        console.error('Error recalculating flight:', error);
        res.status(500).json({ error: 'Failed to recalculate flight' });
    }
});

// POST: /api/logbook/debug/export-data - Export all logbook data as JSON
router.post('/debug/export-data', requireAdmin, async (req, res) => {
    try {
        if (!req.user || !isJwtPayloadClient(req.user)) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        const flights = await mainDb
            .selectFrom('logbook_flights')
            .selectAll()
            .where('user_id', '=', req.user.userId)
            .orderBy('created_at', 'desc')
            .execute();

        const stats = await mainDb
            .selectFrom('logbook_stats_cache')
            .selectAll()
            .where('user_id', '=', req.user.userId)
            .execute();

        res.json({
            flights,
            stats: stats[0],
            exportedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error exporting data:', error);
        res.status(500).json({ error: 'Failed to export data' });
    }
});

router.get('/notifications', async (req: Request, res: Response) => {
    try {
        if (!isJwtPayloadClient(req.user)) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { unreadOnly } = req.query;
        const notifications = await getUserNotifications(req.user.userId, unreadOnly === 'true');
        res.json(notifications);
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

router.post('/notifications/:id/read', async (req: Request, res: Response) => {
    try {
        if (!isJwtPayloadClient(req.user)) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        await markNotificationAsRead(parseInt(req.params.id), req.user.userId);
        res.json({ success: true });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ error: 'Failed to mark notification as read' });
    }
});

router.post('/notifications/read-all', async (req: Request, res: Response) => {
    try {
        if (!isJwtPayloadClient(req.user)) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        await markAllNotificationsAsRead(req.user.userId);
        res.json({ success: true });
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({ error: 'Failed to mark all notifications as read' });
    }
});

router.delete('/notifications/:id', async (req: Request, res: Response) => {
    try {
        if (!isJwtPayloadClient(req.user)) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        await deleteNotification(parseInt(req.params.id), req.user.userId);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting notification:', error);
        res.status(500).json({ error: 'Failed to delete notification' });
    }
});

// POST: /api/logbook/flights/:id/complete - Manually complete an active flight
router.post('/flights/:id/complete', async (req: Request, res: Response) => {
    try {
        if (!isJwtPayloadClient(req.user)) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const flightId = parseInt(req.params.id);

        // Verify flight belongs to user and is active
        const flight = await mainDb
            .selectFrom('logbook_flights')
            .select(['callsign', 'user_id', 'flight_status'])
            .where('id', '=', flightId)
            .execute();

        if (!flight[0]) {
            return res.status(404).json({ error: 'Flight not found' });
        }

        if (flight[0].user_id !== req.user.userId) {
            return res.status(403).json({ error: 'Not authorized to complete this flight' });
        }

        if (flight[0].flight_status !== 'active') {
            return res.status(400).json({ error: 'Flight is not active' });
        }

        // Complete the flight
        await completeFlightByCallsign(flight[0].callsign);

        res.json({ success: true, message: 'Flight completed successfully' });
    } catch (error) {
        console.error('Error completing flight:', error);
        res.status(500).json({ error: 'Failed to complete flight' });
    }
});

// POST: /api/logbook/flights/:id/share - Generate or retrieve share token
router.post('/flights/:id/share', async (req: Request, res: Response) => {
    try {
        if (!isJwtPayloadClient(req.user)) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const flightId = parseInt(req.params.id);
        const shareToken = await generateShareToken(flightId, req.user.userId);

        const shareUrl = `${process.env.FRONTEND_URL}/flight/${shareToken}`;

        res.json({
            success: true,
            shareToken,
            shareUrl
        });
    } catch (error: unknown) {
        console.error('Error generating share token:', error);

        if (typeof error === 'object' && error !== null && 'message' in error) {
            const message = (error as { message?: string }).message;
            if (message === 'Flight not found') {
                return res.status(404).json({ error: 'Flight not found' });
            }
            if (message === 'Not authorized') {
                return res.status(403).json({ error: 'Not authorized to share this flight' });
            }
        }

        res.status(500).json({ error: 'Failed to generate share link' });
    }
});

export default router;
