import { useEffect, useState } from 'react';
import { clientApiUrl } from '../utils/clientApiBase';
import type { ChartSourceState } from '../utils/fetch/admin/billing';

const ALL_ON: ChartSourceState = {
  pfatc: true,
  cephie: true,
  celesbit: true,
  chartfox: true,
};

let request: Promise<ChartSourceState> | null = null;

function loadSources() {
  request ??= fetch(clientApiUrl('/api/charts/sources'))
    .then((res) => (res.ok ? res.json() : { sources: ALL_ON }))
    .then((data: { sources?: Partial<ChartSourceState> }) => ({
      ...ALL_ON,
      ...data.sources,
    }))
    .catch(() => {
      request = null;
      return ALL_ON;
    });
  return request;
}

export function useChartSources() {
  const [sources, setSources] = useState<ChartSourceState | null>(null);
  useEffect(() => {
    let cancelled = false;
    void loadSources().then((state) => {
      if (!cancelled) setSources(state);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return sources;
}
