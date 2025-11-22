import express from 'express';
import { createAuditLogger } from '../../middleware/auditLogger.js';
import { requirePermission } from '../../middleware/rolePermissions.js';
import { logAdminAction } from '../../db/audit.js';
import {
  getAllUpdateModals,
  getUpdateModalById,
  createUpdateModal,
  updateUpdateModal,
  deleteUpdateModal,
  publishUpdateModal,
  unpublishUpdateModal,
} from '../../db/updateModals.js';
import { getClientIp } from '../../utils/getIpAddress.js';
import { deleteOldImage } from '../uploads.js';

const router = express.Router();
router.use(requirePermission('notifications'));

// GET: /api/admin/update-modals - Get all update modals
router.get(
  '/',
  createAuditLogger('ADMIN_UPDATE_MODALS_ACCESSED'),
  async (req, res) => {
    try {
      const modals = await getAllUpdateModals();
      res.json(modals);
    } catch (error) {
      console.error('Error fetching update modals:', error);
      res.status(500).json({ error: 'Failed to fetch update modals' });
    }
  }
);

// GET: /api/admin/update-modals/:id - Get a specific update modal
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const numericId = Number(id);
    if (isNaN(numericId)) {
      return res.status(400).json({ error: 'Invalid modal ID' });
    }

    const modal = await getUpdateModalById(numericId);
    if (!modal) {
      return res.status(404).json({ error: 'Modal not found' });
    }

    res.json(modal);
  } catch (error) {
    console.error('Error fetching update modal:', error);
    res.status(500).json({ error: 'Failed to fetch update modal' });
  }
});

// POST: /api/admin/update-modals - Create a new update modal
router.post('/', async (req, res) => {
  try {
    const { title, content, banner_url } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    const modal = await createUpdateModal({ title, content, banner_url });

    if (req.user?.userId) {
      const ip = getClientIp(req);
      await logAdminAction({
        adminId: req.user.userId,
        adminUsername: req.user.username || 'Unknown',
        actionType: 'UPDATE_MODAL_CREATED',
        ipAddress: Array.isArray(ip) ? ip.join(', ') : ip,
        userAgent: req.get('User-Agent'),
        details: { title, modalId: modal?.id },
      });
    }

    res.json(modal);
  } catch (error) {
    console.error('Error creating update modal:', error);
    res.status(500).json({ error: 'Failed to create update modal' });
  }
});

// PUT: /api/admin/update-modals/:id - Update an update modal
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, banner_url } = req.body;
    const numericId = Number(id);

    if (isNaN(numericId)) {
      return res.status(400).json({ error: 'Invalid modal ID' });
    }

    const currentModal = await getUpdateModalById(numericId);
    if (!currentModal) {
      return res.status(404).json({ error: 'Modal not found' });
    }

    const modal = await updateUpdateModal(numericId, {
      title,
      content,
      banner_url,
    });

    if (
      currentModal.banner_url &&
      currentModal.banner_url !== modal?.banner_url
    ) {
      try {
        await deleteOldImage(currentModal.banner_url);
      } catch (deleteError) {
        console.error('Error deleting old modal banner:', deleteError);
      }
    }

    if (req.user?.userId) {
      const ip = getClientIp(req);
      await logAdminAction({
        adminId: req.user.userId,
        adminUsername: req.user.username || 'Unknown',
        actionType: 'UPDATE_MODAL_UPDATED',
        ipAddress: Array.isArray(ip) ? ip.join(', ') : ip,
        userAgent: req.get('User-Agent'),
        details: { modalId: id, title },
      });
    }

    res.json(modal);
  } catch (error) {
    console.error('Error updating update modal:', error);
    res.status(500).json({ error: 'Failed to update update modal' });
  }
});

// DELETE: /api/admin/update-modals/:id - Delete an update modal
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const numericId = Number(id);
    if (isNaN(numericId)) {
      return res.status(400).json({ error: 'Invalid modal ID' });
    }

    const modal = await getUpdateModalById(numericId);
    if (!modal) {
      return res.status(404).json({ error: 'Modal not found' });
    }

    await deleteUpdateModal(numericId);

    if (modal.banner_url) {
      try {
        await deleteOldImage(modal.banner_url);
      } catch (deleteError) {
        console.error(
          'Error deleting modal banner during deletion:',
          deleteError
        );
      }
    }

    if (req.user?.userId) {
      const ip = getClientIp(req);
      await logAdminAction({
        adminId: req.user.userId,
        adminUsername: req.user.username || 'Unknown',
        actionType: 'UPDATE_MODAL_DELETED',
        ipAddress: Array.isArray(ip) ? ip.join(', ') : ip,
        userAgent: req.get('User-Agent'),
        details: { modalId: id },
      });
    }

    res.json({ message: 'Update modal deleted' });
  } catch (error) {
    console.error('Error deleting update modal:', error);
    res.status(500).json({ error: 'Failed to delete update modal' });
  }
});

// POST: /api/admin/update-modals/:id/publish - Publish an update modal
router.post('/:id/publish', async (req, res) => {
  try {
    const { id } = req.params;
    const numericId = Number(id);
    if (isNaN(numericId)) {
      return res.status(400).json({ error: 'Invalid modal ID' });
    }

    const modal = await publishUpdateModal(numericId);

    if (req.user?.userId) {
      const ip = getClientIp(req);
      await logAdminAction({
        adminId: req.user.userId,
        adminUsername: req.user.username || 'Unknown',
        actionType: 'UPDATE_MODAL_PUBLISHED',
        ipAddress: Array.isArray(ip) ? ip.join(', ') : ip,
        userAgent: req.get('User-Agent'),
        details: { modalId: id },
      });
    }

    res.json(modal);
  } catch (error) {
    console.error('Error publishing update modal:', error);
    res.status(500).json({ error: 'Failed to publish update modal' });
  }
});

// POST: /api/admin/update-modals/:id/unpublish - Unpublish an update modal
router.post('/:id/unpublish', async (req, res) => {
  try {
    const { id } = req.params;
    const numericId = Number(id);
    if (isNaN(numericId)) {
      return res.status(400).json({ error: 'Invalid modal ID' });
    }

    const modal = await unpublishUpdateModal(numericId);

    if (req.user?.userId) {
      const ip = getClientIp(req);
      await logAdminAction({
        adminId: req.user.userId,
        adminUsername: req.user.username || 'Unknown',
        actionType: 'UPDATE_MODAL_UNPUBLISHED',
        ipAddress: Array.isArray(ip) ? ip.join(', ') : ip,
        userAgent: req.get('User-Agent'),
        details: { modalId: id },
      });
    }

    res.json(modal);
  } catch (error) {
    console.error('Error unpublishing update modal:', error);
    res.status(500).json({ error: 'Failed to unpublish update modal' });
  }
});

export default router;
