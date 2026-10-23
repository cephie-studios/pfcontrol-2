import { useCallback, useEffect, useState } from 'react';
import { getChartsForAirport as getBundledCharts } from '../utils/acars';
import {
  fetchCelesbitCharts,
  fetchCephieCharts,
  type CelesbitChartIndex,
  type CephieChartIndex,
} from '../utils/fetch/charts';
import { useChartSources } from './useChartSources';
import {
  fromBundled,
  fromCelesbit,
  fromCephie,
  type ChartEntry,
} from '../utils/chartCatalog';

function cachedLoader<T>(load: () => Promise<T | null>) {
  let promise: Promise<T | null> | null = null;
  return () => {
    if (!promise) {
      promise = load().then((result) => {
        if (!result) promise = null;
        return result;
      });
    }
    return promise;
  };
}

const loadIndex = cachedLoader<CelesbitChartIndex>(fetchCelesbitCharts);
const loadCephieIndex = cachedLoader<CephieChartIndex>(fetchCephieCharts);

export function useAirportCharts() {
  const [index, setIndex] = useState<CelesbitChartIndex | null>(null);
  const [cephieIndex, setCephieIndex] = useState<CephieChartIndex | null>(null);
  const sources = useChartSources();

  useEffect(() => {
    let cancelled = false;
    loadIndex().then((result) => {
      if (!cancelled) setIndex(result);
    });
    loadCephieIndex().then((result) => {
      if (!cancelled) setCephieIndex(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const getLocalCharts = useCallback(
    (icao: string): ChartEntry[] => {
      if (!sources) return [];
      const code = icao.toUpperCase();
      return [
        ...(sources.pfatc ? getBundledCharts(code) : []).map((chart) =>
          fromBundled(code, chart)
        ),
        ...((sources.cephie && cephieIndex?.[code]) || []).map((chart) =>
          fromCephie(code, chart)
        ),
        ...((sources.celesbit && index?.[code]) || []).map((plate) =>
          fromCelesbit(code, plate)
        ),
      ];
    },
    [index, cephieIndex, sources]
  );

  return { getLocalCharts };
}
