import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { Map as MapIcon, NotebookPen, Plane, Plus } from 'lucide-react';
import Navbar from '../components/Navbar';
import AcarsFlightPlan from '../components/acars/AcarsFlightPlan';
import AcarsSkeleton, {
  AcarsActionsSkeleton,
} from '../components/acars/AcarsSkeleton';
import AcarsNotes from '../components/acars/AcarsNotes';
import AcarsTerminal, {
  type PdcState,
} from '../components/acars/AcarsTerminal';
import AcarsWorkspace from '../components/acars/AcarsWorkspace';
import ExternalAcarsDenied from '../components/acars/ExternalAcarsDenied';
import ExternalComposer from '../components/acars/ExternalComposer';
import ExternalReplies from '../components/acars/ExternalReplies';
import ExternalRouteAdvisory from '../components/acars/ExternalRouteAdvisory';
import ExternalStations from '../components/acars/ExternalStations';
import ExternalTransponder from '../components/acars/ExternalTransponder';
import { useAcarsLayout } from '../components/acars/useAcarsLayout';
import ChartDrawer from '../components/tools/ChartDrawer';
import { useAuth } from '../hooks/auth/useAuth';
import { useData } from '../hooks/data/useData';
import { useExternalAcars } from '../hooks/useExternalAcars';
import { useSettings } from '../hooks/settings/useSettings';
import { playNotificationSound } from '../utils/acars';
import { getAirportShortName, parseCallsign } from '../utils/callsignParser';
import { getDiscordLoginUrl } from '../utils/fetch/auth';
import {
  initialNotes,
  providerFlight,
  providerMessages,
} from '../utils/externalAcars';
import type { AcarsMessage } from '../types/acars';
import type { ProviderAtis } from '../types/externalAcars';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { SIGNATURE_TONES } from '@/lib/signatureTones';
import { cn } from '@/lib/utils';

function readStoredToken(key: string) {
  try {
    return sessionStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

function useHandoffToken(storageKey: string) {
  const [params, setParams] = useSearchParams();
  const handed = params.get('token') ?? '';
  const [token, setToken] = useState(
    () => handed || readStoredToken(storageKey)
  );

  useEffect(() => {
    if (!handed) return;
    setToken(handed);
    try {
      sessionStorage.setItem(storageKey, handed);
    } catch {
      // storage blocked; the token still works for this visit
    }
    const next = new URLSearchParams(params);
    next.delete('token');
    setParams(next, { replace: true });
  }, [handed, params, setParams, storageKey]);

  return token;
}

export default function ExternalACARS() {
  const { sessionId = '', flightId = '' } = useParams();
  const [params] = useSearchParams();
  const providerId = params.get('external_acars') ?? '';
  const callsign = (params.get('callsign') ?? '').trim().toUpperCase();
  const token = useHandoffToken(
    `external-acars:${sessionId}:${flightId}:${providerId}:${callsign}`
  );

  const { status, loading, offline, deniedReason, busy, request, command } =
    useExternalAcars({ providerId, callsign, token });
  const { user, isLoading: accountLoading } = useAuth();
  const { airports, airlines } = useData();
  const { settings } = useSettings();
  const layoutState = useAcarsLayout();
  const { notesEnabled, save: saveLayout } = layoutState;

  const [opened] = useState(() => new Date().toISOString());
  const [printed, setPrinted] = useState<AcarsMessage[]>([]);
  const [showCharts, setShowCharts] = useState(false);
  const [accountDismissed, setAccountDismissed] = useState(false);
  const [pdcSent, setPdcSent] = useState(false);
  const [requestingPdc, setRequestingPdc] = useState(false);
  const heardUplinks = useRef<Set<string> | null>(null);

  const plan = useMemo(
    () => (status ? providerFlight(status, sessionId, flightId) : null),
    [status, sessionId, flightId]
  );
  const flight = status?.flight;
  const datalink = status?.datalink;
  const connected = datalink?.state === 'connected' && !datalink.suspended;
  const claimUrl = status?.pfcontrol?.claimUrl;
  const showAccountPrompt =
    !user && !accountLoading && !!plan && !!claimUrl && !accountDismissed;
  const spokenCallsign = useMemo(
    () => parseCallsign(callsign, airlines),
    [callsign, airlines]
  );

  const pdcState: PdcState = flight?.clearance?.cleared
    ? 'received'
    : pdcSent ||
        datalink?.messages?.some((message) => message.element === 'DM25')
      ? 'requested'
      : 'idle';

  const messages = useMemo(() => {
    if (!status) return [];
    const [banner, ...rest] = providerMessages(status, opened);
    return [
      banner,
      ...[...rest, ...printed].sort((a, b) =>
        a.timestamp.localeCompare(b.timestamp)
      ),
    ];
  }, [status, printed, opened]);

  useEffect(() => {
    if (!status) return;
    const uplinks = (status.datalink?.messages ?? []).filter(
      (message) => message.direction === 'uplink'
    );
    if (!heardUplinks.current) {
      heardUplinks.current = new Set(uplinks.map((message) => message.id));
      return;
    }
    const heard = heardUplinks.current;
    const fresh = uplinks.filter((message) => !heard.has(message.id));
    if (fresh.length === 0) return;
    for (const message of fresh) heard.add(message.id);
    if (settings) playNotificationSound('pdc', settings);
  }, [status, settings]);

  const print = (station: string, text: string, type: AcarsMessage['type']) => {
    const timestamp = new Date().toISOString();
    setPrinted((current) => [
      ...current,
      {
        id: `printed-${timestamp}-${text.slice(0, 24)}`,
        timestamp,
        station,
        text,
        type,
      },
    ]);
  };

  const showAtis = (atis: ProviderAtis) =>
    print(`${atis.airport}_ATIS`, atis.text, 'atis');

  const logon = async (station: string) => {
    const sent = await command('/acars/logon/', {
      body: {
        station,
        departure: flight?.departure_airport,
        destination: flight?.destination_airport,
      },
      success: `Connected to the ${station} datalink.`,
    });
    if (sent) print('SYSTEM', `DATALINK CONNECT SENT TO ${station}`, 'Success');
    return !!sent;
  };

  const logoff = async () =>
    !!(await command('/acars/logoff/', {
      success: 'Disconnected from the datalink.',
    }));

  const sendText = async (text: string) =>
    !!(await command('/acars/', { body: { text } }));

  const requestPdc = async () => {
    if (pdcState !== 'idle' || !connected) return;
    setRequestingPdc(true);
    try {
      const sent = await command('/acars/request-pdc/', {
        success: 'Clearance requested.',
      });
      if (sent) setPdcSent(true);
    } finally {
      setRequestingPdc(false);
    }
  };

  const respond = async (element: string, mrn: number) =>
    !!(await command('/acars/respond/', {
      body: { element, mrn },
      success: 'Reply sent.',
    }));

  const setSquawk = async (code: string, silent: boolean) =>
    !!(await command('/transponder/', {
      body: { squawk: code },
      success: silent ? undefined : `Squawking ${code}.`,
      silent,
    }));

  const ident = async () =>
    !!(await command('/transponder/', {
      body: { ident: true },
      success: 'IDENT sent.',
    }));

  const statusLabel = offline
    ? 'Offline'
    : datalink?.suspended
      ? 'Suspended'
      : datalink?.state === 'logon_pending'
        ? 'Connecting'
        : connected
          ? datalink?.station || 'Linked'
          : 'No link';

  return (
    <TooltipProvider>
      <div className="shadcn-scope flex min-h-dvh flex-col bg-background text-foreground md:h-dvh">
        <Navbar />

        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-4 pt-21 pb-3 sm:px-6">
          <h1 className="flex min-w-0 items-center gap-2.5 text-xl font-bold tracking-tight">
            <Plane className="size-5 shrink-0 text-blue-400" />
            <span className="truncate">{callsign || 'ACARS'}</span>
          </h1>
          {loading && !deniedReason && <AcarsActionsSkeleton buttons={2} />}
          {plan && (
            <div className="flex flex-wrap gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={
                      notesEnabled ? 'Hide side panel' : 'Show side panel'
                    }
                    aria-pressed={notesEnabled}
                    className={cn(
                      SIGNATURE_TONES.blue,
                      notesEnabled && 'bg-blue-600 text-white dark:bg-blue-600'
                    )}
                    onClick={() => saveLayout({ notesEnabled: !notesEnabled })}
                  >
                    <NotebookPen />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="shadcn-scope" sideOffset={6}>
                  {notesEnabled ? 'Hide side panel' : 'Show side panel'}
                </TooltipContent>
              </Tooltip>
              <Button
                variant="ghost"
                size="sm"
                className={SIGNATURE_TONES.blue}
                onClick={() => setShowCharts(true)}
              >
                <MapIcon />
                Charts
              </Button>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className={SIGNATURE_TONES.blue}
              >
                <Link to={`/submit/${sessionId}`}>
                  <Plus />
                  New flight
                </Link>
              </Button>
            </div>
          )}
        </header>

        {deniedReason ? (
          <ExternalAcarsDenied
            callsign={callsign}
            reason={deniedReason}
            sessionId={sessionId}
          />
        ) : loading || !status ? (
          <AcarsSkeleton layoutState={layoutState} transponder />
        ) : !plan ? (
          <main className="flex flex-1 flex-col items-center gap-4 border-t border-zinc-800 px-4 pt-10">
            <p className="text-sm text-zinc-300">
              No flight plan is on file for {callsign}.
            </p>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className={SIGNATURE_TONES.blue}
            >
              <Link to={`/submit/${sessionId}`}>
                <Plus />
                File a flight plan
              </Link>
            </Button>
          </main>
        ) : (
          <AcarsWorkspace
            layoutState={layoutState}
            sidebar={
              <>
                <AcarsFlightPlan
                  flight={plan}
                  spokenCallsign={
                    spokenCallsign !== callsign ? spokenCallsign : undefined
                  }
                  departureName={getAirportShortName(plan.departure, airports)}
                  arrivalName={getAirportShortName(plan.arrival, airports)}
                  className="shrink-0 border-b border-zinc-800 md:max-h-[60%]"
                />
                <ExternalStations
                  controllers={status.controllers ?? []}
                  atis={status.atis ?? []}
                  datalink={datalink}
                  onAtis={showAtis}
                  className="md:flex-1"
                />
              </>
            }
            terminal={(panelProps) => (
              <AcarsTerminal
                {...panelProps}
                messages={messages}
                pdcState={pdcState}
                connected={connected && !offline}
                statusLabel={statusLabel}
                pdcDisabled={busy || !connected}
                pdcPending={requestingPdc}
                onRequestPDC={() => void requestPdc()}
                messageActions={(message) => {
                  const original = datalink?.messages?.find(
                    (item) => item.id === message.id
                  );
                  return original ? (
                    <ExternalReplies
                      message={original}
                      disabled={busy || !connected || offline}
                      onRespond={respond}
                    />
                  ) : null;
                }}
                footer={
                  <ExternalComposer
                    datalink={datalink}
                    departure={flight?.departure_airport}
                    busy={busy || offline}
                    onLogon={logon}
                    onLogoff={logoff}
                    onSend={sendText}
                  />
                }
              />
            )}
            notes={
              <>
                <AcarsNotes
                  key={`${sessionId}-${flightId}`}
                  sessionId={sessionId}
                  flightId={flightId}
                  initialNotes={initialNotes(plan)}
                  className="min-h-56 flex-1 md:min-w-56"
                />
                <ExternalTransponder
                  flight={flight}
                  busy={busy || offline}
                  onSquawk={setSquawk}
                  onIdent={ident}
                  className="shrink-0 border-t border-zinc-800"
                />
              </>
            }
          />
        )}

        {plan && (
          <ChartDrawer
            isOpen={showCharts}
            onClose={() => setShowCharts(false)}
            settings={settings}
            departureAirport={plan.departure}
            arrivalAirport={plan.arrival}
          />
        )}

        {status && (
          <ExternalRouteAdvisory
            status={status}
            request={request}
            command={command}
            busy={busy || offline}
            blocked={showAccountPrompt || showCharts}
          />
        )}

        <Dialog
          open={showAccountPrompt}
          onOpenChange={(open) => !open && setAccountDismissed(true)}
        >
          <DialogContent className="shadcn-scope">
            <DialogHeader>
              <DialogTitle>Save this flight to your account</DialogTitle>
              <DialogDescription>
                You can keep flying as a guest. Signing in now attaches this
                flight to your profile so it shows up in My Flights.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setAccountDismissed(true)}
              >
                Skip for now
              </Button>
              <Button
                onClick={() => {
                  window.location.href = getDiscordLoginUrl(
                    claimUrl ?? '/my-flights'
                  );
                }}
              >
                Sign in with Discord
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
