import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  Check,
  Copy,
  Flag,
  Loader2,
  LogIn,
  Send,
  Terminal,
  Trash2,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { toast } from 'sonner';
import type { AcarsMessage } from '../../types/acars';
import AcarsPanel from './AcarsPanel';
import {
  COMPOSER_BAR_CLASS,
  COMPOSER_INPUT_CLASS,
  ComposerSendButton,
} from '../chat/ComposerBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { minDuration } from '@/lib/minDuration';
import { SIGNATURE_TONES } from '@/lib/signatureTones';
import { cn } from '@/lib/utils';

export type PdcState = 'idle' | 'requested' | 'received';

export interface AcarsChat {
  canSend: boolean;
  onSend: (text: string) => Promise<void>;
  onSignIn: () => void;
  onReport: (message: AcarsMessage) => void;
  onDelete: (message: AcarsMessage) => void;
}

const MESSAGE_TONES: Record<AcarsMessage['type'], string> = {
  system: 'text-zinc-200',
  Success: 'text-emerald-400',
  warning: 'text-amber-400',
  pdc: 'text-cyan-400',
  contact: 'text-orange-400',
  atis: 'text-blue-400',
  atc: 'text-sky-300',
  pilot: 'text-zinc-400',
};

const formatZulu = (timestamp: string) =>
  `${new Date(timestamp).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  })}Z`;

function LineAction({
  label,
  className,
  ...props
}: React.ComponentProps<typeof Button> & { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={label}
          className={cn(
            'ml-1.5 align-middle text-zinc-500 hover:bg-transparent hover:text-white dark:hover:bg-transparent',
            className
          )}
          {...props}
        />
      </TooltipTrigger>
      <TooltipContent className="shadcn-scope" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timeout = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timeout);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Clearance copied');
    } catch {
      toast.error('Could not copy the clearance');
    }
  };

  return (
    <LineAction
      label={copied ? 'Copied!' : 'Copy clearance'}
      onClick={copy}
      className={copied ? 'text-emerald-400 hover:text-emerald-400' : undefined}
    >
      {copied ? <Check /> : <Copy />}
    </LineAction>
  );
}

const FLOATING_BAR = cn('absolute inset-x-3 bottom-3', COMPOSER_BAR_CLASS);

function Composer({ chat }: { chat: AcarsChat }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  if (!chat.canSend) {
    return (
      <div
        className={cn(FLOATING_BAR, 'justify-between text-sm text-zinc-400')}
      >
        Sign in to message ATC.
        <Button
          variant="ghost"
          size="sm"
          className={cn('rounded-full', SIGNATURE_TONES.blue)}
          onClick={chat.onSignIn}
        >
          <LogIn />
          Sign in
        </Button>
      </div>
    );
  }

  const send = async () => {
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    try {
      await minDuration(chat.onSend(value));
      setText('');
    } catch (err) {
      toast.error('Message not sent', {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <form
      className={FLOATING_BAR}
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Message ATC…"
        aria-label="Message ATC"
        maxLength={300}
        className={COMPOSER_INPUT_CLASS}
      />
      <ComposerSendButton sending={sending} disabled={!text.trim()} />
    </form>
  );
}

export default function AcarsTerminal({
  messages,
  pdcState,
  onRequestPDC,
  connected,
  chat,
  footer,
  messageActions,
  statusLabel,
  headerActions,
  pdcDisabled = false,
  pdcPending = false,
  className,
  style,
}: {
  messages: AcarsMessage[];
  pdcState: PdcState;
  onRequestPDC: () => void;
  connected: boolean;
  chat?: AcarsChat;
  footer?: ReactNode;
  messageActions?: (message: AcarsMessage) => ReactNode;
  statusLabel?: string;
  headerActions?: ReactNode;
  pdcDisabled?: boolean;
  pdcPending?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const following = useRef(true);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && following.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      if (following.current) el.scrollTop = el.scrollHeight;
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <AcarsPanel
      icon={Terminal}
      iconClassName="text-emerald-400"
      title="ACARS"
      className={cn('bg-black/40', className)}
      style={style}
      bodyClassName="relative flex flex-col overflow-hidden p-0"
      actions={
        <div className="flex flex-wrap items-center justify-end gap-2">
          {headerActions}
          <span className="flex items-center gap-1.5 text-xs text-zinc-400">
            {connected ? (
              <Wifi className="size-3.5 text-emerald-400" />
            ) : (
              <WifiOff className="size-3.5 text-red-400" />
            )}
            {statusLabel ?? (connected ? 'Linked' : 'No link')}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className={
              pdcState === 'received'
                ? SIGNATURE_TONES.emerald
                : SIGNATURE_TONES.blue
            }
            onClick={onRequestPDC}
            disabled={pdcDisabled || pdcState !== 'idle'}
          >
            {pdcPending ? (
              <Loader2 className="animate-spin" />
            ) : pdcState === 'idle' ? (
              <Send />
            ) : (
              <Check />
            )}
            {pdcState === 'idle'
              ? 'Request PDC'
              : pdcState === 'requested'
                ? 'PDC requested'
                : 'PDC received'}
          </Button>
        </div>
      }
    >
      <div
        ref={scrollRef}
        onScroll={() => {
          const el = scrollRef.current;
          if (el)
            following.current =
              el.scrollHeight - el.scrollTop - el.clientHeight < 48;
        }}
        aria-live="polite"
        className={cn(
          'min-h-0 flex-1 overflow-y-auto px-5 pt-1 font-mono text-[13px] leading-relaxed',
          footer ? 'pb-5' : 'pb-20'
        )}
      >
        <ol className="flex flex-col gap-2">
          {messages.map((message) => (
            <li key={message.id} className="group flex gap-3">
              <span className="shrink-0 text-zinc-600 tabular-nums">
                {formatZulu(message.timestamp)}
              </span>
              <p
                className={cn(
                  'min-w-0 flex-1 break-words whitespace-pre-wrap',
                  MESSAGE_TONES[message.type]
                )}
              >
                <span className="text-zinc-500">[{message.station}]</span>{' '}
                {message.text}
                {message.link && (
                  <a
                    href={message.link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1 text-blue-400 underline underline-offset-4 hover:text-blue-300"
                  >
                    {message.link.text}
                  </a>
                )}
                {message.type === 'pdc' && <CopyButton text={message.text} />}
                {message.own && chat && (
                  <LineAction
                    label="Delete message"
                    className="opacity-0 group-hover:opacity-100 hover:text-red-500 focus-visible:opacity-100"
                    onClick={() => chat.onDelete(message)}
                  >
                    <Trash2 />
                  </LineAction>
                )}
                {message.type === 'atc' &&
                  message.chatId !== undefined &&
                  chat && (
                    <LineAction
                      label="Report message"
                      className="opacity-0 group-hover:opacity-100 hover:text-red-500 focus-visible:opacity-100"
                      onClick={() => chat.onReport(message)}
                    >
                      <Flag />
                    </LineAction>
                  )}
                {messageActions?.(message)}
              </p>
            </li>
          ))}
        </ol>
      </div>
      {footer ?? (chat && <Composer chat={chat} />)}
    </AcarsPanel>
  );
}
