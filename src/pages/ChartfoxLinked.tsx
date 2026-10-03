import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router';
import { CircleAlert, CircleCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CHARTFOX_CHANNEL } from '../hooks/useChartfox';
import { CHARTFOX_LOGO_URL } from '../utils/chartCatalog';

export default function ChartfoxLinked() {
  const [searchParams] = useSearchParams();
  const linked = searchParams.get('status') === 'linked';

  useEffect(() => {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(CHARTFOX_CHANNEL);
      channel.postMessage({ linked });
      channel.close();
    }
    if (linked) window.close();
  }, [linked]);

  const Icon = linked ? CircleCheck : CircleAlert;

  return (
    <div className="shadcn-scope flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <div className="w-full max-w-sm space-y-4 rounded-3xl border-2 border-zinc-800 bg-zinc-900 p-6 text-center">
        <div className="relative mx-auto size-14">
          <img
            src={CHARTFOX_LOGO_URL}
            alt="ChartFox"
            className="size-14 rounded-2xl"
          />
          <Icon
            aria-hidden
            className={
              linked
                ? 'absolute -right-1.5 -bottom-1.5 size-6 rounded-full bg-zinc-900 text-emerald-400'
                : 'absolute -right-1.5 -bottom-1.5 size-6 rounded-full bg-zinc-900 text-red-400'
            }
          />
        </div>
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">
            {linked ? 'ChartFox connected' : 'Could not connect ChartFox'}
          </h1>
          <p className="text-sm text-zinc-300">
            {linked
              ? 'You can close this window and return to your charts.'
              : 'The connection was cancelled or failed. Please try again.'}
          </p>
        </div>
        <div className="flex justify-center gap-2">
          {linked ? (
            <Button variant="outline" onClick={() => window.close()}>
              Close window
            </Button>
          ) : (
            <Button variant="outline" asChild>
              <Link to="/settings">Go to settings</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
