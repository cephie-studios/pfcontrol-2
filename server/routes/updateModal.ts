import express from 'express';
import { getActiveUpdateModal } from '../db/updateModals.js';

const router = express.Router();

// GET: /api/update-modal/active - Get the active update modal
// Note: Modal tracking is done via localStorage on the client side
router.get('/active', async (req, res) => {
    try {
        const modal = await getActiveUpdateModal();
        res.json(modal);
    } catch (error) {
        console.error('Error fetching active update modal:', error);
        res.status(500).json({ error: 'Failed to fetch active update modal' });
    }
});

export default router;
