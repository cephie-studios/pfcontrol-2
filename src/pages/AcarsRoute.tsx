import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { Loader2, TriangleAlert } from 'lucide-react';
import ACARS from './ACARS';
import ExternalACARS from './ExternalACARS';
import Navbar from '../components/Navbar';
import { clientApiUrl } from '../utils/clientApiBase';
import { Button } from '@/components/ui/button';
import { SIGNATURE_TONES } from '@/lib/signatureTones';

const RESOLVE_TIMEOUT_MS = 15_000;
const RESOLVE_INTERVAL_MS = 30_000;

function DefaultAcarsRoute() {
  const { sessionId = '', flightId = '' } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const acarsToken = params.get('acars_token') ?? '';
  const [ready, setReady] = useState(!acarsToken);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!acarsToken) return;
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

        if (response.status === 403 || response.status === 404) {
          setReady(true);
          return;
        }
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(data?.error || 'Unable to open ACARS.');
        }

        if (data.mode === 'external') {
          const target = new URL(data.redirectUrl, window.location.origin);
          if (!target.pathname.startsWith('/acars/')) {
            throw new Error('Invalid ACARS handoff.');
          }
          navigate(target.pathname + target.search, { replace: true });
          return;
        }
        setReady(true);
        setError('');
      } catch (cause) {
        if (controller.signal.aborted) return;
        setError(
          cause instanceof Error ? cause.message : 'Unable to open ACARS.'
        );
      }
      timer = setTimeout(resolve, RESOLVE_INTERVAL_MS);
    };

    void resolve();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [sessionId, flightId, acarsToken, navigate, attempt]);

  if (ready) return <ACARS />;

  return (
    <div className="shadcn-scope min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="mx-auto flex max-w-lg flex-col items-center gap-4 px-5 pt-32 text-center">
        {error ? (
          <>
            <TriangleAlert className="size-7 text-amber-400" />
            <p role="alert" className="text-sm text-zinc-300">
              {error}
            </p>
            <Button
              variant="ghost"
              size="sm"
              className={SIGNATURE_TONES.blue}
              onClick={() => {
                setError('');
                setAttempt((value) => value + 1);
              }}
            >
              Try again
            </Button>
          </>
        ) : (
          <>
            <Loader2 className="size-6 animate-spin text-zinc-500" />
            <p className="text-sm text-zinc-500">Opening ACARS…</p>
          </>
        )}
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
