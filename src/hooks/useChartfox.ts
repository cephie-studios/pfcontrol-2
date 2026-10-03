import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import {
  chartfoxConnectUrl,
  fetchChartfoxAirportCharts,
  fetchChartfoxStatus,
  unlinkChartfox,
  type ChartfoxStatus,
} from '../utils/fetch/charts';
import { fromChartfox, type ChartEntry } from '../utils/chartCatalog';

export const CHARTFOX_CHANNEL = 'pfcontrol-chartfox';

type StatusState = { loaded: boolean; status: ChartfoxStatus | null };

let state: StatusState = { loaded: false, status: null };
let statusPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();
const airportCache = new Map<string, Promise<AirportResult>>();
let linkPopup: Window | null = null;

type AirportResult =
  | { status: 'ok'; charts: ChartEntry[] }
  | { status: 'unlinked' }
  | { status: 'error' };

function setState(next: StatusState) {
  const linkChanged = next.status?.linked !== state.status?.linked;
  state = next;
  if (linkChanged) airportCache.clear();
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function loadStatus(force = false) {
  if (!statusPromise || force) {
    statusPromise = fetchChartfoxStatus().then((status) => {
      setState({ loaded: true, status });
    });
  }
  return statusPromise;
}

function markUnlinked() {
  if (!state.status?.linked) return;
  setState({ loaded: true, status: { ...state.status, linked: false } });
}

if (typeof BroadcastChannel !== 'undefined') {
  new BroadcastChannel(CHARTFOX_CHANNEL).onmessage = (event) => {
    if ((event.data as { linked?: boolean } | null)?.linked) {
      linkPopup?.close();
      linkPopup = null;
    }
    loadStatus(true);
  };
}

export function useChartfoxStatus(enabled: boolean) {
  const snapshot = useSyncExternalStore(subscribe, () => state);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (enabled) loadStatus();
  }, [enabled]);

  useEffect(() => {
    if (!connecting) return;
    const onFocus = () => {
      loadStatus(true).then(() => setConnecting(false));
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [connecting]);

  useEffect(() => {
    if (snapshot.status?.linked) setConnecting(false);
  }, [snapshot.status?.linked]);

  const connect = useCallback(() => {
    const width = 520;
    const height = 760;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    const popup = window.open(
      chartfoxConnectUrl('popup'),
      'chartfox-connect',
      `width=${width},height=${height},left=${left},top=${top}`
    );
    if (!popup) {
      window.location.href = chartfoxConnectUrl('redirect');
      return;
    }
    linkPopup = popup;
    setConnecting(true);
  }, []);

  const disconnect = useCallback(async () => {
    const ok = await unlinkChartfox();
    if (ok) await loadStatus(true);
    return ok;
  }, []);

  const refresh = useCallback(() => loadStatus(true), []);

  return {
    loaded: snapshot.loaded,
    configured: !!snapshot.status?.configured,
    linked: !!snapshot.status?.linked,
    name: snapshot.status?.name ?? null,
    connecting,
    connect,
    disconnect,
    refresh,
  };
}

function loadAirport(icao: string): Promise<AirportResult> {
  let pending = airportCache.get(icao);
  if (!pending) {
    pending = fetchChartfoxAirportCharts(icao).then((result) => {
      if (result.status !== 'ok') {
        airportCache.delete(icao);
        if (result.status === 'unlinked') markUnlinked();
        return result;
      }
      return {
        status: 'ok',
        charts: result.data.map((chart) => fromChartfox(icao, chart)),
      };
    });
    airportCache.set(icao, pending);
  }
  return pending;
}

export type ChartfoxAirportState =
  | { status: 'idle' | 'loading' | 'error'; charts: ChartEntry[] }
  | { status: 'ready'; charts: ChartEntry[] };

export function useChartfoxAirportCharts(
  icao: string | null,
  enabled: boolean
): ChartfoxAirportState & { retry: () => void } {
  const [result, setResult] = useState<{
    key: string;
    value: AirportResult;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const key = icao && enabled ? icao.toUpperCase() : null;

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    loadAirport(key).then((value) => {
      if (!cancelled) setResult({ key, value });
    });
    return () => {
      cancelled = true;
    };
  }, [key, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  if (!key) return { status: 'idle', charts: [], retry };
  if (result?.key !== key) return { status: 'loading', charts: [], retry };
  if (result.value.status === 'ok') {
    return { status: 'ready', charts: result.value.charts, retry };
  }
  return { status: 'error', charts: [], retry };
}
