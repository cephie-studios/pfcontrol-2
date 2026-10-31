import express, { type Request } from 'express';
import { requirePermission } from '../../middleware/rolePermissions.js';
import { logAdminAction } from '../../db/audit.js';
import {
  deleteExternalAcarsProvider,
  listExternalAcarsProviders,
  saveExternalAcarsProvider,
  type ExternalAcarsProvider,
} from '../../db/externalAcarsProviders.js';
import { getClientIp } from '../../utils/getIpAddress.js';
import { getSiteSettings, updateSiteSettings } from '../../db/siteSettings.js';
import { resetLegacyExternalAcarsRedirectCache } from '../../utils/externalAcarsPanel.js';

const router = express.Router();
router.use(requirePermission('admin'));

const PROVIDER_ID = /^[a-z0-9][a-z0-9-]{0,31}$/;
const HEADER_NAME = /^[A-Za-z0-9-]{1,100}$/;
const MAX_URL_LENGTH = 2000;
const MAX_NAME_LENGTH = 80;

function isHttpsUrl(value: string): boolean {
  if (!value || value.length > MAX_URL_LENGTH) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseProvider(
  id: string,
  body: Record<string, unknown> | undefined
): ExternalAcarsProvider | null {
  const displayName = text(body?.displayName);
  const apiBaseUrl = text(body?.apiBaseUrl).replace(/\/$/, '');
  const handoffUrl = text(body?.handoffUrl);
  const tokenHeader = text(body?.tokenHeader);
  const handoffApiKey = text(body?.handoffApiKey) || null;

  if (
    !PROVIDER_ID.test(id) ||
    !displayName ||
    displayName.length > MAX_NAME_LENGTH ||
    !isHttpsUrl(apiBaseUrl) ||
    !isHttpsUrl(handoffUrl) ||
    !HEADER_NAME.test(tokenHeader)
  ) {
    return null;
  }

  return {
    id,
    displayName,
    apiBaseUrl,
    tokenHeader,
    handoffUrl,
    handoffApiKey,
    enabled: body?.enabled !== false,
    isDefault: body?.isDefault === true,
  };
}

function audit(req: Request, actionType: string, details: object) {
  return logAdminAction({
    adminId: req.user!.userId,
    adminUsername: req.user!.username || 'Unknown',
    actionType,
    ipAddress: getClientIp(req),
    userAgent: req.get('User-Agent') ?? null,
    details: details as Record<string, unknown>,
  });
}

router.get('/', async (_req, res) => {
  res.setHeader('Cache-Control', 'private, no-store');
  const [providers, settings] = await Promise.all([
    listExternalAcarsProviders(),
    getSiteSettings(),
  ]);
  res.json({ providers, legacyRedirect: settings.externalAcarsLegacyRedirect });
});

router.patch('/legacy-redirect', async (req, res) => {
  const { enabled } = req.body ?? {};
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'enabled must be a boolean' });
  }
  const settings = await updateSiteSettings({
    externalAcarsLegacyRedirect: enabled,
  });
  resetLegacyExternalAcarsRedirectCache();
  await audit(req, 'EXTERNAL_ACARS_MODE_UPDATED', {
    legacyRedirect: settings.externalAcarsLegacyRedirect,
  });
  res.json({ legacyRedirect: settings.externalAcarsLegacyRedirect });
});

router.put('/:id', async (req, res) => {
  const provider = parseProvider(req.params.id, req.body);
  if (!provider) {
    return res.status(400).json({ error: 'Invalid provider configuration' });
  }

  const saved = await saveExternalAcarsProvider(provider, req.user!.userId);
  await audit(req, 'EXTERNAL_ACARS_PROVIDER_SAVED', {
    id: saved.id,
    enabled: saved.enabled,
    isDefault: saved.isDefault,
  });
  res.json({ provider: saved });
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  if (!PROVIDER_ID.test(id) || !(await deleteExternalAcarsProvider(id))) {
    return res.status(404).json({ error: 'Not found' });
  }
  await audit(req, 'EXTERNAL_ACARS_PROVIDER_DELETED', { id });
  res.status(204).end();
});

export default router;
