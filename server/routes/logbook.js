import express from 'express';
import requireAuth from '../middleware/isAuthenticated.js';
import { isAdmin, requireAdmin } from '../middleware/isAdmin.js';
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
    updateUserStatsCache
} from '../db/logbook.js';
import {
    getUserNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification
} from '../db/userNotifications.js';
import pool from '../db/connections/connection.js';

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

// GET: /api/logbook/flights - Get user's flights with pagination and filters
router.get('/flights', async (req, res) => {
    try {
        const { page = 1, limit = 20, status = 'completed' } = req.query;

        const result = await getUserFlights(
            req.user.userId,
            parseInt(page),
            parseInt(limit),
            status
        );

        res.json(result);
    } catch (error) {
        console.error('Error fetching flights:', error);
        res.status(500).json({ error: 'Failed to fetch flights' });
    }
});

// GET: /api/logbook/flights/:id - Get single flight details (with real-time data if active)
router.get('/flights/:id', async (req, res) => {
    try {
        const flight = await getActiveFlightData(req.params.id);

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
router.get('/flights/:id/telemetry', async (req, res) => {
    try {
        const flight = await getFlightById(req.params.id);

        if (!flight) {
            return res.status(404).json({ error: 'Flight not found' });
        }

        // Ensure user owns this flight
        if (flight.user_id !== req.user.userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const telemetry = await getFlightTelemetry(req.params.id);

        res.json(telemetry);
    } catch (error) {
        console.error('Error fetching telemetry:', error);
        res.status(500).json({ error: 'Failed to fetch telemetry' });
    }
});

// GET: /api/logbook/stats - Get user statistics
router.get('/stats', async (req, res) => {
    try {
        const stats = await getUserStats(req.user.userId);
        res.json(stats);
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

// POST: /api/logbook/stats/refresh - Refresh user statistics cache
router.post('/stats/refresh', async (req, res) => {
    try {
        await updateUserStatsCache(req.user.userId);
        const stats = await getUserStats(req.user.userId);
        res.json({ success: true, stats });
    } catch (error) {
        console.error('Error refreshing stats:', error);
        res.status(500).json({ error: 'Failed to refresh statistics' });
    }
});

// POST: /api/logbook/flights/start - Start tracking a flight
router.post('/flights/start', async (req, res) => {
    try {
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
        await startActiveFlightTracking(robloxUsername, callsign, flightId);

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
router.delete('/flights/:id', async (req, res) => {
    try {
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

// ========== ADMIN DEBUG ENDPOINTS ==========

// GET: /api/logbook/debug/raw-stats - Get raw stats cache data
router.get('/debug/raw-stats', requireAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM logbook_stats_cache
            WHERE user_id = $1
        `, [req.user.userId]);

        res.json(result.rows[0] || null);
    } catch (error) {
        console.error('Error fetching raw stats:', error);
        res.status(500).json({ error: 'Failed to fetch raw stats' });
    }
});

// GET: /api/logbook/debug/raw-flights - Get all flights with full data
router.get('/debug/raw-flights', requireAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM logbook_flights
            WHERE user_id = $1
            ORDER BY created_at DESC
        `, [req.user.userId]);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching raw flights:', error);
        res.status(500).json({ error: 'Failed to fetch raw flights' });
    }
});

// GET: /api/logbook/debug/active-tracking - Get active flight tracking data
router.get('/debug/active-tracking', requireAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT af.*, f.callsign, f.departure_icao, f.arrival_icao, f.flight_status
            FROM logbook_active_flights af
            LEFT JOIN logbook_flights f ON af.flight_id = f.id
        `);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching active tracking:', error);
        res.status(500).json({ error: 'Failed to fetch active tracking' });
    }
});

// DELETE: /api/logbook/debug/clear-telemetry/:flightId - Clear telemetry for a flight
router.delete('/debug/clear-telemetry/:flightId', requireAdmin, async (req, res) => {
    try {
        const flightId = parseInt(req.params.flightId);

        await pool.query(`
            DELETE FROM logbook_telemetry
            WHERE flight_id = $1
        `, [flightId]);

        res.json({ success: true, message: 'Telemetry cleared' });
    } catch (error) {
        console.error('Error clearing telemetry:', error);
        res.status(500).json({ error: 'Failed to clear telemetry' });
    }
});

// POST: /api/logbook/debug/reset-stats - Reset stats cache for user
router.post('/debug/reset-stats', requireAdmin, async (req, res) => {
    try {
        await pool.query(`
            DELETE FROM logbook_stats_cache
            WHERE user_id = $1
        `, [req.user.userId]);

        // Recreate and recalculate
        await pool.query(`
            INSERT INTO logbook_stats_cache (user_id)
            VALUES ($1)
        `, [req.user.userId]);

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
        const telemetryResult = await pool.query(`
            SELECT COUNT(*) as count FROM logbook_telemetry
            WHERE flight_id = $1
        `, [flightId]);

        const flight = await getFlightById(flightId);

        res.json({
            success: true,
            flight,
            telemetryPoints: parseInt(telemetryResult.rows[0].count)
        });
    } catch (error) {
        console.error('Error recalculating flight:', error);
        res.status(500).json({ error: 'Failed to recalculate flight' });
    }
});

// GET: /api/logbook/debug/database-info - Get database table info
router.get('/debug/database-info', requireAdmin, async (req, res) => {
    try {
        const tables = await pool.query(`
            SELECT
                schemaname,
                tablename,
                pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
                pg_stat_get_live_tuples(c.oid) AS rows
            FROM pg_tables t
            JOIN pg_class c ON t.tablename = c.relname
            WHERE schemaname = 'public'
            AND tablename LIKE 'logbook%'
            ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
        `);

        res.json(tables.rows);
    } catch (error) {
        console.error('Error fetching database info:', error);
        res.status(500).json({ error: 'Failed to fetch database info' });
    }
});

// POST: /api/logbook/debug/export-data - Export all logbook data as JSON
router.post('/debug/export-data', requireAdmin, async (req, res) => {
    try {
        const flights = await pool.query(`
            SELECT * FROM logbook_flights
            WHERE user_id = $1
            ORDER BY created_at DESC
        `, [req.user.userId]);

        const stats = await pool.query(`
            SELECT * FROM logbook_stats_cache
            WHERE user_id = $1
        `, [req.user.userId]);

        res.json({
            flights: flights.rows,
            stats: stats.rows[0],
            exportedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error exporting data:', error);
        res.status(500).json({ error: 'Failed to export data' });
    }
});

router.get('/notifications', async (req, res) => {
    try {
        const { unreadOnly } = req.query;
        const notifications = await getUserNotifications(req.user.userId, unreadOnly === 'true');
        res.json(notifications);
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

router.post('/notifications/:id/read', async (req, res) => {
    try {
        await markNotificationAsRead(parseInt(req.params.id), req.user.userId);
        res.json({ success: true });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ error: 'Failed to mark notification as read' });
    }
});

router.post('/notifications/read-all', async (req, res) => {
    try {
        await markAllNotificationsAsRead(req.user.userId);
        res.json({ success: true });
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({ error: 'Failed to mark all notifications as read' });
    }
});

router.delete('/notifications/:id', async (req, res) => {
    try {
        await deleteNotification(parseInt(req.params.id), req.user.userId);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting notification:', error);
        res.status(500).json({ error: 'Failed to delete notification' });
    }
});

export default router;
