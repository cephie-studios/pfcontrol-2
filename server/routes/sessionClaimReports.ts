import express from 'express';
import requireAuth from '../middleware/auth.js';
import { validateSessionAccess } from '../middleware/sessionAccess.js';
import { validateAccessId, validateSessionId } from '../utils/validation.js';
import { getLoggedExternalAcarsClaimRequest } from '../utils/externalAcarsClaims.js';
import { insertSessionClaimReport } from '../db/sessionClaimReports.js';

const router = express.Router();

router.post('/', requireAuth, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const {
      sessionId: rawSessionId,
      accessId: rawAccessId,
      requestId,
    } = req.body ?? {};
    let sessionId: string;
    let accessId: string;
    try {
      sessionId = validateSessionId(rawSessionId);
      accessId = validateAccessId(rawAccessId);
    } catch {
      return res.status(400).json({ error: 'Invalid session' });
    }
    if (!(await validateSessionAccess(sessionId, accessId))) {
      return res.status(403).json({ error: 'No access to this session' });
    }

    const request =
      typeof requestId === 'string'
        ? await getLoggedExternalAcarsClaimRequest(requestId)
        : null;
    if (!request || request.sessionId !== sessionId) {
      return res
        .status(404)
        .json({ error: 'This request is too old to report.' });
    }

    const created = await insertSessionClaimReport({
      requestId: request.requestId,
      sessionId,
      keyId: request.keyId,
      developerUserId: request.userId,
      requesterName: request.requesterName,
      attempts24h: request.attempts24h,
      reporterId: req.user.userId,
    });
    res.status(created ? 201 : 200).json({ ok: true, duplicate: !created });
  } catch (error) {
    console.error('Error reporting session claim:', error);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

export default router;
