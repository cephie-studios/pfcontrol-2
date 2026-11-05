import { useEffect, useState, type FormEvent } from 'react';
import { Loader2, LogIn, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SIGNATURE_TONES } from '@/lib/signatureTones';
import { usePendingAction } from '../../hooks/usePendingAction';
import {
  ACARS_CHARACTERS,
  DATALINK_STATION,
  MAX_ACARS_MESSAGE,
  isSendableAcarsText,
  normalizeAcarsText,
} from '../../utils/externalAcars';
import type { ProviderDatalink } from '../../types/externalAcars';
import {
  COMPOSER_BAR_CLASS,
  COMPOSER_INPUT_CLASS,
  ComposerSendButton,
} from '../chat/ComposerBar';

type Action = 'logon' | 'logoff' | 'send';

export default function ExternalComposer({
  datalink,
  departure,
  flying,
  busy,
  onLogon,
  onLogoff,
  onSend,
}: {
  datalink?: ProviderDatalink | null;
  departure?: string | null;
  flying: boolean;
  busy: boolean;
  onLogon: (station: string) => Promise<boolean>;
  onLogoff: () => Promise<boolean>;
  onSend: (text: string) => Promise<boolean>;
}) {
  const [station, setStation] = useState('');
  const [entry, setEntry] = useState('');
  const { pending, run } = usePendingAction<Action>();

  useEffect(() => {
    if (departure) setStation((current) => current || departure);
  }, [departure]);

  const connected = datalink?.state === 'connected';
  const connecting = datalink?.state === 'logon_pending';
  const suspended = !!datalink?.suspended;
  const disabled = busy || pending !== null;

  const sendable = isSendableAcarsText(entry);

  const submitLogon = (event: FormEvent) => {
    event.preventDefault();
    if (disabled || !flying || !DATALINK_STATION.test(station)) return;
    void run('logon', () => onLogon(station));
  };

  const submitMessage = (event: FormEvent) => {
    event.preventDefault();
    if (disabled || !sendable) return;
    void run('send', async () => {
      if (await onSend(normalizeAcarsText(entry))) {
        setEntry((current) => (current === entry ? '' : current));
      }
    });
  };

  if (!datalink) return null;

  return (
    <div className="flex shrink-0 flex-col gap-3 border-t border-zinc-800 p-3">
      {suspended && (
        <p role="status" className="px-2 text-sm text-red-400">
          Datalink suspended
          {datalink?.suspended_reason
            ? `: ${datalink.suspended_reason.toLowerCase()}`
            : ''}
          . Voice is unaffected.
        </p>
      )}

      {connecting && !suspended && (
        <p
          role="status"
          className="flex items-center gap-2 px-2 text-sm text-zinc-300"
        >
          <Loader2 className="size-4 shrink-0 animate-spin text-amber-400" />
          Logged on to {datalink.station}. Waiting for a controller to accept
          the connection.
        </p>
      )}

      {!connected && !connecting && !suspended && (
        <form onSubmit={submitLogon} className="flex flex-col gap-2">
          <Label htmlFor="datalink-station" className="px-2 text-zinc-300">
            Datalink station
          </Label>
          {!flying && (
            <p className="px-2 text-sm text-zinc-500">
              Datalink opens once your aircraft is spawned and on a strip.
            </p>
          )}
          <div className={COMPOSER_BAR_CLASS}>
            <Input
              id="datalink-station"
              value={station}
              disabled={disabled}
              placeholder="ICAO"
              autoComplete="off"
              onChange={(event) =>
                setStation(
                  event.target.value
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, '')
                    .slice(0, 4)
                )
              }
              className={COMPOSER_INPUT_CLASS}
            />
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              disabled={disabled || !flying || !DATALINK_STATION.test(station)}
              className={`shrink-0 rounded-full ${SIGNATURE_TONES.blue}`}
            >
              {pending === 'logon' ? (
                <Loader2 className="animate-spin" />
              ) : (
                <LogIn />
              )}
              Connect
            </Button>
          </div>
        </form>
      )}

      {connected && !suspended && (
        <form onSubmit={submitMessage} className="flex flex-col gap-1">
          <Label htmlFor="datalink-message" className="px-2 text-zinc-300">
            Message ATC
          </Label>
          <div className={COMPOSER_BAR_CLASS}>
            <Input
              id="datalink-message"
              value={entry}
              disabled={disabled}
              maxLength={MAX_ACARS_MESSAGE}
              placeholder="Message ATC…"
              autoComplete="off"
              title="Capitals, digits and . , - / + : ' ( ) ? only"
              onChange={(event) => {
                const next = event.target.value.toUpperCase();
                if (ACARS_CHARACTERS.test(next)) setEntry(next);
              }}
              className={COMPOSER_INPUT_CLASS}
            />
            <ComposerSendButton
              sending={pending === 'send'}
              disabled={disabled || !sendable}
            />
          </div>
          <p className="px-2 text-right text-xs text-zinc-500 tabular-nums">
            {entry.length}/{MAX_ACARS_MESSAGE}
          </p>
        </form>
      )}

      {(connected || connecting || suspended) && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={() => void run('logoff', onLogoff)}
          className={`self-start ${SIGNATURE_TONES.red}`}
        >
          {pending === 'logoff' ? (
            <Loader2 className="animate-spin" />
          ) : (
            <LogOut />
          )}
          Disconnect
        </Button>
      )}
    </div>
  );
}
