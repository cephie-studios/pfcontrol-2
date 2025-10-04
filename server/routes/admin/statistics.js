import express from 'express';
import { getDailyStatistics, getTotalStatistics } from '../../db/admin.js';

const router = express.Router();

// GET: /api/admin/statistics - Get dashboard statistics
router.get('/', async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const dailyStats = await getDailyStatistics(days);
        const totalStats = await getTotalStatistics();

        res.json({
            daily: dailyStats,
            totals: totalStats
        });
    } catch (error) {
        console.error('Error fetching admin statistics:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

export default router;