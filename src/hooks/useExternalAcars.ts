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
const REFRESH_AFTER_COMMAND_MS = 500;
const OFFLINE_TOAST_ID = 'external-acars-offline';
const MISSING_TOKEN_REASON =
  'Reopen ACARS from your submitted flight to renew access.';

const FATAL_CODES = new Set(['access_expired', 'flight_unavailable']);
const FATAL_BEFORE_LOAD = new Set([401, 403, 404, 409]);

export class ProviderError extends Error {
  status: number;
  code?: string;
  requestId?: string;

  constructor(
    message: string,
    status: number,
    extra: { code?: string; requestId?: string } = {}
  ) {
    super(message);
    this.status = status;
    this.code = extra.code;
    this.requestId = extra.requestId;
  }
}

const isAbort = (cause: unknown) =>
  cause instanceof Error && cause.name === 'AbortError';

function errorMessage(data: Record<string, unknown> | null): string {
  const detail = [data?.details, data?.error, data?.message].find(
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
  const inFlight = useRef(new Set<AbortController>());
  const refreshTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

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
        setStatus(next);
        setOffline(false);
        toast.dismiss(OFFLINE_TOAST_ID);
      } catch (cause) {
        if (signal?.aborted || isAbort(cause)) return;
        const fatal =
          cause instanceof ProviderError &&
          ((cause.code && FATAL_CODES.has(cause.code)) ||
            (!loaded.current && FATAL_BEFORE_LOAD.has(cause.status)));
        if (fatal) {
          setFatalReason((cause as ProviderError).message);
          return;
        }
        setOffline(true);
        toast.error('ACARS is offline', {
          id: OFFLINE_TOAST_ID,
          description: 'Reconnecting. Your commands are not confirmed.',
          duration: Infinity,
        });
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [request]
  );

  const interval = useRef(POLL_IDLE_MS);
  interval.current = status?.datalink?.state ? POLL_LINKED_MS : POLL_IDLE_MS;

  useEffect(() => {
    if (deniedReason || !callsign) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      await refresh(controller.signal);
      if (!controller.signal.aborted)
        timer = setTimeout(poll, interval.current);
    };
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
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
        clearTimeout(refreshTimer.current);
        refreshTimer.current = setTimeout(
          () => void refresh(),
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
    [request, refresh, deniedReason]
  );

  return { status, loading, offline, deniedReason, busy, request, command };
}
