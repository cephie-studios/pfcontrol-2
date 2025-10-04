import express from 'express';
import { createAuditLogger } from '../../middleware/auditLogger.js';
import { getSystemInfo } from '../../db/admin.js';

const router = express.Router();

// GET: /api/admin/system-info - Get system information
router.get('/', createAuditLogger('ADMIN_SYSTEM_INFO_ACCESSED'), async (req, res) => {
    try {
        const systemInfo = await getSystemInfo();
        res.json(systemInfo);
    } catch (error) {
        console.error('Error fetching system info:', error);
        res.status(500).json({ error: 'Failed to fetch system information' });
    }
});

export default router;