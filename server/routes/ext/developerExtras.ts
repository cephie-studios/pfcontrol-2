import express from 'express';
import type { Request, Response } from 'express';
import { getControllerRatingStats } from '../../db/ratings.js';
import { getActiveNotifications } from '../../db/notifications.js';
import { listDeveloperFlightLogsMetadata } from '../../db/flightLogs.js';
import { DEVELOPER_SCOPE_CATALOG } from '../../developer/scopeRegistry.js';
import { getDeveloperApiDefaultRateLimitPerMinute } from '../../middleware/developerExtApi.js';
import { sendServerError } from '../../utils/apiError.js';

const router = express.Router();

function extCtx(req: Request) {
  const ext = req.developerExt;
  if (!ext) throw new Error('developerExt missing');
  return ext;
}

router.get('/me', (req: Request, res: Response) => {
  try {
    const ext = extCtx(req);
    const scopes = ext.scopes.map((id) => {
      const catalogEntry = DEVELOPER_SCOPE_CATALOG.find((s) => s.id === id);
      return {
        id,
        label: catalogEntry?.label ?? id,
        description: catalogEntry?.description ?? '',
      };
    });
    res.json({
      keyId: ext.keyId,
      keyName: ext.keyName,
      keyPrefix: ext.keyPrefix,
      userId: ext.userId,
      apiVersion: ext.apiVersion ?? 1,
      scopes,
      rateLimitPerMinute:
        ext.rateLimitPerMinute ?? getDeveloperApiDefaultRateLimitPerMinute(),
    });
  } catch (e) {
    console.error('[ext/me]', e);
    sendServerError(res, 'Failed to load key info', e);
  }
});

router.get(
  '/ratings/controllers/:controllerId/stats',
  async (req: Request, res: Response) => {
    try {
      extCtx(req);
      const { controllerId } = req.params;
      if (!controllerId?.trim()) {
        return res.status(400).json({ error: 'controllerId required' });
      }
      const stats = await getControllerRatingStats(controllerId.trim());
      res.json({
        controllerId: controllerId.trim(),
        averageRating: stats.averageRating,
        ratingCount: stats.ratingCount,
      });
    } catch (e) {
      console.error('[ext/ratings stats]', e);
      sendServerError(res, 'Failed to load rating stats', e);
    }
  }
);

router.get('/notifications/active', async (req: Request, res: Response) => {
  try {
    extCtx(req);
    const notifications = await getActiveNotifications();
    res.json(
      notifications.map((n) => ({
        id: n.id,
        type: n.type,
        text: n.text,
        show: n.show,
        customColor: n.custom_color,
        createdAt: n.created_at,
      }))
    );
  } catch (e) {
    console.error('[ext/notifications]', e);
    sendServerError(res, 'Failed to load notifications', e);
  }
});

router.get('/flight-logs', async (req: Request, res: Response) => {
  try {
    const ext = extCtx(req);
    const sessionId =
      typeof req.query.sessionId === 'string' ? req.query.sessionId : undefined;
    const page =
      typeof req.query.page === 'string'
        ? parseInt(req.query.page, 10) || 1
        : 1;
    const limit =
      typeof req.query.limit === 'string'
        ? parseInt(req.query.limit, 10) || 50
        : 50;
    const data = await listDeveloperFlightLogsMetadata(ext.userId, {
      sessionId,
      page,
      limit,
    });
    res.json(data);
  } catch (e) {
    console.error('[ext/flight-logs]', e);
    sendServerError(res, 'Failed to load flight logs', e);
  }
});

export default router;
