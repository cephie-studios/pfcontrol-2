import { createElement } from 'react';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import type { PublicPilotProfile } from '../services/publicPilotProfile.js';
import {
  ProfileOgCard,
  type OgLinkItem,
  type OgStatItem,
  type ProfileOgCardProps,
} from './ProfileOgCard.js';
import { getInterFontsForSatori } from './loadInterFonts.js';

const OG_W = 1200;
const OG_H = 630;

const TRANSPARENT_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function dataUrlToBuffer(dataUrl: string): Buffer {
  const comma = dataUrl.indexOf(',');
  return Buffer.from(dataUrl.slice(comma + 1), 'base64');
}

async function toSatoriSafeDataUrl(
  dataUrl: string | null
): Promise<string | null> {
  if (!dataUrl) return null;
  const needsConvert =
    dataUrl.startsWith('data:image/webp') ||
    dataUrl.startsWith('data:image/avif') ||
    dataUrl.startsWith('data:image/svg+xml');
  if (!needsConvert) return dataUrl;
  try {
    const pngBuf = await sharp(dataUrlToBuffer(dataUrl)).png().toBuffer();
    return `data:image/png;base64,${pngBuf.toString('base64')}`;
  } catch {
    return null;
  }
}

function discordDefaultAvatarUrl(userId: string): string {
  try {
    const idx = Number((BigInt(userId) >> 22n) % 6n);
    return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
  } catch {
    return 'https://cdn.discordapp.com/embed/avatars/0.png';
  }
}

function toPlainText(s: string): string {
  return s
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1).trimEnd()}…`;
}

function getStat(stats: Record<string, unknown>, key: string): number | null {
  const val = stats?.[key];
  if (typeof val === 'number') return val;
  if (typeof val === 'object' && val !== null) {
    const nested = (val as Record<string, unknown>)['total'];
    if (typeof nested === 'number') return nested;
  }
  return null;
}

function formatTimeControlling(rawMins: number | null): string {
  if (rawMins === null) return '—';
  const mins = Math.floor(rawMins);
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const rem = mins % 60;
    return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
  }
  return `${mins}m`;
}

function formatMemberSinceLabel(dateStr: string): string {
  try {
    const formatted = new Date(dateStr).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
    return `Member since ${formatted}`;
  } catch {
    return `Member since ${dateStr}`;
  }
}

function buildMetaLine(
  roles: PublicPilotProfile['user']['roles'],
  memberSinceLabel: string
): string | null {
  const roleNames =
    roles
      ?.map((r) => r.name)
      .filter(Boolean)
      .join(', ') ?? '';
  const parts = [roleNames || null, memberSinceLabel].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}

export async function fetchUrlAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || 'image/png';
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:${contentType};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

export async function fetchAvatarDataUrl(
  profile: PublicPilotProfile
): Promise<string> {
  const { id, avatar } = profile.user;
  const url = avatar
    ? `https://cdn.discordapp.com/avatars/${id}/${avatar}.png?size=256`
    : discordDefaultAvatarUrl(id);
  const data = await fetchUrlAsDataUrl(url);
  const safe = await toSatoriSafeDataUrl(data);
  if (safe) return safe;
  return TRANSPARENT_PNG_DATA_URL;
}

export function buildProfileOgCardProps(
  profile: PublicPilotProfile,
  avatarDataUrl: string,
  backgroundDataUrl: string | null
): ProfileOgCardProps {
  const { user, privacySettings } = profile;
  const plainBio = user.bio ? toPlainText(user.bio) : '';
  const bioSnippet = plainBio ? truncate(plainBio, 100) : null;
  const memberSinceLabel = formatMemberSinceLabel(user.member_since);
  const metaLine = buildMetaLine(user.roles, memberSinceLabel);

  const sessionsN = privacySettings.displayPilotStatsOnProfile
    ? getStat(user.statistics, 'total_sessions_created')
    : null;
  const flightsN = privacySettings.displayPilotStatsOnProfile
    ? getStat(user.statistics, 'total_flights_submitted')
    : null;
  const ctrlMins = privacySettings.displayPilotStatsOnProfile
    ? getStat(user.statistics, 'total_time_controlling_minutes')
    : null;

  const stats: OgStatItem[] = [];
  if (sessionsN != null) {
    stats.push({
      value: sessionsN.toLocaleString('en-US'),
      label: 'Sessions',
    });
  }
  if (flightsN != null) {
    stats.push({
      value: flightsN.toLocaleString('en-US'),
      label: 'Flights',
    });
  }
  if (ctrlMins != null) {
    stats.push({
      value: formatTimeControlling(ctrlMins),
      label: 'ATC Time',
    });
  }

  const links: OgLinkItem[] = [];
  if (privacySettings.displayLinkedAccountsOnProfile) {
    if (user.roblox_username) {
      links.push({ platform: 'Roblox', detail: user.roblox_username });
    }
    if (user.vatsim_cid) {
      links.push({
        platform: 'VATSIM',
        detail: user.vatsim_rating_short ?? user.vatsim_cid,
      });
    }
  }

  let rating: ProfileOgCardProps['rating'] = null;
  if (
    privacySettings.displayControllerRatingOnProfile &&
    user.rating &&
    user.rating.ratingCount > 0
  ) {
    rating = {
      score: user.rating.averageRating.toFixed(1),
      reviewCount: user.rating.ratingCount,
    };
  }

  return {
    username: user.username,
    bioSnippet,
    metaLine,
    teamBadge: user.is_admin ? 'PFControl Team' : null,
    stats,
    links,
    rating,
    avatarDataUrl,
    backgroundDataUrl,
  };
}

export async function renderPublicProfileOgPng(
  profile: PublicPilotProfile,
  avatarDataUrl: string,
  backgroundDataUrl: string | null
): Promise<Buffer> {
  const fonts = await getInterFontsForSatori();
  const safeAvatar =
    (await toSatoriSafeDataUrl(avatarDataUrl)) ?? TRANSPARENT_PNG_DATA_URL;
  const safeBackground = await toSatoriSafeDataUrl(backgroundDataUrl);
  const props = buildProfileOgCardProps(profile, safeAvatar, safeBackground);
  const svg = await satori(createElement(ProfileOgCard, props), {
    width: OG_W,
    height: OG_H,
    fonts,
  });

  const resvg = new Resvg(svg, {
    fitTo: {
      mode: 'width',
      value: OG_W,
    },
  });
  const pngData = resvg.render();
  return Buffer.from(pngData.asPng());
}