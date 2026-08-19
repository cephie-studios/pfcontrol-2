import { getUserByUsername } from '../db/users.js';
import {getUserById} from '../db/users.js';
import { mainDb } from '../db/connection.js';
import { isAdmin } from '../middleware/admin.js';
import { getControllerRatingStats } from '../db/ratings.js';
import { getFeaturedFlightsByUser } from '../db/flights.js';

export interface ProfileSectionConfig {
  key: 'stats' | 'featuredFlights';
  visible: boolean;
}

export interface PublicPilotProfile {
  user: {
    id: string;
    username: string;
    discriminator: string;
    avatar: string | null;
    roblox_username: string | null;
    roblox_user_id: string | null;
    vatsim_cid: string | null;
    vatsim_rating_short: string | null;
    vatsim_rating_long: string | null;
    member_since: string;
    is_admin: boolean;
    roles: Array<{
      id: number;
      name: string;
      description: string | null;
      color: string;
      icon: string;
      priority: number;
    }>;
    role_name: string | null;
    role_description: string | null;
    bio: string;
    statistics: Record<string, unknown>;
    rating: { averageRating: number; ratingCount: number } | null;
    background_image: unknown;
  };
  privacySettings: {
    displayControllerRatingOnProfile: boolean;
    displayLinkedAccountsOnProfile: boolean;
    displayBackgroundOnProfile: boolean;
    displayBioOnProfile: boolean;
  };
  profileCustomization: {
    accentColor: string | null;
    backgroundColor: string | null;
    cardColor: string | null;
    bannerTintColor: string | null;
    bannerTintOpacity: number;
    hiddenRoleIds: number[];
    hiddenStatIds: string[];
    sectionOrder: ProfileSectionConfig[];
  };
  featuredFlights: unknown[];
}

const KNOWN_SECTION_KEYS: ProfileSectionConfig['key'][] = ['stats', 'featuredFlights'];

function resolveSectionOrder(
  settings: Record<string, unknown> | undefined | null
): ProfileSectionConfig[] {
  const stored = (
    settings?.profileCustomization as { sectionOrder?: unknown } | undefined
  )?.sectionOrder;
  if (Array.isArray(stored)) {
    const known = (stored as ProfileSectionConfig[]).filter((s) =>
      KNOWN_SECTION_KEYS.includes(s?.key)
    );
    if (known.length > 0) return known;
  }
  return [
    { key: 'stats', visible: (settings?.displayStatsOnProfile as boolean) ?? true },
    { key: 'featuredFlights', visible: true },
  ];
}

export async function getPublicPilotProfile(
  username: string | undefined,
  viewerId?: string
): Promise<PublicPilotProfile | null> {
  if (!username) return null;

  let userResult = await getUserByUsername(username);
  const userData = await getUserById(username);

  if (!userResult && !userData) {
    return null;
  }
  if (!userResult && userData) {
    userResult = userData;
  }

  const isOwner = !!viewerId && viewerId === userResult.id;


  const rolesResult = await mainDb
    .selectFrom('roles as r')
    .innerJoin('user_roles as ur', 'ur.role_id', 'r.id')
    .select([
      'r.id',
      'r.name',
      'r.description',
      'r.color',
      'r.icon',
      'r.priority',
    ])
    .where('ur.user_id', '=', userResult.id)
    .orderBy('r.priority', 'desc')
    .orderBy('r.created_at', 'desc')
    .execute();

  const roles: PublicPilotProfile['user']['roles'] = rolesResult.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description ?? null,
    color: r.color ?? '',
    icon: r.icon ?? '',
    priority: r.priority ?? 0,
  }));

  const privacySettings = {
    displayControllerRatingOnProfile:
      userResult.settings?.displayControllerRatingOnProfile ?? true,
    displayLinkedAccountsOnProfile:
      userResult.settings?.displayLinkedAccountsOnProfile ?? true,
    displayBackgroundOnProfile:
      userResult.settings?.displayBackgroundOnProfile ?? true,
    displayBioOnProfile: userResult.settings?.displayBioOnProfile ?? true,
  };

  const resolvedSectionOrder = resolveSectionOrder(userResult.settings);
  const shouldIncludeStats =
    isOwner ||
    (resolvedSectionOrder.find((s) => s.key === 'stats')?.visible ?? true);
  const shouldIncludeFeaturedFlights =
    isOwner ||
    (resolvedSectionOrder.find((s) => s.key === 'featuredFlights')?.visible ??
      true);
  const shouldIncludeLinkedAccounts =
    isOwner || privacySettings.displayLinkedAccountsOnProfile;
  const shouldIncludeBackground =
    isOwner || privacySettings.displayBackgroundOnProfile;
  const shouldIncludeRating =
    isOwner || privacySettings.displayControllerRatingOnProfile;
  const shouldIncludeBio = isOwner || privacySettings.displayBioOnProfile;

  let ratingStats = null;
  if (shouldIncludeRating) {
    ratingStats = await getControllerRatingStats(userResult.id);
  }

  const featuredFlights = shouldIncludeFeaturedFlights
    ? await getFeaturedFlightsByUser(userResult.id)
    : [];

  const customization = userResult.settings?.profileCustomization ?? {};

  return {
    user: {
      id: userResult.id,
      username: userResult.username,
      discriminator: userResult.discriminator,
      avatar: userResult.avatar,
      roblox_username: shouldIncludeLinkedAccounts
        ? userResult.roblox_username
        : null,
      roblox_user_id: shouldIncludeLinkedAccounts
        ? userResult.roblox_user_id
        : null,
      vatsim_cid: shouldIncludeLinkedAccounts ? userResult.vatsim_cid : null,
      vatsim_rating_short: shouldIncludeLinkedAccounts
        ? userResult.vatsim_rating_short
        : null,
      vatsim_rating_long: shouldIncludeLinkedAccounts
        ? userResult.vatsim_rating_long
        : null,
      member_since: userResult.created_at,
      is_admin: isAdmin(userResult.id),
      roles,
      role_name: roles[0]?.name || null,
      role_description: roles[0]?.description ?? null,
      bio: shouldIncludeBio ? userResult.settings?.bio ?? '' : '',
      statistics: shouldIncludeStats ? userResult.statistics || {} : {},
      rating: ratingStats,
      background_image: shouldIncludeBackground
        ? userResult.settings?.backgroundImage
        : null,
    },
    privacySettings,
    profileCustomization: {
      accentColor: customization.accentColor ?? null,
      backgroundColor: customization.backgroundColor ?? null,
      cardColor: customization.cardColor ?? null,
      bannerTintColor: customization.bannerTintColor ?? null,
      bannerTintOpacity: customization.bannerTintOpacity ?? 0,
      hiddenRoleIds: customization.hiddenRoleIds ?? [],
      hiddenStatIds: customization.hiddenStatIds ?? [],
      sectionOrder: resolvedSectionOrder,
    },
    featuredFlights,
  };
}
