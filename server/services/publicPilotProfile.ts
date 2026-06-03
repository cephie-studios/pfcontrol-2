import { getUserByUsername } from '../db/users.js';
import { mainDb } from '../db/connection.js';
import { isAdmin } from '../middleware/admin.js';
import { getControllerRatingStats } from '../db/ratings.js';
import { getFeaturedFlightsByUser } from '../db/flights.js';

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
    displayControllerStatsOnProfile: boolean;
    displayPilotStatsOnProfile: boolean;
    displayControllerRatingOnProfile: boolean;
    displayLinkedAccountsOnProfile: boolean;
    displayBackgroundOnProfile: boolean;
  };
  featuredFlights: unknown[];
}

export async function getPublicPilotProfile(
  username: string | undefined
): Promise<PublicPilotProfile | null> {
  if (!username) return null;

  const userResult = await getUserByUsername(username);

  if (!userResult) {
    return null;
  }

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
    displayControllerStatsOnProfile:
      userResult.settings?.displayControllerStatsOnProfile ?? true,
    displayPilotStatsOnProfile:
      userResult.settings?.displayPilotStatsOnProfile ?? true,
    displayControllerRatingOnProfile:
      userResult.settings?.displayControllerRatingOnProfile ?? true,
    displayLinkedAccountsOnProfile:
      userResult.settings?.displayLinkedAccountsOnProfile ?? true,
    displayBackgroundOnProfile:
      userResult.settings?.displayBackgroundOnProfile ?? true,
  };

  const shouldIncludeStats = privacySettings.displayPilotStatsOnProfile;
  const shouldIncludeLinkedAccounts =
    privacySettings.displayLinkedAccountsOnProfile;
  const shouldIncludeBackground = privacySettings.displayBackgroundOnProfile;
  const shouldIncludeRating = privacySettings.displayControllerRatingOnProfile;

  let ratingStats = null;
  if (shouldIncludeRating) {
    ratingStats = await getControllerRatingStats(userResult.id);
  }

  const featuredFlights = await getFeaturedFlightsByUser(userResult.id);

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
      bio: userResult.settings?.bio ?? '',
      statistics: shouldIncludeStats ? userResult.statistics || {} : {},
      rating: ratingStats,
      background_image: shouldIncludeBackground
        ? userResult.settings?.backgroundImage
        : null,
    },
    privacySettings,
    featuredFlights,
  };
}
