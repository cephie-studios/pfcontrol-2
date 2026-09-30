import { useCallback, useEffect, useMemo, useState } from 'react';
import { getChartsForAirport as getBundledCharts } from '../utils/acars';
import {
  celesbitPlateUrl,
  fetchCelesbitCharts,
  type CelesbitChartIndex,
} from '../utils/fetch/charts';

export interface ChartEntry {
  name: string;
  path: string;
  type: string;
  credits?: string;
  procedures?: string[];
}

const BUNDLED_CHART_AIRPORTS = [
  'EGCK',
  'EGFF',
  'EGHC',
  'EGHJ',
  'EGKK',
  'EGLC',
  'LCLK',
  'LCPH',
  'LCRA',
  'LPMA',
  'MDAB',
  'MDPC',
  'MDST',
  'MTCA',
  'PAFA',
  'X2BH',
];

const KIND_ORDER = ['GND', 'DEP', 'ARR', 'APP'];

let indexPromise: Promise<CelesbitChartIndex | null> | null = null;

function loadIndex() {
  if (!indexPromise) {
    indexPromise = fetchCelesbitCharts().then((index) => {
      if (!index) indexPromise = null;
      return index;
    });
  }
  return indexPromise;
}

function kindRank(kind: string) {
  const rank = KIND_ORDER.indexOf(kind);
  return rank === -1 ? KIND_ORDER.length : rank;
}

export function useAirportCharts() {
  const [index, setIndex] = useState<CelesbitChartIndex | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadIndex().then((result) => {
      if (!cancelled) setIndex(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const getChartsForAirport = useCallback(
    (icao: string): ChartEntry[] => {
      const code = icao.toUpperCase();
      const plates = index?.[code];
      if (!plates?.length) return getBundledCharts(code);

      return [...plates]
        .sort((a, b) => kindRank(a.kind) - kindRank(b.kind))
        .map((plate) => ({
          name: plate.label,
          path: celesbitPlateUrl(code, plate.file),
          type: plate.kindLabel,
          credits: '© Gavin Ostler',
          // Lets "BPK1H" match a plate labelled "BPK 1H".
          procedures: [plate.label.replace(/\s+/g, '')],
        }));
    },
    [index]
  );

  const availableAirports = useMemo(
    () =>
      Array.from(
        new Set([...BUNDLED_CHART_AIRPORTS, ...Object.keys(index ?? {})])
      ).sort(),
    [index]
  );

  return { getChartsForAirport, availableAirports };
}
