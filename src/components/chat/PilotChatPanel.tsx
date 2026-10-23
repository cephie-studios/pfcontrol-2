import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Flag,
  Loader2,
  Megaphone,
  MessagesSquare,
  Search,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  BROADCAST_FLIGHT_ID,
  createPilotChatSocket,
  type PilotChatClient,
  type PilotChatFlight,
  type PilotChatMessage,
} from '../../sockets/pilotChatSocket';
import ReportMessageDialog from './ReportMessageDialog';
import DeleteMessageDialog from './DeleteMessageDialog';
import { useAuth } from '../../hooks/auth/useAuth';
import {
  COMPOSER_BOX_CLASS,
  COMPOSER_TEXTAREA_CLASS,
  ComposerSendButton,
} from './ComposerBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { minDuration } from '@/lib/minDuration';
import { cn } from '@/lib/utils';

const formatZulu = (iso: string) =>
  `${new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  })}Z`;

function IconButton({
  label,
  className,
  ...props
}: React.ComponentProps<typeof Button> & { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          className={cn(
            'text-zinc-400 hover:bg-transparent hover:text-white focus-visible:ring-2 dark:hover:bg-transparent',
            className
          )}
          {...props}
        />
      </TooltipTrigger>
      <TooltipContent className="shadcn-scope z-10001" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export default function PilotChatPanel({
  sessionId,
  accessId,
  station,
  active,
  onUnreadChange,
}: {
  sessionId: string;
  accessId: string;
  station?: string;
  active: boolean;
  onUnreadChange: (count: number) => void;
}) {
  const { user } = useAuth();
  const clientRef = useRef<PilotChatClient | null>(null);
  const [connected, setConnected] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [flights, setFlights] = useState<PilotChatFlight[]>([]);
  const [messages, setMessages] = useState<PilotChatMessage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lastRead, setLastRead] = useState<Record<string, number>>({});
  const [query, setQuery] = useState('');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [reportTarget, setReportTarget] = useState<PilotChatMessage | null>(
    null
  );
  const [deleteTarget, setDeleteTarget] = useState<PilotChatMessage | null>(
    null
  );
  const endRef = useRef<HTMLDivElement>(null);
  const initialReadRef = useRef(false);

  useEffect(() => {
    const client = createPilotChatSocket({ sessionId, accessId, station });
    clientRef.current = client;
    const { socket } = client;
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on(
      'init',
      (data: { flights?: PilotChatFlight[]; messages: PilotChatMessage[] }) => {
        setFlights(data.flights ?? []);
        setMessages(data.messages);
        if (!initialReadRef.current) {
          initialReadRef.current = true;
          const read: Record<string, number> = {};
          for (const m of data.messages) read[m.flightId] = m.id;
          setLastRead(read);
        }
        setLoaded(true);
      }
    );
    socket.on('message', (message: PilotChatMessage) => {
      setMessages((prev) =>
        prev.some((m) => m.id === message.id) ? prev : [...prev, message]
      );
    });
    socket.on('messageDeleted', ({ id }: { id: number }) => {
      setMessages((prev) => prev.filter((m) => m.id !== id));
    });
    return () => {
      socket.disconnect();
      clientRef.current = null;
    };
  }, [sessionId, accessId, station]);

  useEffect(() => {
    if (active) clientRef.current?.refresh();
  }, [active]);

  const threads = useMemo(() => {
    const byId = new Map<
      string,
      PilotChatFlight & { last?: PilotChatMessage; unread: number }
    >();
    for (const flight of flights) byId.set(flight.id, { ...flight, unread: 0 });
    for (const m of messages) {
      if (m.flightId === BROADCAST_FLIGHT_ID) continue;
      const thread = byId.get(m.flightId) ?? {
        id: m.flightId,
        callsign: m.callsign,
        departure: null,
        arrival: null,
        unread: 0,
      };
      thread.last = m;
      if (m.sender === 'pilot' && m.id > (lastRead[m.flightId] ?? 0)) {
        thread.unread += 1;
      }
      byId.set(m.flightId, thread);
    }
    return [...byId.values()].sort(
      (a, b) =>
        (b.last ? Date.parse(b.last.sentAt) : 0) -
        (a.last ? Date.parse(a.last.sentAt) : 0)
    );
  }, [flights, messages, lastRead]);

  const totalUnread = threads.reduce((sum, t) => sum + t.unread, 0);
  useEffect(() => {
    onUnreadChange(totalUnread);
  }, [totalUnread, onUnreadChange]);

  const isBroadcast = selectedId === BROADCAST_FLIGHT_ID;
  const sessionLabel = station?.split('_')[0] || 'session';
  const lastBroadcast = useMemo(
    () => messages.filter((m) => m.flightId === BROADCAST_FLIGHT_ID).at(-1),
    [messages]
  );
  const selected = isBroadcast
    ? {
        id: BROADCAST_FLIGHT_ID,
        callsign: 'Session broadcast',
        departure: null,
        arrival: null,
      }
    : (threads.find((t) => t.id === selectedId) ?? null);
  const thread = useMemo(
    () => messages.filter((m) => m.flightId === selectedId),
    [messages, selectedId]
  );

  useEffect(() => {
    if (!active || !selectedId || thread.length === 0) return;
    const newest = thread[thread.length - 1].id;
    setLastRead((prev) =>
      prev[selectedId] === newest ? prev : { ...prev, [selectedId]: newest }
    );
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [active, selectedId, thread]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((t) =>
      [t.callsign, t.departure, t.arrival]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [threads, query]);

  const send = async () => {
    const text = input.trim();
    if (!text || !selectedId || !clientRef.current || sending) return;
    setSending(true);
    try {
      await minDuration(clientRef.current.send(text, selectedId));
      setInput('');
    } catch (err) {
      toast.error('Message not sent', {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <TooltipProvider>
      <div className="shadcn-scope flex min-h-0 flex-1 flex-col">
        {!selected ? (
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search callsign or airport..."
                aria-label="Search pilots"
                className="h-11 rounded-2xl border-2 border-zinc-800 bg-zinc-950 pl-10 shadow-none focus-visible:border-blue-600 dark:bg-zinc-950"
              />
            </div>
            {loaded && (
              <button
                type="button"
                onClick={() => setSelectedId(BROADCAST_FLIGHT_ID)}
                className="flex w-full items-center gap-3 rounded-[20px] border-2 border-zinc-800 px-3 py-2.5 text-left transition-colors outline-none hover:border-zinc-700 hover:bg-zinc-800/60 focus-visible:border-blue-400"
              >
                <Megaphone className="size-5 shrink-0 text-blue-400" />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-semibold">
                    Session broadcast
                  </span>
                  <span className="truncate text-xs text-zinc-400">
                    {lastBroadcast
                      ? `${lastBroadcast.station || lastBroadcast.username}: ${lastBroadcast.message}`
                      : `Reaches every ${sessionLabel} pilot with ACARS open`}
                  </span>
                </div>
              </button>
            )}
            {!loaded ? (
              <div className="flex justify-center py-10">
                <Loader2 className="size-6 animate-spin text-zinc-500" />
              </div>
            ) : threads.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <MessagesSquare className="size-10 text-blue-400" />
                <p className="font-medium">No pilots yet</p>
                <p className="text-sm text-muted-foreground">
                  Flights filed with ACARS show up here.
                </p>
              </div>
            ) : filtered.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nothing matches “{query.trim()}”.
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {filtered.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(t.id)}
                      className="flex w-full items-center gap-3 rounded-[20px] border-2 border-transparent px-3 py-2.5 text-left transition-colors outline-none hover:bg-zinc-800/60 focus-visible:border-blue-400"
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold">
                            {t.callsign || 'Unknown'}
                          </span>
                          {t.departure && (
                            <span className="flex items-center gap-1 font-mono text-xs text-zinc-500">
                              {t.departure}
                              <ArrowRight className="size-3" />
                              {t.arrival || '----'}
                            </span>
                          )}
                        </span>
                        <span className="truncate text-xs text-zinc-400">
                          {t.last
                            ? `${t.last.sender === 'atc' ? 'You: ' : ''}${t.last.message}`
                            : 'No messages yet'}
                        </span>
                      </div>
                      {t.unread > 0 && (
                        <span className="shrink-0 font-mono text-xs font-semibold text-blue-400 tabular-nums">
                          {t.unread} new
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <>
            <div className="flex shrink-0 items-center gap-2 px-3 pt-3 pb-1">
              <IconButton
                label="Back to pilots"
                onClick={() => setSelectedId(null)}
              >
                <ArrowLeft />
              </IconButton>
              {isBroadcast && (
                <Megaphone className="size-4 shrink-0 text-blue-400" />
              )}
              <span
                className={cn('font-semibold', !isBroadcast && 'font-mono')}
              >
                {selected.callsign || 'Unknown'}
              </span>
              {selected.departure && (
                <span className="flex items-center gap-1 font-mono text-xs text-zinc-500">
                  {selected.departure}
                  <ArrowRight className="size-3" />
                  {selected.arrival || '----'}
                </span>
              )}
            </div>
            <ol className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-3">
              {thread.length === 0 && (
                <li className="py-8 text-center text-sm text-muted-foreground">
                  {isBroadcast
                    ? `Messages here reach every pilot who filed with your ${sessionLabel} session and has ACARS open. Pilots in other sessions won't see them.`
                    : 'Send the first message to this pilot.'}
                </li>
              )}
              {thread.map((m) => (
                <li key={m.id} className="group flex gap-2">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-baseline gap-2 text-xs">
                      <span
                        className={cn(
                          'font-mono font-semibold',
                          m.sender === 'atc' ? 'text-blue-400' : 'text-zinc-200'
                        )}
                      >
                        {m.sender === 'atc'
                          ? m.station || m.username
                          : m.callsign || m.username}
                      </span>
                      <span className="text-zinc-500">
                        {m.sender === 'pilot' ? m.username : ''}
                      </span>
                      <span className="ml-auto font-mono text-zinc-600 tabular-nums">
                        {formatZulu(m.sentAt)}
                      </span>
                    </span>
                    <p className="font-mono text-sm break-words whitespace-pre-wrap text-zinc-300">
                      {m.message}
                    </p>
                  </div>
                  {m.sender === 'atc' && m.userId === user?.userId && (
                    <IconButton
                      label="Delete message"
                      className="opacity-0 group-hover:opacity-100 hover:text-red-500 focus-visible:opacity-100"
                      onClick={() => setDeleteTarget(m)}
                    >
                      <Trash2 />
                    </IconButton>
                  )}
                  {m.sender === 'pilot' && (
                    <IconButton
                      label="Report message"
                      className="opacity-0 group-hover:opacity-100 hover:text-red-500 focus-visible:opacity-100"
                      onClick={() => setReportTarget(m)}
                    >
                      <Flag />
                    </IconButton>
                  )}
                </li>
              ))}
              <div ref={endRef} />
            </ol>
            <form
              className={cn(COMPOSER_BOX_CLASS, 'mx-4 mb-4 shrink-0')}
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
            >
              <textarea
                value={input}
                rows={3}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={
                  connected
                    ? isBroadcast
                      ? `Message all ${sessionLabel} pilots…`
                      : `Message ${selected.callsign || 'pilot'}…`
                    : 'Connecting…'
                }
                aria-label={`Message ${selected.callsign || 'pilot'}`}
                maxLength={300}
                disabled={!connected}
                className={COMPOSER_TEXTAREA_CLASS}
              />
              <div className="flex items-center justify-between gap-2 pl-2">
                <span className="text-xs text-zinc-600 tabular-nums">
                  {input.length}/300
                </span>
                <ComposerSendButton
                  sending={sending}
                  disabled={!input.trim() || !connected}
                />
              </div>
            </form>
          </>
        )}
        <DeleteMessageDialog
          text={deleteTarget?.message ?? null}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          onConfirm={async () => {
            if (!deleteTarget || !clientRef.current) {
              throw new Error('Chat is not connected');
            }
            await clientRef.current.remove(deleteTarget.id);
          }}
        />
        <ReportMessageDialog
          message={
            reportTarget
              ? {
                  author: reportTarget.callsign || reportTarget.username,
                  text: reportTarget.message,
                }
              : null
          }
          onOpenChange={(open) => !open && setReportTarget(null)}
          onSubmit={async (reason) => {
            if (!reportTarget || !clientRef.current) return;
            await clientRef.current.report(reportTarget.id, reason);
          }}
        />
      </div>
    </TooltipProvider>
  );
}
