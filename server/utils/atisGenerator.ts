// text-only port of AtisGenerator from https://github.com/VMGWARE/vATCSuite (Apache-2.0)
import { getAirportData } from './getData.js';
import { resolveAviationMetar } from './metarAviationWeather.js';

const WEATHER_CODES: Record<string, string> = {
  VA: 'volcanic ash',
  HZ: 'haze',
  DU: 'dust',
  SA: 'sand',
  BLDU: 'blowing dust',
  BLSA: 'blowing sand',
  PO: 'dust whirls',
  SS: 'sand storm',
  BR: 'mist',
  TS: 'thunderstorm',
  SQ: 'squall',
  FC: 'funnel cloud or tornado',
  BLSN: 'blowing snow',
  DRSN: 'drifting snow',
  FG: 'fog',
  BC: 'patchy fog',
  FZFG: 'freezing fog',
  DZ: 'drizzle',
  FZDZ: 'freezing drizzle',
  DZRA: 'drizzle and rain',
  RA: 'rain',
  FZRA: 'freezing rain',
  RASN: 'rain and snow mix',
  SN: 'snow',
  SG: 'snow grains',
  IC: 'ice crystals',
  PE: 'ice pellets',
  PL: 'ice pellets',
  SHRA: 'rain showers',
  SHRASN: 'rain and snow showers',
  SHSN: 'snow showers',
  GR: 'hail',
  TSRA: 'thunderstorm with rain',
  TSGR: 'thunderstorm with hail',
};

const SKY_COVER: Record<string, string> = {
  BKN: 'broken',
  CLR: 'sky clear',
  FEW: 'few clouds',
  NCD: 'no clouds detected',
  OVC: 'overcast',
  SCT: 'scattered clouds',
  SKC: 'sky clear',
};

const SKY_TYPE: Record<string, string> = {
  CB: 'cumulonimbus',
  TCU: 'towering cumulus',
};

const ZULU_RE = /^([0-9]{2})([0-9]{4})(Z)$/;
const WIND_RE = /^([0-9]{3}|VRB)([0-9]{2,3})(G([0-9]{2,3}))?KT$/;
const WIND_VARIABLE_RE = /^([0-9]{3})V([0-9]{3})$/;
const VISIBILITY_RE =
  /^(CAVOK|\/\/\/\/|([0-9]{4})|([0-9]{1,2})(SM)?|(M)?(([1357])\/(2|4|8|16)SM))$/;
const WEATHER_RE = new RegExp(
  `^([-+])?(VC)?(${Object.keys(WEATHER_CODES).join('|')})$`
);
const VERTICAL_VISIBILITY_RE = /^(VV)([0-9]{3})$/;
const SKY_COVER_RE = new RegExp(
  `^(${Object.keys(SKY_COVER).join('|')})([0-9]{3})?(${Object.keys(SKY_TYPE).join('|')})?$`
);
const TEMPERATURE_RE = /^(M)?([0-9]{2})\/(M)?([0-9]{2})$/;
const PRESSURE_RE = /^(A|Q)([0-9]{4})$/;

export interface AtisTextInput {
  stationName: string;
  ident: string;
  metar: string;
  landingRunways: string[];
  departingRunways: string[];
  remarks?: string;
}

export function generateAtisText(input: AtisTextInput): string {
  const parts = new Map<string, string | string[]>();
  const list = (key: string): string[] => {
    let value = parts.get(key);
    if (!Array.isArray(value)) {
      value = [];
      parts.set(key, value);
    }
    return value;
  };
  let ceiling = true;

  parts.set('station_info', `${input.stationName} information ${input.ident}`);

  for (const part of input.metar.trim().split(/\s+/)) {
    const afterPressure = parts.has('pressure');
    let m: RegExpMatchArray | null;

    if (!afterPressure && (m = part.match(ZULU_RE))) {
      parts.set('zulu_time', m[2] + m[3]);
    }

    if (!afterPressure && (m = part.match(WIND_RE))) {
      const winds = list('winds');
      if (m[1] === 'VRB') {
        winds.push(`wind variable at ${m[2]}`);
      } else if (m[1] === '000' || parseInt(m[2], 10) < 3) {
        winds.push('wind calm');
      } else if (m[3]) {
        winds.push(`wind ${m[1]} at ${parseInt(m[2], 10)}`);
        winds.push(`gusting ${m[4]} knots`);
      } else {
        winds.push(`wind ${m[1]} at ${parseInt(m[2], 10)} knots`);
      }
    }

    if (!afterPressure && (m = part.match(WIND_VARIABLE_RE))) {
      list('winds').push(`variable between ${m[1]} and ${m[2]} degrees`);
    }

    if (!parts.has('visibility') && (m = part.match(VISIBILITY_RE))) {
      if (m[1] === 'CAVOK') {
        parts.set('visibility', 'CAVOK');
      } else if (m[2]) {
        const meters = parseInt(m[2], 10);
        if (meters < 1000) {
          parts.set('visibility', `visibility ${meters} meters`);
        } else {
          const suffix = meters < 1500 ? ' kilometer' : ' kilometers';
          const modifier = meters === 9999 ? ' or more' : '';
          parts.set(
            'visibility',
            `visibility ${Math.round(meters / 1000)}${modifier}${suffix}`
          );
        }
      } else if (m[3]) {
        const miles = parseInt(m[3], 10);
        const suffix = miles === 1 ? ' mile' : ' miles';
        const modifier = miles === 10 ? ' or more' : '';
        parts.set('visibility', `visibility ${m[3]}${modifier}${suffix}`);
      } else if (m[6]) {
        parts.set('visibility', 'visibility less than one mile');
      }
    }

    if (!afterPressure && (m = part.match(WEATHER_RE))) {
      const severity = m[1] ? (m[1] === '-' ? 'light ' : 'heavy ') : '';
      const proximity = m[2] ? ' in vicinity' : '';
      list('weather').push(severity + WEATHER_CODES[m[3]] + proximity);
    }

    if (
      !parts.has('vertical_visibility') &&
      (m = part.match(VERTICAL_VISIBILITY_RE))
    ) {
      parts.set(
        'vertical_visibility',
        `vertical visibility ${parseInt(m[2], 10) * 100} feet`
      );
    }

    if (!afterPressure && (m = part.match(SKY_COVER_RE))) {
      const cover = m[1];
      if (cover === 'NCD' || cover === 'CLR' || cover === 'SKC') {
        parts.set('sky_cover', [SKY_COVER[cover]]);
      } else {
        const height = parseInt(m[2] ?? '0', 10) * 100;
        const layers = list('sky_cover');
        if (cover === 'BKN' || cover === 'OVC') {
          if (ceiling) {
            layers.push(`ceiling ${height} ${SKY_COVER[cover]}`);
            ceiling = false;
          } else {
            layers.push(`${SKY_COVER[cover]} sky at ${height}`);
          }
        } else {
          const type = m[3] ? ` ${SKY_TYPE[m[3]]}` : '';
          layers.push(`${SKY_COVER[cover]} at ${height}${type}`);
        }
      }
    }

    if (
      !parts.has('temperature_dewpoint') &&
      (m = part.match(TEMPERATURE_RE))
    ) {
      parts.set('temperature_dewpoint', [
        `temperature ${m[1] ? 'minus ' : ''}${parseInt(m[2], 10)}`,
        `dewpoint ${m[3] ? 'minus ' : ''}${parseInt(m[4], 10)}`,
      ]);
    }

    if (!afterPressure && (m = part.match(PRESSURE_RE))) {
      const value = parseInt(m[2], 10);
      if (m[1] === 'A') {
        const qnh = Math.round(Number((value / 100).toFixed(2)) * 33.86389);
        parts.set('pressure', [`altimeter ${m[2]}`, `qnh ${qnh}`]);
      } else {
        const inhg = Math.round((value * 100) / 33.86);
        parts.set('pressure', [`qnh ${m[2]}`, `altimeter ${inhg}`]);
      }
    }
  }

  const { landingRunways, departingRunways } = input;
  const sameRunways =
    landingRunways.length === departingRunways.length &&
    landingRunways.every((runway, i) => runway === departingRunways[i]);
  if (sameRunways) {
    const runways = [...new Set(landingRunways)];
    const prefix =
      runways.length === 1
        ? 'landing and departing runway '
        : 'landing and departing runways ';
    parts.set('runways', prefix + runways.join(', '));
  } else {
    parts.set(
      'landing_runways',
      (landingRunways.length === 1 ? 'landing runway ' : 'landing runways ') +
        landingRunways.join(', ')
    );
    parts.set(
      'departing_runways',
      (departingRunways.length === 1
        ? 'departing runway '
        : 'departing runways ') + departingRunways.join(', ')
    );
  }

  if (input.remarks) {
    parts.set('remarks1', input.remarks);
  }

  parts.set(
    'ident_end',
    `advise controller on initial contact that you have information ${input.ident}`
  );

  return [...parts.values()]
    .map((value) =>
      `${(Array.isArray(value) ? value.join(', ') : value).toUpperCase()}... `.replace(
        /\s+/g,
        ' '
      )
    )
    .join(' ');
}

export interface GenerateAtisInput {
  icao: string;
  ident: string;
  landingRunways: string[];
  departingRunways: string[];
  remarks?: string;
  metar?: string;
}

export async function generateAtis(input: GenerateAtisInput): Promise<string> {
  const icao = input.icao.trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9]{3}$/.test(icao)) {
    throw new Error('Invalid ICAO code.');
  }
  if (!/^[A-Za-z]+$/.test(input.ident)) {
    throw new Error('You must provide an ATIS identifier.');
  }

  let metar = input.metar?.trim();
  if (!metar) {
    const result = await resolveAviationMetar(icao);
    const rawOb = result.ok ? result.body.rawOb : undefined;
    if (typeof rawOb !== 'string' || !rawOb.trim()) {
      throw new Error(`Could not find METAR data for ${icao}.`);
    }
    metar = rawOb;
  }

  const airport = (
    getAirportData() as { icao: string; name?: string; controlName?: string }[]
  ).find((a) => a.icao === icao);

  return generateAtisText({
    stationName: airport?.controlName || airport?.name || icao,
    ident: input.ident.toUpperCase(),
    metar,
    landingRunways: input.landingRunways,
    departingRunways: input.departingRunways,
    remarks: input.remarks,
  });
}
