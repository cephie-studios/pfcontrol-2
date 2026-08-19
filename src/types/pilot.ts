import type { ProfileSectionConfig } from './settings';

export interface Role {
  id: number;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  priority: number;
}

export interface ResolvedProfileCustomization {
  accentColor: string | null;
  backgroundColor: string | null;
  cardColor: string | null;
  bannerTintColor: string | null;
  bannerTintOpacity: number;
  hiddenRoleIds: number[];
  hiddenStatIds: string[];
  sectionOrder: ProfileSectionConfig[];
}

export interface PilotProfile {
  user: {
    id: string;
    username: string;
    discriminator: string;
    avatar: string | null;
    roblox_username: string | null;
    roblox_user_id?: string | null;
    vatsim_cid: string | null;
    vatsim_rating_short: string | null;
    vatsim_rating_long: string | null;
    member_since: string;
    is_admin: boolean;
    roles: Role[];
    role_name: string | null;
    role_description: string | null;
    bio: string;
    statistics: Record<string, unknown>;
    rating: {
      averageRating: number;
      ratingCount: number;
    } | null;
    background_image?: {
      selectedImage?: string;
      useCustomBackground?: boolean;
      favorites?: string[];
    } | null;
  };
  privacySettings: {
    displayControllerRatingOnProfile: boolean;
    displayLinkedAccountsOnProfile: boolean;
    displayBackgroundOnProfile: boolean;
    displayBioOnProfile: boolean;
  };
  profileCustomization: ResolvedProfileCustomization | null;
  featuredFlights?: FeaturedFlight[];
}

export interface FeaturedFlight {
  id: string;
  callsign?: string;
  departure?: string;
  arrival?: string;
  aircraft?: string;
  status?: string;
  snap_images: Array<{ cephie_id: string; url: string }>;
  created_at?: string;
}
