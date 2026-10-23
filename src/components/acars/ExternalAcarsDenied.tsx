import { Link } from 'react-router';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SIGNATURE_TONES } from '@/lib/signatureTones';

export default function ExternalAcarsDenied({
  callsign,
  reason,
  sessionId,
}: {
  callsign: string;
  reason: string;
  sessionId: string;
}) {
  return (
    <main className="flex flex-1 items-start justify-center px-4 pt-8 pb-16">
      <div className="flex w-full max-w-md flex-col gap-4 rounded-3xl border-2 border-zinc-800 bg-zinc-900 p-5">
        <div className="flex flex-col items-center gap-3 text-center">
          <Lock className="size-7 shrink-0 text-zinc-500" />
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-bold">
              Can&apos;t open {callsign || 'this flight'}
            </h2>
            <p className="text-sm text-balance text-zinc-300">
              ACARS opens from the link PFControl gives you when you submit a
              flight plan. Open it from there or from My Flights.
            </p>
          </div>
        </div>
        <p className="rounded-2xl border-2 border-zinc-800 bg-zinc-950 px-4 py-3 font-mono text-xs text-zinc-500">
          {reason}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className={SIGNATURE_TONES.blue}
          >
            <Link to="/my-flights">My flights</Link>
          </Button>
          {sessionId && (
            <Button
              asChild
              variant="ghost"
              size="sm"
              className={SIGNATURE_TONES.blue}
            >
              <Link to={`/submit/${sessionId}`}>New flight</Link>
            </Button>
          )}
        </div>
      </div>
    </main>
  );
}
