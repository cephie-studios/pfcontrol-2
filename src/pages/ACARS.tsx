import { useState, useRef, useEffect, useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import {
  AlertTriangle,
  Home,
  Map as MapIcon,
  NotebookPen,
  Plane,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import Navbar from '../components/Navbar';
import { useData } from '../hooks/data/useData';
import { useSettings } from '../hooks/settings/useSettings';
import { useAuth } from '../hooks/auth/useAuth';
import { createAcarsFlightSocket } from '../sockets/flightsSocket';
import {
  BROADCAST_FLIGHT_ID,
  createPilotChatSocket,
  type PilotChatClient,
  type PilotChatMessage,
} from '../sockets/pilotChatSocket';
import ReportMessageDialog from '../components/chat/ReportMessageDialog';
import DeleteMessageDialog from '../components/chat/DeleteMessageDialog';
import {
  createOverviewSocket,
  type OverviewSession,
} from '../sockets/overviewSocket';
import { getAirportName, parseCallsign } from '../utils/callsignParser';
import { playNotificationSound } from '../utils/acars';
import { dragNotesDivider, dragSidebarDivider } from '../utils/acarsLayout';
import { useAcarsLayout } from '../components/acars/useAcarsLayout';
import AcarsDivider from '../components/acars/AcarsDivider';
import type { AcarsMessage } from '../types/acars';
import type { Flight } from '../types/flight';
import type { SessionInfo } from '../types/session';
import AcarsTerminal, {
  type PdcState,
} from '../components/acars/AcarsTerminal';
import AcarsFlightPlan from '../components/acars/AcarsFlightPlan';
import AcarsNotes from '../components/acars/AcarsNotes';
import AcarsStations from '../components/acars/AcarsStations';
import AcarsCharts from '../components/acars/AcarsCharts';
import ControllerRatingPopup from '../components/tools/ControllerRatingPopup';
import { getDiscordLoginUrl } from '../utils/fetch/auth';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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

const PDC_REQUESTED_KEY_PREFIX = 'pdc_requested_';

const API_URL = import.meta.env.VITE_SERVER_URL;

const systemMessage = (
  id: string,
  text: string,
  type: AcarsMessage['type'] = 'Success'
): AcarsMessage => ({
  id: `${Date.now()}-${id}`,
  timestamp: new Date().toISOString(),
  station: 'SYSTEM',
  text,
  type,
});

const panelWidth = (width: number) => ({ '--w': width }) as React.CSSProperties;

const chatToAcars = (
  m: PilotChatMessage,
  userId: string | undefined
): AcarsMessage => ({
  id: `chat-${m.id}`,
  chatId: m.id,
  own: !!userId && m.sender === 'pilot' && m.userId === userId,
  timestamp: m.sentAt,
  station:
    m.sender === 'pilot'
      ? m.callsign || m.username
      : `${m.station || 'ATC'}${m.flightId === BROADCAST_FLIGHT_ID ? ' BROADCAST' : ''}`,
  text: m.message,
  type: m.sender,
});

function PanelSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex min-h-0 flex-col gap-4 border-zinc-800 p-5',
        className
      )}
    >
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-3.5 w-3/4" />
      <Skeleton className="h-3.5 w-1/2" />
      <Skeleton className="h-3.5 w-2/3" />
    </div>
  );
}

export default function ACARS() {
  const { sessionId, flightId } = useParams<{
    sessionId: string;
    flightId: string;
  }>();
  const [searchParams] = useSearchParams();
  const accessId = searchParams.get('acars_token');
  const { user } = useAuth();
  const { airports, airlines, loading: dataLoading } = useData();
  const { settings, loading: settingsLoading } = useSettings();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flight, setFlight] = useState<Flight | null>(null);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [acarsValid, setAcarsValid] = useState(false);
  const [messages, setMessages] = useState<AcarsMessage[]>([]);
  const [activeSessions, setActiveSessions] = useState<OverviewSession[]>([]);
  const [pdcRequested, setPdcRequested] = useState(() =>
    flightId
      ? localStorage.getItem(`${PDC_REQUESTED_KEY_PREFIX}${flightId}`) ===
        'true'
      : false
  );
  const [showCharts, setShowCharts] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [showAccountPrompt, setShowAccountPrompt] = useState(false);
  const [connected, setConnected] = useState(false);
  const [chatMessages, setChatMessages] = useState<AcarsMessage[]>([]);
  const [reportTarget, setReportTarget] = useState<AcarsMessage | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AcarsMessage | null>(null);
  const chatRef = useRef<PilotChatClient | null>(null);
  const {
    layout,
    notesEnabled,
    notesWidth,
    save: saveLayout,
  } = useAcarsLayout();
  const [dragging, setDragging] = useState<'sidebar' | 'notes' | null>(null);
  const [draftLayout, setDraftLayout] = useState<typeof layout | null>(null);
  const mainRef = useRef<HTMLElement>(null);

  const socketRef = useRef<ReturnType<typeof createAcarsFlightSocket> | null>(
    null
  );
  const initializedRef = useRef(false);
  const loadStartedRef = useRef(false);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const flightRef = useRef(flight);
  flightRef.current = flight;
  const userIdRef = useRef(user?.userId);
  userIdRef.current = user?.userId;

  const playSound = (type: Parameters<typeof playNotificationSound>[0]) => {
    if (settingsRef.current) playNotificationSound(type, settingsRef.current);
  };

  const spokenCallsign = useMemo(
    () => (flight?.callsign ? parseCallsign(flight.callsign, airlines) : null),
    [flight?.callsign, airlines]
  );

  const pdcState: PdcState = messages.some((m) => m.type === 'pdc')
    ? 'received'
    : pdcRequested
      ? 'requested'
      : 'idle';

  useEffect(() => {
    if (loadStartedRef.current) return;
    loadStartedRef.current = true;

    const validateAndLoad = async () => {
      if (!sessionId || !flightId || !accessId) {
        setError('This ACARS link is missing required parameters.');
        setLoading(false);
        return;
      }
      try {
        const validateResponse = await fetch(
          `${API_URL}/api/flights/${sessionId}/${flightId}/validate-acars?acars_token=${accessId}`,
          { credentials: 'include' }
        );
        if (!validateResponse.ok) throw new Error('Failed to validate access.');
        const { valid } = await validateResponse.json();
        if (!valid) throw new Error('This ACARS link is no longer valid.');
        setAcarsValid(true);

        const sessionResponse = await fetch(
          `${API_URL}/api/sessions/${sessionId}/submit`,
          { credentials: 'include' }
        );
        if (sessionResponse.ok) setSession(await sessionResponse.json());

        const flightResponse = await fetch(
          `${API_URL}/api/flights/${sessionId}/${flightId}/acars-flight?acars_token=${accessId}`
        );
        if (!flightResponse.ok) throw new Error('Failed to load flight data.');
        const currentFlight: Flight = await flightResponse.json();
        if (!currentFlight || String(currentFlight.id) !== String(flightId)) {
          throw new Error('Flight not found.');
        }
        setFlight(currentFlight);
        setLoading(false);

        await fetch(`${API_URL}/api/flights/acars/active`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ sessionId, flightId, acarsToken: accessId }),
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Access denied.');
        setLoading(false);
      }
    };
    validateAndLoad();
  }, [sessionId, flightId, accessId]);

  useEffect(() => {
    if (!loading && !user && flight) setShowAccountPrompt(true);
  }, [loading, user, flight]);

  useEffect(() => {
    if (!sessionId || !flightId) return;
    const handleUnload = () => {
      fetch(`${API_URL}/api/flights/acars/active/${sessionId}/${flightId}`, {
        method: 'DELETE',
        credentials: 'include',
        keepalive: true,
      });
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      handleUnload();
    };
  }, [sessionId, flightId]);

  useEffect(() => {
    if (!flight || dataLoading || initializedRef.current) return;
    const initial = [
      systemMessage(
        'warning',
        'DO NOT CLOSE THIS WINDOW, CONTROLLERS MAY SEND PRE DEPARTURE CLEARANCES THROUGH THE ACARS TERMINAL',
        'warning'
      ),
      systemMessage(
        'filed',
        `FLIGHT PLAN ${flight.callsign} SUBMITTED SUCCESSFULLY`
      ),
    ];
    if (
      flightId &&
      localStorage.getItem(`${PDC_REQUESTED_KEY_PREFIX}${flightId}`) === 'true'
    ) {
      initial.push(
        systemMessage('pdc-request-restored', 'PDC REQUEST SENT TO CONTROLLERS')
      );
    }
    if (flight.pdc_remarks) {
      initial.push({
        id: `${Date.now()}-pdc-existing`,
        timestamp: new Date().toISOString(),
        station: `${flight.departure}_DEL`,
        text: flight.pdc_remarks,
        type: 'pdc',
      });
    }
    setMessages(initial);
    if (settings) playNotificationSound('warning', settings);
    initializedRef.current = true;
  }, [flight, dataLoading, settings, flightId]);

  useEffect(() => {
    if (!sessionId || !flightId || !accessId || loading || !acarsValid) return;
    const socket = createAcarsFlightSocket(sessionId, flightId, accessId);
    socketRef.current = socket;
    setConnected(socket.socket.connected);
    socket.socket.on('connect', () => setConnected(true));
    socket.socket.on('disconnect', () => setConnected(false));
    socket.socket.on('connect_error', () => setConnected(false));

    socket.socket.on(
      'pdcIssued',
      (payload: {
        pdcText?: string;
        updatedFlight?: Partial<Flight>;
        flightId: string | number;
      }) => {
        if (String(payload.flightId) !== String(flightId)) return;
        const pdcText = payload.pdcText ?? payload.updatedFlight?.pdc_remarks;
        if (!pdcText) return;
        if (payload.updatedFlight) {
          setFlight((prev) =>
            prev ? { ...prev, ...payload.updatedFlight } : prev
          );
        }
        setMessages((prev) => [
          ...prev,
          {
            id: `${Date.now()}-${Math.random()}`,
            timestamp: new Date().toISOString(),
            station: `${payload.updatedFlight?.departure ?? flightRef.current?.departure}_DEL`,
            text: pdcText,
            type: 'pdc',
          },
        ]);
        playSound('pdc');
      }
    );

    socket.socket.on(
      'contactMe',
      (payload: {
        flightId: string | number;
        message?: string;
        station?: string;
        position?: string;
      }) => {
        if (String(payload.flightId) !== String(flightId)) return;
        const station =
          payload.station || flightRef.current?.departure || 'UNKNOWN';
        const position = payload.position || 'TWR';
        setMessages((prev) => [
          ...prev,
          {
            id: `${Date.now()}-contact`,
            timestamp: new Date().toISOString(),
            station: station.includes('_CTR')
              ? station
              : `${station}_${position}`,
            text: payload.message || 'CONTACT CONTROLLER ON FREQUENCY',
            type: 'contact',
          },
        ]);
        playSound('contact');
      }
    );

    return () => {
      socket.socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [sessionId, flightId, accessId, loading, acarsValid]);

  useEffect(() => {
    if (!sessionId || !flightId || !accessId || !acarsValid) return;
    const client = createPilotChatSocket({
      sessionId,
      flightId,
      acarsToken: accessId,
    });
    chatRef.current = client;
    client.socket.on('init', (data: { messages: PilotChatMessage[] }) => {
      setChatMessages(
        data.messages.map((m) => chatToAcars(m, userIdRef.current))
      );
    });
    client.socket.on('message', (m: PilotChatMessage) => {
      setChatMessages((prev) =>
        prev.some((p) => p.chatId === m.id)
          ? prev
          : [...prev, chatToAcars(m, userIdRef.current)]
      );
      if (m.sender === 'atc') playSound('contact');
    });
    client.socket.on('messageDeleted', ({ id }: { id: number }) => {
      setChatMessages((prev) => prev.filter((p) => p.chatId !== id));
    });
    return () => {
      client.socket.disconnect();
      chatRef.current = null;
    };
  }, [sessionId, flightId, accessId, acarsValid]);

  const terminalMessages = useMemo(
    () =>
      [...messages, ...chatMessages].sort(
        (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)
      ),
    [messages, chatMessages]
  );

  useEffect(() => {
    const overviewSocket = createOverviewSocket((data) => {
      setActiveSessions(data.activeSessions);
    });
    return () => {
      overviewSocket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (
      session &&
      flight &&
      user &&
      session.createdBy !== user.userId &&
      session.feedbackEnabled &&
      (settings?.acars?.autoRedirectToAcars ?? true) &&
      !localStorage.getItem(`rating_dismissed_${flightId}`)
    ) {
      setShowRating(true);
    }
  }, [session, flight, user, settings?.acars?.autoRedirectToAcars, flightId]);

  const handleRequestPDC = () => {
    if (!flight || pdcState !== 'idle') return;
    if (!socketRef.current?.socket.connected) {
      toast.error('Not connected to the session yet. Try again in a moment.');
      return;
    }
    socketRef.current.requestPDC('PDC requested via ACARS terminal');
    setMessages((prev) => [
      ...prev,
      systemMessage('pdc-request', 'PDC REQUEST SENT TO CONTROLLERS'),
    ]);
    playSound('system');
    if (flightId) {
      localStorage.setItem(`${PDC_REQUESTED_KEY_PREFIX}${flightId}`, 'true');
    }
    setPdcRequested(true);
  };

  const handleShowAtis = (atisSession: OverviewSession) => {
    if (!atisSession.atis?.text) return;
    setMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}-atis`,
        timestamp: new Date().toISOString(),
        station: `${atisSession.airportIcao}_ATIS`,
        text: atisSession.atis!.text,
        type: 'atis',
      },
    ]);
    playSound('atis');
  };

  const handleCreateAccount = () => {
    const callback =
      sessionId && flight?.id && accessId
        ? `/my-flights?claimSessionId=${encodeURIComponent(sessionId)}&claimFlightId=${encodeURIComponent(String(flight.id))}&claimToken=${encodeURIComponent(accessId)}`
        : '/my-flights';
    window.location.href = getDiscordLoginUrl(callback);
  };

  const airportName = (icao?: string) => {
    if (!icao) return undefined;
    const name = getAirportName(icao, airports)
      .replace(new RegExp(`^${icao}\\b[\\s\\-–]*`, 'i'), '')
      .trim();
    return name || undefined;
  };

  const shownLayout = draftLayout ?? layout;

  const pointerPct = (clientX: number) => {
    const rect = mainRef.current?.getBoundingClientRect();
    return rect && rect.width > 0
      ? ((clientX - rect.left) / rect.width) * 100
      : null;
  };

  const resize = (divider: 'sidebar' | 'notes', pct: number) =>
    divider === 'sidebar'
      ? dragSidebarDivider(shownLayout, pct, notesEnabled)
      : dragNotesDivider(shownLayout, pct);

  const commitLayout = (next: typeof layout) =>
    saveLayout({
      sidebarWidth: next.sidebar,
      terminalWidth: next.terminal,
      notesWidth: notesEnabled ? next.notes : notesWidth,
    });

  const startDrag =
    (divider: 'sidebar' | 'notes') => (e: React.PointerEvent) => {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      setDragging(divider);
      setDraftLayout(layout);
    };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const pct = pointerPct(e.clientX);
    if (pct !== null) setDraftLayout(resize(dragging, pct));
  };

  const handlePointerUp = () => {
    if (!dragging || !draftLayout) return;
    commitLayout(draftLayout);
    setDragging(null);
    setDraftLayout(null);
  };

  const stepDivider = (divider: 'sidebar' | 'notes', delta: number) => {
    const position =
      divider === 'sidebar' ? layout.sidebar : 100 - layout.notes;
    commitLayout(resize(divider, position + delta));
  };
  const panelTransition =
    !dragging &&
    'md:transition-[flex-grow] md:duration-300 md:ease-out motion-reduce:transition-none';

  const isLoading = loading || dataLoading || settingsLoading;
  const failed = !isLoading && (error || !flight || !sessionId || !flightId);

  return (
    <TooltipProvider>
      <div className="shadcn-scope flex min-h-screen flex-col bg-background text-foreground md:h-screen">
        <Navbar />

        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-4 pt-21 pb-3 sm:px-6">
          {isLoading ? (
            <Skeleton className="h-7 w-36" />
          ) : (
            <h1 className="flex min-w-0 items-center gap-2.5 text-xl font-bold tracking-tight">
              <Plane className="size-5 shrink-0 text-blue-400" />
              <span className="truncate">
                {failed || !flight ? 'ACARS' : flight.callsign}
              </span>
            </h1>
          )}
          {flight && !failed && (
            <div className="flex flex-wrap gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={notesEnabled ? 'Hide notes' : 'Show notes'}
                    aria-pressed={notesEnabled}
                    className={cn(
                      'hidden md:inline-flex',
                      SIGNATURE_TONES.blue,
                      notesEnabled && 'bg-blue-600 text-white dark:bg-blue-600'
                    )}
                    onClick={() => saveLayout({ notesEnabled: !notesEnabled })}
                  >
                    <NotebookPen />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="shadcn-scope" sideOffset={6}>
                  {notesEnabled ? 'Hide notes' : 'Show notes'}
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

        {isLoading ? (
          <main className="flex min-h-0 flex-1 flex-col border-t border-zinc-800 md:flex-row">
            <PanelSkeleton className="border-b md:flex-[3_1_0%] md:border-r md:border-b-0" />
            <div className="order-first h-[65vh] border-b border-zinc-800 bg-black/40 md:order-none md:h-auto md:flex-[5_1_0%] md:border-b-0" />
            <PanelSkeleton className="md:flex-[2_1_0%] md:border-l" />
          </main>
        ) : failed ? (
          <main className="flex flex-col items-center gap-4 px-4 pt-8 pb-16">
            <div
              role="alert"
              className="flex w-full max-w-lg items-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 px-5 py-3 text-sm text-destructive"
            >
              <AlertTriangle className="size-4 shrink-0" />
              {error || 'Flight not found.'}
            </div>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className={SIGNATURE_TONES.blue}
            >
              <Link to="/">
                <Home />
                Return home
              </Link>
            </Button>
          </main>
        ) : (
          flight &&
          sessionId &&
          flightId && (
            <main
              ref={mainRef}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className={cn(
                'flex min-h-0 flex-1 flex-col border-t border-zinc-800 md:flex-row',
                dragging && 'cursor-col-resize select-none'
              )}
            >
              <div
                style={panelWidth(shownLayout.sidebar)}
                className={cn(
                  'flex min-h-0 min-w-0 flex-col border-b border-zinc-800 md:flex-[var(--w)_1_0%] md:border-b-0',
                  panelTransition
                )}
              >
                <AcarsFlightPlan
                  flight={flight}
                  spokenCallsign={
                    spokenCallsign !== flight.callsign
                      ? (spokenCallsign ?? undefined)
                      : undefined
                  }
                  departureName={airportName(flight.departure)}
                  arrivalName={airportName(flight.arrival)}
                  className="shrink-0 border-b border-zinc-800 md:max-h-[60%]"
                />
                <AcarsStations
                  sessions={activeSessions}
                  departure={flight.departure}
                  arrival={flight.arrival}
                  onShowAtis={handleShowAtis}
                  className="md:flex-1"
                />
              </div>
              <AcarsDivider
                label="Resize flight panel"
                value={shownLayout.sidebar}
                active={dragging === 'sidebar'}
                onPointerDown={startDrag('sidebar')}
                onKeyStep={(delta) => stepDivider('sidebar', delta)}
              />
              <AcarsTerminal
                messages={terminalMessages}
                pdcState={pdcState}
                onRequestPDC={handleRequestPDC}
                connected={connected}
                chat={{
                  canSend: !!user,
                  onSend: async (text) => {
                    if (!chatRef.current) throw new Error('Chat is not ready');
                    await chatRef.current.send(text);
                  },
                  onSignIn: handleCreateAccount,
                  onReport: setReportTarget,
                  onDelete: setDeleteTarget,
                }}
                className={cn(
                  'order-first h-[65vh] border-b border-zinc-800 md:order-none md:h-auto md:flex-[var(--w)_1_0%] md:border-b-0',
                  panelTransition
                )}
                style={panelWidth(shownLayout.terminal)}
              />
              {notesEnabled && (
                <AcarsDivider
                  label="Resize notes panel"
                  value={100 - shownLayout.notes}
                  active={dragging === 'notes'}
                  onPointerDown={startDrag('notes')}
                  onKeyStep={(delta) => stepDivider('notes', delta)}
                />
              )}
              <div
                inert={!notesEnabled}
                style={panelWidth(shownLayout.notes)}
                className={cn(
                  'min-h-0 min-w-0 overflow-hidden md:flex md:flex-[var(--w)_1_0%]',
                  notesEnabled ? 'flex' : 'hidden',
                  panelTransition
                )}
              >
                <AcarsNotes
                  sessionId={sessionId}
                  flightId={flightId}
                  className="w-full md:min-w-56"
                />
              </div>
            </main>
          )
        )}

        {flight && (
          <AcarsCharts
            open={showCharts}
            onClose={() => setShowCharts(false)}
            airports={airports}
            settings={settings}
            departure={flight.departure}
            arrival={flight.arrival}
          />
        )}

        {showRating && session?.createdBy && (
          <ControllerRatingPopup
            controllerId={session.createdBy}
            flightId={flightId}
            sessionId={sessionId}
            onClose={() => {
              localStorage.setItem(`rating_dismissed_${flightId}`, '1');
              setShowRating(false);
            }}
          />
        )}

        <ReportMessageDialog
          message={
            reportTarget
              ? { author: reportTarget.station, text: reportTarget.text }
              : null
          }
          onOpenChange={(open) => !open && setReportTarget(null)}
          onSubmit={async (reason) => {
            if (!reportTarget?.chatId || !chatRef.current) {
              throw new Error('Chat is not connected');
            }
            await chatRef.current.report(reportTarget.chatId, reason);
          }}
        />

        <DeleteMessageDialog
          text={deleteTarget?.text ?? null}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          onConfirm={async () => {
            if (!deleteTarget?.chatId || !chatRef.current) {
              throw new Error('Chat is not connected');
            }
            await chatRef.current.remove(deleteTarget.chatId);
          }}
        />

        {!user && (
          <Dialog open={showAccountPrompt} onOpenChange={setShowAccountPrompt}>
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
                  onClick={() => setShowAccountPrompt(false)}
                >
                  Skip for now
                </Button>
                <Button onClick={handleCreateAccount}>
                  Sign in with Discord
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </TooltipProvider>
  );
}
