import { createElement } from 'react';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import type { PublicSubmitSession } from '../services/publicSubmitSession.js';
import { SubmitOgCard, type SubmitOgCardProps } from './SubmitOgCard.js';
import { getInterFontsForSatori } from './loadInterFonts.js';
import { toSatoriSafeDataUrl } from './renderProfileOgPng.js';

const OG_W = 1200;
const OG_H = 630;

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1).trimEnd()}…`;
}

function networkLabel(session: PublicSubmitSession): string {
  if (session.isPFATC) return 'PFATC';
  if (session.isAdvancedATC) return 'Advanced ATC';
  return 'ATC';
}

export function buildSubmitOgCardProps(
  session: PublicSubmitSession,
  backgroundDataUrl: string | null
): SubmitOgCardProps {
  const icao = session.airportIcao?.toUpperCase() ?? '----';
  const runway = session.activeRunway?.trim();
  const controller = session.controllerUsername?.trim();
  const atisLetter = session.atisLetter?.trim();
  const atisText = session.atisText?.replace(/\s+/g, ' ').trim();
  const flightsN = session.flightCount ?? 0;

  const stats: SubmitOgCardProps['stats'] = [];

  if (runway) {
    stats.push({
      label: 'Active runway',
      value: runway,
    });
  }

  if (atisLetter) {
    stats.push({
      label: 'ATIS',
      value: atisLetter,
    });
  }

  stats.push({
    label: 'Flights',
    value: flightsN.toLocaleString('en-US'),
  });

  if (controller) {
    stats.push({
      label: 'Controller',
      value: controller,
    });
  }

  const atisSnippet = atisText
    ? truncate(atisLetter ? `INFO ${atisLetter}: ${atisText}` : atisText, 140)
    : null;

  return {
    airportIcao: icao,
    networkLabel: networkLabel(session),
    atisSnippet,
    stats,
    backgroundDataUrl,
  };
}

export async function renderPublicSubmitOgPng(
  session: PublicSubmitSession,
  backgroundDataUrl: string | null
): Promise<Buffer> {
  const fonts = await getInterFontsForSatori();
  const safeBackground = await toSatoriSafeDataUrl(backgroundDataUrl);
  const props = buildSubmitOgCardProps(session, safeBackground);

  const svg = await satori(createElement(SubmitOgCard, props), {
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