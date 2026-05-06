import express from 'express';
import { createAuditLogger } from '../../middleware/auditLogger.js';
import { requirePermission } from '../../middleware/rolePermissions.js';
import { banUser, unbanUser, getAllBans } from '../../db/ban.js';
import {
  addVpnException,
  removeVpnException,
  getAllVpnExceptions,
  getVpnGateSettings,
  updateVpnGateSetting,
} from '../../db/vpnExceptions.js';
import { logAdminAction } from '../../db/audit.js';
import { getUserById } from '../../db/users.js';
import { isAdmin } from '../../middleware/admin.js';
import { getClientIp } from '../../utils/getIpAddress.js';
import { mainDb } from '../../db/connection.js';
import axios from 'axios';

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

// VPN Gate routes

router.get('/vpn-gate', async (req, res) => {
  const settings = await getVpnGateSettings();
  const pageParam = req.query.page;
  const limitParam = req.query.limit;
  const search = typeof req.query.search === 'string' ? req.query.search : '';
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
  const result = await getAllVpnExceptions(page, limit, search);
  res.json({ enabled: settings['vpn_gate_enabled'] ?? false, ...result });
});

router.post('/vpn-gate/toggle', async (req, res) => {
  const { enabled } = req.body;
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'enabled must be a boolean' });
  }
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized: user not found in request' });
  }
  await updateVpnGateSetting('vpn_gate_enabled', enabled);
  await logAdminAction({
    adminId: req.user.userId,
    adminUsername: req.user.username || 'Unknown',
    actionType: enabled ? 'VPN_GATE_ENABLED' : 'VPN_GATE_DISABLED',
    targetUserId: null,
    targetUsername: null,
    ipAddress: (() => {
      const ip = getClientIp(req);
      return Array.isArray(ip) ? ip[0] : (ip ?? null);
    })(),
    userAgent: req.get('User-Agent'),
    details: { enabled, timestamp: new Date().toISOString() },
  });
  res.json({ success: true, enabled });
});

router.post('/vpn-gate/exceptions', async (req, res) => {
  const { userId, notes } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized: user not found in request' });
  }
  const targetUser = await getUserById(userId);
  if (!targetUser) {
    return res.status(404).json({ error: 'User not found' });
  }
  const resolvedUsername = targetUser.username || userId;
  const exception = await addVpnException(
    userId,
    resolvedUsername,
    req.user.userId,
    req.user.username || 'Unknown',
    notes || ''
  );
  await logAdminAction({
    adminId: req.user.userId,
    adminUsername: req.user.username || 'Unknown',
    actionType: 'VPN_EXCEPTION_ADDED',
    targetUserId: userId,
    targetUsername: resolvedUsername,
    ipAddress: (() => {
      const ip = getClientIp(req);
      return Array.isArray(ip) ? ip[0] : (ip ?? null);
    })(),
    userAgent: req.get('User-Agent'),
    details: { userId, username: resolvedUsername, notes, timestamp: new Date().toISOString() },
  });
  res.json({ success: true, exception });
});

router.delete('/vpn-gate/exceptions/:userId', async (req, res) => {
  const { userId } = req.params;
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized: user not found in request' });
  }
  const removed = await removeVpnException(userId);
  await logAdminAction({
    adminId: req.user.userId,
    adminUsername: req.user.username || 'Unknown',
    actionType: 'VPN_EXCEPTION_REMOVED',
    targetUserId: userId,
    targetUsername: userId,
    ipAddress: (() => {
      const ip = getClientIp(req);
      return Array.isArray(ip) ? ip[0] : (ip ?? null);
    })(),
    userAgent: req.get('User-Agent'),
    details: { userId, timestamp: new Date().toISOString() },
  });
  res.json({ success: true, removed });
});

// GET /api/admin/bans/ip-location/:ip
router.get('/ip-location/:ip', async (req, res) => {
  const { ip } = req.params;
  const apiKey = process.env.PROXYCHECK_API_KEY;
  if (!apiKey) {
    console.warn('[ip-location] PROXYCHECK_API_KEY not set');
    return res.json({});
  }
  try {
    const url = `https://proxycheck.io/v2/${encodeURIComponent(ip)}?key=${apiKey}&vpn=1&asn=1`;
    const { data } = await axios.get(url, { timeout: 5000 });
    const info = data[ip];
    if (!info) return res.json({});
    res.json({
      country: info.country ?? null,
      country_code: info.isocode ?? null,
      city: info.city ?? null,
      region: info.region ?? null,
    });
  } catch (err) {
    console.error(`[ip-location] Error for ${ip}:`, err);
    res.json({});
  }
});

export default router;
