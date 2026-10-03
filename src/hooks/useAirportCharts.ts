import { useCallback, useEffect, useState } from 'react';
import { getChartsForAirport as getBundledCharts } from '../utils/acars';
import {
  fetchCelesbitCharts,
  type CelesbitChartIndex,
} from '../utils/fetch/charts';
import {
  fromBundled,
  fromCelesbit,
  type ChartEntry,
} from '../utils/chartCatalog';

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

  const getLocalCharts = useCallback(
    (icao: string): ChartEntry[] => {
      const code = icao.toUpperCase();
      return [
        ...getBundledCharts(code).map((chart) => fromBundled(code, chart)),
        ...(index?.[code] ?? []).map((plate) => fromCelesbit(code, plate)),
      ];
    },
    [index]
  );

  return { getLocalCharts };
}
