import { createElement } from 'react';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import type { PublicSubmitSession } from '../services/publicSubmitSession.js';
import { SubmitOgCard, type SubmitOgCardProps } from './SubmitOgCard.js';
import { getInterFontsForSatori } from './loadInterFonts.js';
import { loadOgSessionIcons } from './ogSessionIcons.js';
import {
  fetchUrlAsDataUrl,
  toSatoriSafeDataUrl,
} from './renderProfileOgPng.js';

const OG_W = 1200;
const OG_H = 630;

const TRANSPARENT_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

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
  backgroundDataUrl: string | null,
  icons: Awaited<ReturnType<typeof loadOgSessionIcons>>
): SubmitOgCardProps {
  const icao = session.airportIcao?.toUpperCase() ?? '----';
  const runway = session.activeRunway?.trim();
  const controller = session.controllerUsername?.trim();
  const atisLetter = session.atisLetter?.trim();
  const atisText = session.atisText?.replace(/\s+/g, ' ').trim();
  const flightsN = session.flightCount ?? 0;

  const details: SubmitOgCardProps['details'] = [];

  if (runway) {
    details.push({
      iconDataUrl: icons.runway,
      label: 'Active runway',
      value: runway,
    });
  }

  if (atisLetter) {
    details.push({
      iconDataUrl: icons.atis,
      label: 'ATIS',
      value: atisLetter,
    });
  }

  details.push({
    iconDataUrl: icons.flights,
    label: 'Flights',
    value:
      flightsN === 1
        ? '1 on board'
        : `${flightsN.toLocaleString('en-US')} on board`,
  });

  if (controller) {
    details.push({
      label: 'Controller',
      value: controller,
    });
  }

  const atisSnippet = atisText
    ? truncate(
        atisLetter ? `Information ${atisLetter}: ${atisText}` : atisText,
        140
      )
    : null;

  return {
    airportIcao: icao,
    networkLabel: networkLabel(session),
    atisSnippet,
    atisLetter: atisLetter ?? null,
    details,
    backgroundDataUrl,
  };
}

export async function renderPublicSubmitOgPng(
  session: PublicSubmitSession,
  backgroundDataUrl: string | null
): Promise<Buffer> {
  const fonts = await getInterFontsForSatori();
  const icons = await loadOgSessionIcons();
  const safeBackground = await toSatoriSafeDataUrl(backgroundDataUrl);
  const props = buildSubmitOgCardProps(session, safeBackground, icons);

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