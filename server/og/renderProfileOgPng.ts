import { createElement } from 'react';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import type { PublicPilotProfile } from '../services/publicPilotProfile.js';
import { ProfileOgCard, type ProfileOgCardProps } from './ProfileOgCard.js';
import { getInterFontsForSatori } from './loadInterFonts.js';

const OG_W = 1200;
const OG_H = 630;

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

function formatMemberSinceShort(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
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
  profile: PublicPilotProfile,
  frontendBase: string
): Promise<string> {
  const base = frontendBase.replace(/\/$/, '');
  const { id, avatar } = profile.user;
  const url = avatar
    ? `https://cdn.discordapp.com/avatars/${id}/${avatar}.png?size=256`
    : `${base}/assets/app/default/avatar.webp`;
  const data = await fetchUrlAsDataUrl(url);
  if (data) return data;
  const transparent =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  return transparent;
}

export function buildProfileOgCardProps(
  profile: PublicPilotProfile,
  avatarDataUrl: string,
  backgroundDataUrl: string | null
): ProfileOgCardProps {
  const { user, privacySettings } = profile;
  const plainBio = user.bio ? toPlainText(user.bio) : '';
  const bioSnippet = plainBio ? truncate(plainBio, 140) : null;
  const rolesText =
    user.roles?.length > 0
      ? user.roles
          .map((r) => r.name)
          .filter(Boolean)
          .join(', ')
      : null;

  const sessionsN = privacySettings.displayPilotStatsOnProfile
    ? getStat(user.statistics, 'total_sessions_created')
    : null;
  const flightsN = privacySettings.displayPilotStatsOnProfile
    ? getStat(user.statistics, 'total_flights_submitted')
    : null;
  const ctrlMins = privacySettings.displayPilotStatsOnProfile
    ? getStat(user.statistics, 'total_time_controlling_minutes')
    : null;

  const statsBits: string[] = [];
  if (sessionsN != null)
    statsBits.push(`${sessionsN.toLocaleString('en-US')} sessions`);
  if (flightsN != null)
    statsBits.push(`${flightsN.toLocaleString('en-US')} flights`);
  if (ctrlMins != null)
    statsBits.push(`${formatTimeControlling(ctrlMins)} ATC`);
  const statsLine = statsBits.length > 0 ? statsBits.join(' · ') : null;

  const linkBits: string[] = [];
  if (privacySettings.displayLinkedAccountsOnProfile) {
    if (user.roblox_username) linkBits.push(`Roblox ${user.roblox_username}`);
    if (user.vatsim_cid) {
      linkBits.push(
        user.vatsim_rating_short
          ? `VATSIM ${user.vatsim_rating_short}`
          : `VATSIM ${user.vatsim_cid}`
      );
    }
  }
  const linksLine = linkBits.length > 0 ? linkBits.join(' · ') : null;

  let ratingLine: string | null = null;
  if (
    privacySettings.displayControllerRatingOnProfile &&
    user.rating &&
    user.rating.ratingCount > 0
  ) {
    ratingLine = `Controller ${user.rating.averageRating.toFixed(1)}/5 · ${user.rating.ratingCount} reviews`;
  }

  return {
    username: user.username,
    bioSnippet,
    rolesLine: rolesText,
    memberSinceShort: formatMemberSinceShort(user.member_since),
    isAdmin: user.is_admin,
    statsLine,
    linksLine,
    ratingLine,
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
  const props = buildProfileOgCardProps(
    profile,
    avatarDataUrl,
    backgroundDataUrl
  );
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