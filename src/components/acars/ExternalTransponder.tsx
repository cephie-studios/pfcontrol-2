import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { Loader2, RadioTower } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SIGNATURE_TONES } from '@/lib/signatureTones';
import { cn } from '@/lib/utils';
import { usePendingAction } from '../../hooks/usePendingAction';
import { SQUAWK } from '../../utils/externalAcars';
import type { ProviderFlight } from '../../types/externalAcars';
import AcarsPanel from './AcarsPanel';

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7'];
const CODE_LENGTH = 4;
const IDENT_MS = 15_000;
const CONSPICUITY = '2000';
const CONSPICUITY_ATTEMPTS = 3;

export default function ExternalTransponder({
  flight,
  busy,
  onSquawk,
  onIdent,
  className,
}: {
  flight?: ProviderFlight | null;
  busy: boolean;
  onSquawk: (code: string, silent: boolean) => Promise<boolean>;
  onIdent: () => Promise<boolean>;
  className?: string;
}) {
  const squawking = flight?.transponder?.squawk ?? null;
  const assigned = flight?.clearance?.assigned_squawk || null;
  const [entry, setEntry] = useState('');
  const [awaiting, setAwaiting] = useState<string | null>(null);
  const [identLit, setIdentLit] = useState(false);
  const { pending, run } = usePendingAction<'squawk' | 'ident'>();
  const attempts = useRef(0);

  const flying = !!flight;
  const disabled = !flying || busy || pending !== null;

  useEffect(() => {
    if (awaiting && squawking === awaiting) setAwaiting(null);
  }, [awaiting, squawking]);

  useEffect(() => {
    if (!identLit) return;
    const timer = setTimeout(() => setIdentLit(false), IDENT_MS);
    return () => clearTimeout(timer);
  }, [identLit]);

  const setCode = useCallback(
    (code: string, silent: boolean) =>
      run('squawk', async () => {
        if (!(await onSquawk(code, silent))) return;
        setAwaiting(code);
        setEntry('');
      }),
    [run, onSquawk]
  );

  useEffect(() => {
    if (!flying || squawking || awaiting || busy || pending) return;
    if (attempts.current >= CONSPICUITY_ATTEMPTS) return;
    attempts.current += 1;
    void setCode(CONSPICUITY, true);
  }, [flying, squawking, awaiting, busy, pending, setCode]);

  const press = (digit: string) => {
    if (disabled) return;
    const next = (entry.length >= CODE_LENGTH ? '' : entry) + digit;
    if (next.length < CODE_LENGTH) {
      setEntry(next);
      return;
    }
    if (SQUAWK.test(next)) void setCode(next, false);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (DIGITS.includes(event.key)) {
      event.preventDefault();
      press(event.key);
    } else if (event.key === 'Backspace') {
      event.preventDefault();
      setEntry((current) => current.slice(0, -1));
    }
  };

  const typing = entry.length > 0;
  const shown = typing ? entry : (awaiting ?? squawking ?? '');
  const cells = shown.padEnd(CODE_LENGTH, ' ').split('');

  return (
    <AcarsPanel
      icon={RadioTower}
      title="Transponder"
      className={className}
      actions={
        identLit && (
          <span
            role="status"
            className="text-xs font-semibold tracking-widest text-emerald-400"
          >
            IDENT
          </span>
        )
      }
    >
      <div
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="flex flex-col gap-3 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
      >
        <div className="rounded-2xl border-2 border-zinc-800 bg-zinc-900 p-3">
          <div className="flex items-center justify-between text-xs font-semibold tracking-wider text-zinc-500 uppercase">
            <span>{typing ? 'Entering' : 'Squawking'}</span>
            {!typing &&
              (awaiting ? (
                <span className="text-amber-400 normal-case">
                  Awaiting readback
                </span>
              ) : (
                assigned &&
                assigned !== squawking && (
                  <span className="text-amber-400 normal-case">
                    Assigned {assigned}
                  </span>
                )
              ))}
          </div>
          <div aria-live="polite" className="mt-2 grid grid-cols-4 gap-2">
            {cells.map((digit, index) => (
              <span
                key={index}
                className={cn(
                  'flex h-12 items-center justify-center rounded-xl bg-zinc-950 font-mono text-3xl font-semibold tabular-nums',
                  typing && index === entry.length && 'ring-2 ring-blue-600',
                  digit === ' '
                    ? 'text-zinc-700'
                    : typing
                      ? 'text-white'
                      : 'text-emerald-400'
                )}
              >
                {digit === ' ' ? '–' : digit}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {DIGITS.map((digit) => (
            <Button
              key={digit}
              type="button"
              variant="secondary"
              disabled={disabled}
              onClick={() => press(digit)}
              className="h-10 font-mono text-lg"
            >
              {digit}
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={disabled || !typing}
            onClick={() => setEntry((current) => current.slice(0, -1))}
          >
            Clear
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={disabled || identLit}
            onClick={() =>
              void run('ident', async () => {
                if (await onIdent()) setIdentLit(true);
              })
            }
            className={SIGNATURE_TONES.blue}
          >
            {pending === 'ident' && <Loader2 className="animate-spin" />}
            Ident
          </Button>
        </div>

        <p className="text-xs leading-relaxed text-zinc-500">
          Set to {CONSPICUITY} when your strip is picked up, until your
          controller assigns you a code. Type four digits to set a new one; your
          keyboard works too.
        </p>
      </div>
    </AcarsPanel>
  );
}
