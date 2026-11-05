import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { minDuration } from '@/lib/minDuration';
import { clientApiUrl } from '../utils/clientApiBase';
import { isDelivered } from '../utils/externalAcars';
import type {
  ProviderCommand,
  ProviderRequest,
  ProviderResult,
  ProviderStatus,
} from '../types/externalAcars';

const REQUEST_TIMEOUT_MS = 15_000;
const POLL_LINKED_MS = 5_000;
const POLL_IDLE_MS = 10_000;
const POLL_BURST_MS = 2_000;
const BURST_WINDOW_MS = 14_000;
const REFRESH_AFTER_COMMAND_MS = 500;
const OFFLINE_TOAST_ID = 'external-acars-offline';
const FALLBACK_AFTER_FAILURES = 3;
const MISSING_TOKEN_REASON =
  'Reopen ACARS from your submitted flight to renew access.';

const FATAL_CODES = new Set(['access_expired', 'flight_unavailable']);
const FATAL_BEFORE_LOAD = new Set([401, 403, 404]);

export class ProviderError extends Error {
  status: number;
  code?: string;
  requestId?: string;
  fallbackUrl?: string;

  constructor(
    message: string,
    status: number,
    extra: { code?: string; requestId?: string; fallbackUrl?: string } = {}
  ) {
    super(message);
    this.status = status;
    this.code = extra.code;
    this.requestId = extra.requestId;
    this.fallbackUrl = extra.fallbackUrl;
  }
}

const isAbort = (cause: unknown) =>
  cause instanceof Error && cause.name === 'AbortError';

function errorMessage(data: Record<string, unknown> | null): string {
  const detail = [data?.details, data?.reason, data?.error, data?.message].find(
    (item) => typeof item === 'string' && item
  );
  return typeof detail === 'string'
    ? detail
    : 'The ACARS provider rejected the request.';
}

export function useExternalAcars({
  providerId,
  callsign,
  token,
}: {
  providerId: string;
  callsign: string;
  token: string;
}) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<ProviderStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [fatalReason, setFatalReason] = useState<string | null>(null);
  const deniedReason = token ? fatalReason : MISSING_TOKEN_REASON;
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const loaded = useRef(false);
  const failures = useRef(0);
  const inFlight = useRef(new Set<AbortController>());
  const refreshTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const burstUntil = useRef(0);
  const wake = useRef<() => void>(() => {});

  useEffect(() => setFatalReason(null), [token]);

  useEffect(() => {
    const requests = inFlight.current;
    return () => {
      for (const controller of requests) controller.abort();
      requests.clear();
      clearTimeout(refreshTimer.current);
      toast.dismiss(OFFLINE_TOAST_ID);
    };
  }, []);

  const request: ProviderRequest = useCallback(
    async <T>(
      path: string,
      options: { body?: Record<string, unknown>; signal?: AbortSignal } = {}
    ): Promise<T> => {
      if (!token) {
        throw new ProviderError(MISSING_TOKEN_REASON, 401, {
          code: 'access_expired',
        });
      }

      const controller = new AbortController();
      inFlight.current.add(controller);
      const hasBody = options.body !== undefined;
      try {
        const response = await fetch(
          clientApiUrl(
            `/api/external-acars/${encodeURIComponent(providerId)}/flights/${encodeURIComponent(callsign)}${path}`
          ),
          {
            method: hasBody ? 'POST' : 'GET',
            credentials: 'omit',
            headers: {
              'X-External-ACARS-Token': token,
              ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
            },
            body: hasBody ? JSON.stringify(options.body) : undefined,
            signal: AbortSignal.any([
              controller.signal,
              AbortSignal.timeout(REQUEST_TIMEOUT_MS),
              ...(options.signal ? [options.signal] : []),
            ]),
          }
        );

        const data = (await response.json().catch(() => null)) as Record<
          string,
          unknown
        > | null;

        if (
          response.status === 409 &&
          data?.code === 'acars_mode_changed' &&
          typeof data.redirectUrl === 'string' &&
          data.redirectUrl.startsWith('/acars/')
        ) {
          navigate(data.redirectUrl, { replace: true });
          throw new DOMException('ACARS mode changed', 'AbortError');
        }
        if (!response.ok) {
          throw new ProviderError(errorMessage(data), response.status, {
            code: typeof data?.code === 'string' ? data.code : undefined,
            requestId:
              typeof data?.requestId === 'string' ? data.requestId : undefined,
            fallbackUrl:
              typeof data?.fallbackUrl === 'string' &&
              data.fallbackUrl.startsWith('/acars/')
                ? data.fallbackUrl
                : undefined,
          });
        }
        if (!data) {
          throw new ProviderError(
            'The ACARS provider returned an invalid response.',
            502
          );
        }
        return data as T;
      } finally {
        inFlight.current.delete(controller);
      }
    },
    [providerId, callsign, token, navigate]
  );

  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const next = await request<ProviderStatus>('', { signal });
        if (signal?.aborted) return;
        loaded.current = true;
        failures.current = 0;
        setStatus(next);
        setOffline(false);
        toast.dismiss(OFFLINE_TOAST_ID);
      } catch (cause) {
        if (signal?.aborted || isAbort(cause)) return;
        failures.current += 1;
        const fallbackUrl =
          cause instanceof ProviderError ? cause.fallbackUrl : undefined;
        if (
          fallbackUrl &&
          (!loaded.current || failures.current >= FALLBACK_AFTER_FAILURES)
        ) {
          toast.info('Switched to PFControl ACARS', {
            description: 'The external ACARS provider is not responding.',
          });
          navigate(fallbackUrl, { replace: true });
          return;
        }
        const fatal =
          cause instanceof ProviderError &&
          ((cause.code && FATAL_CODES.has(cause.code)) ||
            (!loaded.current && FATAL_BEFORE_LOAD.has(cause.status)));
        if (fatal) {
          setFatalReason((cause as ProviderError).message);
          return;
        }
        setOffline(true);
        if (
          cause instanceof ProviderError &&
          cause.code === 'PILOT_PANEL_IN_USE'
        ) {
          toast.error('ACARS is open somewhere else', {
            id: OFFLINE_TOAST_ID,
            description:
              'Close the other ACARS window. This one takes over about 90 seconds later.',
            duration: Infinity,
          });
          return;
        }
        toast.error('ACARS is offline', {
          id: OFFLINE_TOAST_ID,
          description: 'Reconnecting. Your commands are not confirmed.',
          duration: Infinity,
        });
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [request, navigate]
  );

  const interval = useRef(POLL_IDLE_MS);
  interval.current = status?.datalink?.state ? POLL_LINKED_MS : POLL_IDLE_MS;

  useEffect(() => {
    if (deniedReason || !callsign) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let running = false;
    const poll = async () => {
      clearTimeout(timer);
      if (running) return;
      running = true;
      await refresh(controller.signal);
      running = false;
      if (controller.signal.aborted) return;
      timer = setTimeout(
        poll,
        Date.now() < burstUntil.current ? POLL_BURST_MS : interval.current
      );
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void poll();
    };
    wake.current = () => void poll();
    document.addEventListener('visibilitychange', onVisible);
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      wake.current = () => {};
    };
  }, [refresh, deniedReason, callsign]);

  const command: ProviderCommand = useCallback(
    async (path, { body = {}, success, silent = false } = {}) => {
      if (locked.current || deniedReason) return null;
      locked.current = true;
      setBusy(true);
      try {
        const result = await minDuration(
          request<ProviderResult>(path, { body })
        );
        if (!isDelivered(result)) {
          if (!silent) {
            toast.error('The airspace service is not listening.', {
              description: 'Your command has not been confirmed.',
            });
          }
          return null;
        }
        if (success) toast.success(success);
        burstUntil.current = Date.now() + BURST_WINDOW_MS;
        clearTimeout(refreshTimer.current);
        refreshTimer.current = setTimeout(
          () => wake.current(),
          REFRESH_AFTER_COMMAND_MS
        );
        return result;
      } catch (cause) {
        if (isAbort(cause) || silent) return null;
        const requestId =
          cause instanceof ProviderError ? cause.requestId : undefined;
        toast.error(
          cause instanceof Error ? cause.message : 'Command not confirmed.',
          { description: requestId ? `Ref ID: ${requestId}` : undefined }
        );
        return null;
      } finally {
        locked.current = false;
        setBusy(false);
      }
    },
    [request, deniedReason]
  );

  return { status, loading, offline, deniedReason, busy, request, command };
}
