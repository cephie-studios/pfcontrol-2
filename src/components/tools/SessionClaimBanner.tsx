import { useEffect, useState, type ReactNode } from 'react';
import {
  ArrowLeftRight,
  Check,
  Flag,
  Loader2,
  ShieldX,
  X,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { minDuration } from '@/lib/minDuration';
import { reportSessionClaimRequest } from '../../utils/fetch/sessionClaimReports';
import type {
  SessionClaimDecisionResult,
  SessionClaimUpdate,
  createSessionUsersSocket,
} from '../../sockets/sessionUsersSocket';

const REVIEW_MS = 60_000;
const ALLOWED_VISIBLE_MS = 8_000;
const REPORTED_VISIBLE_MS = 5_000;

type BannerState =
  | {
      kind: 'pending';
      requestId: string;
      requesterName: string;
      deadline: number;
    }
  | {
      kind: 'declined' | 'allowed';
      requestId: string;
      requesterName: string;
      by: string | null;
    }
  | { kind: 'reported'; requesterName: string };

type Props = {
  socket: ReturnType<typeof createSessionUsersSocket> | null;
  sessionId?: string;
  accessId?: string;
};

const SIGNATURE = {
  red: 'border-2 border-red-600 text-red-600 hover:bg-red-600 hover:text-white focus-visible:bg-red-600 focus-visible:text-white focus-visible:ring-0 dark:hover:bg-red-600',
  green:
    'border-2 border-green-600 text-green-600 hover:bg-green-600 hover:text-white focus-visible:bg-green-600 focus-visible:text-white focus-visible:ring-0 dark:hover:bg-green-600',
  amber:
    'border-2 border-amber-600 text-amber-600 hover:bg-amber-600 hover:text-white focus-visible:bg-amber-600 focus-visible:text-white focus-visible:ring-0 dark:hover:bg-amber-600',
};

export default function SessionClaimBanner({
  socket,
  sessionId,
  accessId,
}: Props) {
  const [state, setState] = useState<BannerState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState<'allow' | 'decline' | 'report' | null>(null);

  useEffect(() => {
    if (!socket) return;
    const onUpdate = (update: SessionClaimUpdate) => {
      if (update.status === 'pending') {
        setState({
          kind: 'pending',
          requestId: update.requestId,
          requesterName: update.requesterName,
          deadline: Date.now() + update.remainingMs,
        });
      } else if (update.status === 'none') {
        setState(null);
      } else {
        setState({
          kind: update.status,
          requestId: update.requestId,
          requesterName: update.requesterName,
          by: update.by,
        });
      }
    };
    socket.on('sessionClaimUpdate', onUpdate);
    return () => {
      socket.off('sessionClaimUpdate', onUpdate);
    };
  }, [socket]);

  useEffect(() => {
    if (state?.kind !== 'pending') return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [state?.kind]);

  useEffect(() => {
    if (state?.kind !== 'allowed' && state?.kind !== 'reported') return;
    const t = setTimeout(
      () => setState(null),
      state.kind === 'allowed' ? ALLOWED_VISIBLE_MS : REPORTED_VISIBLE_MS
    );
    return () => clearTimeout(t);
  }, [state]);

  if (!state) return null;
  if (state.kind === 'pending' && now >= state.deadline && !busy) return null;

  const decide = async (decision: 'allow' | 'decline') => {
    if (!socket?.emitSessionClaimDecision || busy) return;
    setBusy(decision);
    try {
      const res: SessionClaimDecisionResult = await minDuration(
        socket.emitSessionClaimDecision(decision)
      );
      if (!res.ok) {
        toast.error(res.error);
        setState(null);
      }
    } finally {
      setBusy(null);
    }
  };

  const report = async () => {
    if (state.kind !== 'declined' || !sessionId || !accessId || busy) return;
    setBusy('report');
    try {
      await minDuration(
        reportSessionClaimRequest({
          sessionId,
          accessId,
          requestId: state.requestId,
        })
      );
      setState({ kind: 'reported', requesterName: state.requesterName });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to send report');
    } finally {
      setBusy(null);
    }
  };

  const name = state.requesterName;
  let icon: LucideIcon | null;
  let iconClass: string;
  let title: string;
  let body: ReactNode;

  if (state.kind === 'pending') {
    const seconds = Math.ceil(Math.max(0, state.deadline - now) / 1000);
    icon = ArrowLeftRight;
    iconClass = 'text-amber-500';
    title = `${name} wants to handle ACARS here`;
    body = (
      <>
        Pilots who file in this session would be sent to {name}&apos;s ACARS
        instead of PFControl&apos;s. This goes through in{' '}
        <span className="font-semibold text-amber-500 tabular-nums">
          {seconds}s
        </span>{' '}
        unless you decline.
      </>
    );
  } else if (state.kind === 'declined') {
    icon = ShieldX;
    iconClass = 'text-red-500';
    title = `${name}'s request was declined`;
    body = (
      <>
        {state.by ?? 'A controller'} declined it, so pilots keep using
        PFControl&apos;s ACARS. If {name} keeps asking, report it and an admin
        will look into it.
      </>
    );
  } else if (state.kind === 'allowed') {
    icon = null;
    iconClass = '';
    title = `${name} now handles ACARS here`;
    body = state.by
      ? `${state.by} allowed the request. Pilots who file from now on are sent to ${name}'s ACARS.`
      : `Nobody declined in time. Pilots who file from now on are sent to ${name}'s ACARS.`;
  } else {
    icon = Flag;
    iconClass = 'text-amber-500';
    title = 'Report sent';
    body = `Thanks. An admin will review ${name}'s requests.`;
  }

  const Icon = icon;
  const dismissable = state.kind !== 'pending';
  const remainingPct =
    state.kind === 'pending'
      ? (Math.max(0, state.deadline - now) / REVIEW_MS) * 100
      : 0;

  return (
    <TooltipProvider>
      <div className="shadcn-scope pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex justify-center">
        <div
          role={state.kind === 'pending' ? 'alertdialog' : 'status'}
          aria-labelledby="session-claim-title"
          aria-describedby="session-claim-body"
          className="pointer-events-auto w-full max-w-lg overflow-hidden rounded-3xl border-2 border-zinc-800 bg-zinc-900 text-foreground shadow-2xl shadow-black/60"
        >
          <div className="p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <p
                id="session-claim-title"
                className="min-w-0 flex-1 font-semibold"
              >
                {title}
              </p>
              {Icon ? (
                <Icon className={`mt-0.5 size-5 shrink-0 ${iconClass}`} />
              ) : null}
              {dismissable ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Dismiss"
                      onClick={() => setState(null)}
                      className="-mt-1 -mr-1 cursor-pointer text-zinc-500"
                    >
                      <X />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="shadcn-scope">
                    Dismiss
                  </TooltipContent>
                </Tooltip>
              ) : null}
            </div>
            <p id="session-claim-body" className="mt-1 text-sm text-zinc-300">
              {body}
            </p>

            {state.kind === 'pending' ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy !== null}
                  onClick={() => void decide('decline')}
                  className={`cursor-pointer ${SIGNATURE.red}`}
                >
                  {busy === 'decline' ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <X />
                  )}
                  Decline
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy !== null}
                  onClick={() => void decide('allow')}
                  className={`cursor-pointer ${SIGNATURE.green}`}
                >
                  {busy === 'allow' ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Check />
                  )}
                  Allow now
                </Button>
              </div>
            ) : null}

            {state.kind === 'declined' && sessionId && accessId ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy !== null}
                  onClick={() => void report()}
                  className={`cursor-pointer ${SIGNATURE.amber}`}
                >
                  {busy === 'report' ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Flag />
                  )}
                  Report {name}
                </Button>
              </div>
            ) : null}
          </div>
          {state.kind === 'pending' ? (
            <div className="h-1 bg-zinc-800">
              <div
                className="h-full bg-amber-500 transition-[width] duration-300 ease-linear"
                style={{ width: `${remainingPct}%` }}
              />
            </div>
          ) : null}
        </div>
      </div>
    </TooltipProvider>
  );
}
