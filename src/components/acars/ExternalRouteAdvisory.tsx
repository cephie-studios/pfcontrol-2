import { useEffect, useState } from 'react';
import { AlertTriangle, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SIGNATURE_TONES } from '@/lib/signatureTones';
import { cn } from '@/lib/utils';
import { diffRoutes, type RouteWord } from '../../utils/externalAcars';
import type {
  ProviderCommand,
  ProviderRequest,
  ProviderRoute,
  ProviderStatus,
} from '../../types/externalAcars';

type Advice = { filed: string; check: ProviderRoute };
type Amendment = { before: string; after: string };

function RouteBox({
  label,
  meta,
  words,
  tone,
}: {
  label: string;
  meta?: string;
  words: RouteWord[];
  tone: 'removed' | 'added';
}) {
  return (
    <div className="rounded-2xl border-2 border-zinc-800 bg-zinc-950 p-4">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span
          className={cn(
            'text-sm font-bold',
            tone === 'added' ? 'text-blue-400' : 'text-zinc-400'
          )}
        >
          {label}
        </span>
        {meta && <span className="text-xs text-zinc-500">{meta}</span>}
      </div>
      <p className="font-mono text-sm leading-relaxed break-words text-zinc-300 select-all">
        {words.length === 0 && (
          <span className="text-zinc-600">NONE FILED</span>
        )}
        {words.map((word, index) => (
          <span key={index}>
            {index > 0 && ' '}
            <span
              className={cn(
                word.changed &&
                  (tone === 'removed'
                    ? 'text-red-400 line-through'
                    : 'font-semibold text-emerald-400')
              )}
            >
              {word.text}
            </span>
          </span>
        ))}
      </p>
    </div>
  );
}

function RouteChange({
  from,
  to,
  fromLabel,
  toLabel,
  toMeta,
}: {
  from: string;
  to: string;
  fromLabel: string;
  toLabel: string;
  toMeta?: string;
}) {
  const diff = diffRoutes(from, to);
  return (
    <div className="flex flex-col gap-2">
      <RouteBox label={fromLabel} words={diff.from} tone="removed" />
      <RouteBox label={toLabel} meta={toMeta} words={diff.to} tone="added" />
    </div>
  );
}

export default function ExternalRouteAdvisory({
  status,
  request,
  command,
  busy,
  blocked,
}: {
  status: ProviderStatus;
  request: ProviderRequest;
  command: ProviderCommand;
  busy: boolean;
  blocked: boolean;
}) {
  const hasPlan = !!(status.flight || status.filing);
  const filed = (status.flight?.route ?? status.filing?.route ?? '').trim();
  const [advice, setAdvice] = useState<Advice | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [amendment, setAmendment] = useState<Amendment | null>(null);
  const [amending, setAmending] = useState(false);

  useEffect(() => {
    if (!hasPlan || advice?.filed === filed) return;
    const controller = new AbortController();
    request<ProviderRoute>('/route/', { signal: controller.signal })
      .then((check) => {
        if (!controller.signal.aborted) setAdvice({ filed, check });
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [hasPlan, filed, advice?.filed, request, status]);

  const check = advice?.filed === filed ? advice.check : null;
  const advising = !!check && !check.valid && !dismissed.includes(filed);

  const amend = async () => {
    setAmending(true);
    try {
      const result = await command('/route/', { body: {} });
      if (!result) return;
      const after = result.route ?? check?.route ?? filed;
      setAmendment({ before: filed, after });
      setDismissed((current) => [...current, filed, after]);
    } finally {
      setAmending(false);
    }
  };

  const close = () => {
    setDismissed((current) => [...current, filed]);
    setAmendment(null);
  };

  if (amendment) {
    return (
      <Dialog
        open={!blocked}
        onOpenChange={(open) => !open && setAmendment(null)}
      >
        <DialogContent className="shadcn-scope">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="size-5 text-emerald-400" />
              Route amended
            </DialogTitle>
            <DialogDescription>
              Sent to the controllers working you.
            </DialogDescription>
          </DialogHeader>
          <RouteChange
            from={amendment.before}
            to={amendment.after}
            fromLabel="Previous route"
            toLabel="Now filed"
          />
          <DialogFooter>
            <Button onClick={() => setAmendment(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={!blocked && advising}
      onOpenChange={(open) => !open && close()}
    >
      <DialogContent className="shadcn-scope">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-amber-400" />
            Route advisory
          </DialogTitle>
          <DialogDescription>{check?.reason ?? ''}</DialogDescription>
        </DialogHeader>

        {check?.route && (
          <RouteChange
            from={filed}
            to={check.route}
            fromLabel="Your route"
            toLabel="Suggested route"
            toMeta={check.distance_nm ? `${check.distance_nm} nm` : undefined}
          />
        )}

        <p className="text-xs text-zinc-500">
          {check?.amendable
            ? 'You can amend your route once per flight.'
            : 'This flight has already used its one route amendment.'}
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={amending}>
            {check?.amendable ? 'Keep my route' : 'Close'}
          </Button>
          {check?.amendable && check.route && (
            <Button
              variant="ghost"
              disabled={busy || amending}
              onClick={() => void amend()}
              className={SIGNATURE_TONES.blue}
            >
              {amending && <Loader2 className="animate-spin" />}
              File this route
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
