import { mainDb } from './connection.js';
import { DEPLOYMENT } from '../utils/cacheTtl.js';

export interface SiteSettings {
  feedbackBannerEnabled: boolean;
  externalAcarsLegacyRedirect: boolean;
}

export async function getSiteSettings(): Promise<SiteSettings> {
  const row = await mainDb
    .selectFrom('app_settings')
    .select(['feedback_banner_enabled', 'external_acars_legacy_redirect'])
    .where('channel', '=', DEPLOYMENT)
    .executeTakeFirst();
  return {
    feedbackBannerEnabled: row?.feedback_banner_enabled ?? false,
    externalAcarsLegacyRedirect: row?.external_acars_legacy_redirect ?? true,
  };
}

export async function updateSiteSettings(
  updates: Partial<SiteSettings>
): Promise<SiteSettings> {
  const set: {
    feedback_banner_enabled?: boolean;
    external_acars_legacy_redirect?: boolean;
  } = {};
  if (typeof updates.feedbackBannerEnabled === 'boolean') {
    set.feedback_banner_enabled = updates.feedbackBannerEnabled;
  }
  if (typeof updates.externalAcarsLegacyRedirect === 'boolean') {
    set.external_acars_legacy_redirect = updates.externalAcarsLegacyRedirect;
  }
  if (Object.keys(set).length > 0) {
    await mainDb
      .updateTable('app_settings')
      .set(set)
      .where('channel', '=', DEPLOYMENT)
      .execute();
  }
  return getSiteSettings();
}
