import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { Loader2 } from 'lucide-react';
import ACARS from './ACARS';
import ExternalACARS from './ExternalACARS';
import Navbar from '../components/Navbar';
import { clientApiUrl } from '../utils/clientApiBase';

const RESOLVE_TIMEOUT_MS = 15_000;
const RESOLVE_INTERVAL_MS = 30_000;

function DefaultAcarsRoute() {
  const { sessionId = '', flightId = '' } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const acarsToken = params.get('acars_token') ?? '';
  const nativeOnly = params.get('fallback') === '1';
  const [ready, setReady] = useState(!acarsToken || nativeOnly);

  useEffect(() => {
    if (!acarsToken || nativeOnly) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;

    const resolve = async () => {
      try {
        const response = await fetch(
          clientApiUrl(
            `/api/external-acars/resolve/${encodeURIComponent(sessionId)}/${encodeURIComponent(flightId)}`
          ),
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ acarsToken }),
            signal: AbortSignal.any([
              controller.signal,
              AbortSignal.timeout(RESOLVE_TIMEOUT_MS),
            ]),
          }
        );
        if (controller.signal.aborted) return;
        const data = response.ok
          ? await response.json().catch(() => null)
          : null;
        if (data?.mode === 'external' && typeof data.redirectUrl === 'string') {
          const target = new URL(data.redirectUrl, window.location.origin);
          if (target.pathname.startsWith('/acars/')) {
            navigate(target.pathname + target.search, { replace: true });
            return;
          }
        }
      } catch {
        if (controller.signal.aborted) return;
      }
      setReady(true);
      timer = setTimeout(resolve, RESOLVE_INTERVAL_MS);
    };

    void resolve();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [sessionId, flightId, acarsToken, nativeOnly, navigate]);

  if (ready) return <ACARS />;

  return (
    <div className="shadcn-scope min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="mx-auto flex max-w-lg flex-col items-center gap-4 px-5 pt-32 text-center">
        <Loader2 className="size-6 animate-spin text-zinc-500" />
        <p className="text-sm text-zinc-500">Opening ACARS…</p>
      </main>
    </div>
  );
}

export default function AcarsRoute() {
  const { sessionId, flightId } = useParams();
  const [params] = useSearchParams();
  const providerId = params.get('external_acars');
  const callsign = params.get('callsign');

  if (providerId && callsign) {
    return (
      <ExternalACARS
        key={[sessionId, flightId, providerId, callsign].join(':')}
      />
    );
  }
  return (
    <DefaultAcarsRoute
      key={[sessionId, flightId, params.get('acars_token')].join(':')}
    />
  );
}
