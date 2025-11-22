import express from 'express';
import { createAuditLogger } from '../../middleware/auditLogger.js';
import { requirePermission } from '../../middleware/rolePermissions.js';
import { banUser, unbanUser, getAllBans } from '../../db/ban.js';
import { logAdminAction } from '../../db/audit.js';
import { isAdmin } from '../../middleware/admin.js';
import { getClientIp } from '../../utils/getIpAddress.js';
import { mainDb } from '../../db/connection.js';

const router = express.Router();

router.use(requirePermission('bans'));

router.get('/', createAuditLogger('ADMIN_BANS_ACCESSED'), async (req, res) => {
  const pageParam = req.query.page;
  const limitParam = req.query.limit;
  const page =
    typeof pageParam === 'string'
      ? parseInt(pageParam)
      : Array.isArray(pageParam) && typeof pageParam[0] === 'string'
        ? parseInt(pageParam[0])
        : 1;
  const limit =
    typeof limitParam === 'string'
      ? parseInt(limitParam)
      : Array.isArray(limitParam) && typeof limitParam[0] === 'string'
        ? parseInt(limitParam[0])
        : 50;
  const result = await getAllBans(page, limit);
  res.json(result);
});

router.post('/ban', async (req, res) => {
  const { userId, ip, username, reason, expiresAt } = req.body;
  if (!userId && !ip) {
    return res
      .status(400)
      .json({ error: 'Either userId or ip must be provided' });
  }
  if (userId && isAdmin(userId)) {
    return res.status(403).json({ error: 'Cannot ban a super admin' });
  }
  if (!req.user) {
    return res
      .status(401)
      .json({ error: 'Unauthorized: user not found in request' });
  }
  await banUser({
    userId,
    ip,
    username,
    reason,
    bannedBy: req.user.userId,
    expiresAt,
  });

  await logAdminAction({
    adminId: req.user.userId,
    adminUsername: req.user.username || 'Unknown',
    actionType: 'USER_BANNED',
    targetUserId: userId || null,
    targetUsername: ip || username || null,
    ipAddress: (() => {
      const ip = getClientIp(req);
      return Array.isArray(ip) ? ip[0] : ip;
    })(),
    userAgent: req.get('User-Agent'),
    details: {
      reason,
      expiresAt,
      method: req.method,
      url: req.originalUrl,
      timestamp: new Date().toISOString(),
    },
  });

  res.json({ success: true });
});

router.post('/unban', async (req, res) => {
  const { userIdOrIp } = req.body;

  const banRecord = await mainDb
    .selectFrom('bans')
    .select('username')
    .where('active', '=', true)
    .where((qb) =>
      qb.or([qb('user_id', '=', userIdOrIp), qb('ip_address', '=', userIdOrIp)])
    )
    .limit(1)
    .execute();
  const username = banRecord[0]?.username || userIdOrIp;

  await unbanUser(userIdOrIp);

  if (!req.user) {
    return res
      .status(401)
      .json({ error: 'Unauthorized: user not found in request' });
  }
  await logAdminAction({
    adminId: req.user.userId,
    adminUsername: req.user.username || 'Unknown',
    actionType: 'USER_UNBANNED',
    targetUserId: null,
    targetUsername: username,
    ipAddress: (() => {
      const ip = getClientIp(req);
      return Array.isArray(ip) ? ip[0] : (ip ?? null);
    })(),
    userAgent: req.get('User-Agent'),
    details: {
      method: req.method,
      url: req.originalUrl,
      timestamp: new Date().toISOString(),
    },
  });

  res.json({ success: true });
});

export default router;
