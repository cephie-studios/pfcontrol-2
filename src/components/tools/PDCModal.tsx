import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, Copy, FileText, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useData } from '../../hooks/data/useData';
import type { Flight } from '../../types/flight';
import { FIELD_INPUT_CLASS } from '../dropdowns/fieldStyles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { minDuration } from '@/lib/minDuration';
import { SIGNATURE_TONES } from '@/lib/signatureTones';
import { cn } from '@/lib/utils';

interface PDCModalProps {
  isOpen: boolean;
  onClose: () => void;
  flight: Flight | null;
  onIssuePDC?: (
    flightId: string | number,
    pdcText: string
  ) => Promise<void> | void;
}

type PdcFormat = 'standard' | 'simplified';
type SavedFrequencies = Record<
  string,
  { clearance?: string; departure?: string }
>;

const FALLBACK_FREQ = '122.800';
const FREQ_STORAGE_KEY = 'pdcFrequencies';

const EMERGENCY_SQUAWKS = new Set(['7500', '7600', '7700']);

function randomSquawk(): string {
  const code = Array.from({ length: 4 }, () =>
    Math.floor(Math.random() * 8)
  ).join('');
  return EMERGENCY_SQUAWKS.has(code) ? randomSquawk() : code;
}

const identifierFor = (squawk: string, callsign?: string) =>
  squawk.slice(0, 3) + (callsign?.match(/[A-Z]/i)?.[0].toUpperCase() ?? 'A');

function defaultRemarks(flight: Flight) {
  const sid = flight.sid || 'DCT';
  const climb =
    flight.flight_type === 'VFR' || sid === 'RADAR VECTORS'
      ? `CLEARED ${sid}`
      : `CLEARED ${sid} DEPARTURE CLIMB VIA SID`;
  return `${climb} EXP ${flight.cruisingFL || flight.clearedFL || '030'} 10 MIN AFT DP`;
}

function readSavedFrequencies(): SavedFrequencies {
  try {
    return JSON.parse(localStorage.getItem(FREQ_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function Field({
  id,
  label,
  hint,
  children,
  className,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('grid gap-2', className)}>
      <Label htmlFor={id} className="text-zinc-300">
        {label}
        {hint && <span className="font-normal text-zinc-500">{hint}</span>}
      </Label>
      {children}
    </div>
  );
}

export default function PDCModal({
  isOpen,
  onClose,
  flight,
  onIssuePDC,
}: PDCModalProps) {
  const { frequencies } = useData();
  const [format, setFormat] = useState<PdcFormat>('standard');
  const [squawk, setSquawk] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [clearanceFreq, setClearanceFreq] = useState('');
  const [departureFreq, setDepartureFreq] = useState('');
  const [remarks, setRemarks] = useState('');
  const [copied, setCopied] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [autoSquawk] = useState(randomSquawk);

  const departure = flight?.departure?.toUpperCase() ?? '';

  useEffect(() => {
    if (!isOpen || !flight) return;
    const saved = readSavedFrequencies()[departure] ?? {};
    setSquawk('');
    setIdentifier('');
    setClearanceFreq(saved.clearance ?? '');
    setDepartureFreq(saved.departure ?? '');
    setRemarks(defaultRemarks(flight));
    setCopied(false);
  }, [isOpen, flight?.id]);

  useEffect(() => {
    if (!copied) return;
    const timeout = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timeout);
  }, [copied]);

  const airportFreqs = useMemo(() => {
    const entry = frequencies.find((f) => f.icao?.toUpperCase() === departure);
    const list: { type?: string; freq: string }[] = Array.isArray(
      entry?.frequencies
    )
      ? entry.frequencies
      : [];
    const find = (code: string) =>
      list.find((f) => f.type?.toUpperCase().includes(code))?.freq;
    return {
      clearance: find('DEL') || find('GND') || FALLBACK_FREQ,
      departure: find('APP') || find('TWR') || FALLBACK_FREQ,
    };
  }, [frequencies, departure]);

  const saveFrequency = (key: 'clearance' | 'departure', value: string) => {
    if (!departure) return;
    try {
      const saved = readSavedFrequencies();
      saved[departure] = { ...saved[departure], [key]: value || undefined };
      localStorage.setItem(FREQ_STORAGE_KEY, JSON.stringify(saved));
    } catch {
      // storage unavailable; the value still applies to this PDC
    }
  };

  const effectiveSquawk = squawk || flight?.squawk || autoSquawk;
  const effectiveIdentifier =
    identifier || identifierFor(effectiveSquawk, flight?.callsign);
  const effectiveClearance = clearanceFreq || airportFreqs.clearance;
  const effectiveDeparture = departureFreq || airportFreqs.departure;

  const pdcText = useMemo(() => {
    if (!flight) return '';
    const sid = flight.sid || 'DCT';
    const altitude = flight.clearedFL || '030';

    if (format === 'simplified') {
      return `PDC FOR ${flight.callsign}
CLEARED TO ${flight.arrival} VIA ${sid}
CLIMB AND MAINTAIN ${altitude}
SQUAWK ${effectiveSquawk}
DEPARTURE ${effectiveDeparture}
CLEARANCE ${effectiveClearance}
IDENTIFIER ${effectiveIdentifier}${remarks ? `\nREMARKS: ${remarks}` : ''}`;
    }

    return `ACARS: PDC | CALLSIGN: ${flight.callsign} | EQUIPMENT: ${flight.aircraft || 'UNKN'}/L |
DEPARTURE: ${flight.departure} | DESTINATION: ${flight.arrival} |
ROUTE: ${flight.departure}.${sid}..${flight.arrival} |
ALTITUDE: ${altitude} | TRANSPONDER: ${effectiveSquawk} | REMARKS:
${remarks}, DPFRQ ${effectiveDeparture} CTC ${effectiveClearance} TO PUSH
IDENTIFIER: ${effectiveIdentifier}`;
  }, [
    flight,
    format,
    remarks,
    effectiveSquawk,
    effectiveIdentifier,
    effectiveClearance,
    effectiveDeparture,
  ]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(pdcText);
      setCopied(true);
      toast.success('PDC copied');
    } catch {
      toast.error('Could not copy the PDC');
    }
  };

  const handleIssue = async () => {
    if (!flight || !onIssuePDC) return;
    setIssuing(true);
    try {
      await minDuration(Promise.resolve(onIssuePDC(flight.id, pdcText)));
      toast.success(`PDC sent to ${flight.callsign}`);
      onClose();
    } catch (err) {
      toast.error('Failed to send the PDC', {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setIssuing(false);
    }
  };

  const squawkInvalid = squawk.length > 0 && squawk.length < 4;

  return (
    <Dialog
      open={isOpen && !!flight}
      onOpenChange={(open) => !open && !issuing && onClose()}
    >
      <DialogContent className="shadcn-scope z-10001 max-h-[90vh] gap-5 overflow-y-auto sm:max-w-2xl">
        {flight && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2.5">
                <FileText className="size-5 text-blue-400" />
                PDC for {flight.callsign}
              </DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="flex items-center gap-1.5 font-mono text-zinc-300">
                  {flight.departure || '----'}
                  <ArrowRight className="size-3.5 text-zinc-500" />
                  {flight.arrival || '----'}
                </span>
                {flight.aircraft && (
                  <span className="font-mono text-zinc-300">
                    {flight.aircraft}
                  </span>
                )}
                <span>Check the clearance before you send it.</span>
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <ToggleGroup
                  type="single"
                  value={format}
                  onValueChange={(value) =>
                    value && setFormat(value as PdcFormat)
                  }
                  aria-label="PDC format"
                >
                  <ToggleGroupItem value="standard">Standard</ToggleGroupItem>
                  <ToggleGroupItem value="simplified">
                    Simplified
                  </ToggleGroupItem>
                </ToggleGroup>
                <Button
                  variant="ghost"
                  size="sm"
                  className={SIGNATURE_TONES.blue}
                  onClick={handleCopy}
                >
                  {copied ? <Check /> : <Copy />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
              <pre className="max-h-56 overflow-y-auto rounded-2xl border-2 border-zinc-800 bg-zinc-950 p-4 font-mono text-sm break-words whitespace-pre-wrap text-emerald-400">
                {pdcText}
              </pre>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="pdc-squawk" label="Squawk" hint="(0–7, 4 digits)">
                <Input
                  id="pdc-squawk"
                  inputMode="numeric"
                  value={squawk}
                  placeholder={flight.squawk || autoSquawk}
                  onChange={(e) =>
                    setSquawk(e.target.value.replace(/[^0-7]/g, '').slice(0, 4))
                  }
                  aria-invalid={squawkInvalid || undefined}
                  className={cn(FIELD_INPUT_CLASS, 'font-mono')}
                />
              </Field>
              <Field id="pdc-identifier" label="Identifier">
                <Input
                  id="pdc-identifier"
                  value={identifier}
                  placeholder={identifierFor(effectiveSquawk, flight.callsign)}
                  onChange={(e) =>
                    setIdentifier(
                      e.target.value
                        .replace(/[^A-Z0-9]/gi, '')
                        .slice(0, 4)
                        .toUpperCase()
                    )
                  }
                  className={cn(FIELD_INPUT_CLASS, 'font-mono')}
                />
              </Field>
              <Field id="pdc-clearance-freq" label="Clearance frequency">
                <Input
                  id="pdc-clearance-freq"
                  inputMode="decimal"
                  value={clearanceFreq}
                  placeholder={airportFreqs.clearance}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9.]/g, '');
                    setClearanceFreq(value);
                    saveFrequency('clearance', value);
                  }}
                  className={cn(FIELD_INPUT_CLASS, 'font-mono')}
                />
              </Field>
              <Field id="pdc-departure-freq" label="Departure frequency">
                <Input
                  id="pdc-departure-freq"
                  inputMode="decimal"
                  value={departureFreq}
                  placeholder={airportFreqs.departure}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9.]/g, '');
                    setDepartureFreq(value);
                    saveFrequency('departure', value);
                  }}
                  className={cn(FIELD_INPUT_CLASS, 'font-mono')}
                />
              </Field>
              <Field id="pdc-remarks" label="Remarks" className="sm:col-span-2">
                <Textarea
                  id="pdc-remarks"
                  value={remarks}
                  maxLength={250}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Enter PDC remarks…"
                  className="min-h-20 rounded-xl border-2 border-blue-600 bg-zinc-950 font-mono text-sm shadow-none hover:border-blue-500 focus-visible:border-blue-400 dark:bg-zinc-950"
                />
              </Field>
            </div>
            <p className="-mt-2 text-xs text-zinc-500">
              Empty fields use the value shown in grey.
            </p>

            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={issuing}>
                Close
              </Button>
              {onIssuePDC && (
                <Button
                  onClick={handleIssue}
                  disabled={issuing || squawkInvalid}
                >
                  {issuing ? <Loader2 className="animate-spin" /> : <Send />}
                  {issuing ? 'Sending…' : 'Send to pilot'}
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
