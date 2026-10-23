import { useState, useEffect, useMemo } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Plane,
  Radio,
  Search,
  Send,
} from 'lucide-react';
import { fetchFrequencies } from '../../utils/fetch/data';
import type { AirportFrequency } from '../../types/airports';
import type { Flight } from '../../types/flight';
import {
  PanelBody,
  PanelFooter,
  PanelHeader,
  PanelSection,
  SidePanel,
} from '../common/SidePanel';
import {
  FIELD_INPUT_CLASS,
  FIELD_OPTION_CLASS,
  FIELD_PANEL_CLASS,
  FIELD_TRIGGER_CLASS,
} from '../dropdowns/fieldStyles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  containsHateSpeech,
  containsProfanity,
} from '../../utils/hateSpeechFilter';
import { minDuration } from '@/lib/minDuration';

interface ContactAcarsSidebarProps {
  open: boolean;
  onClose: () => void;
  flights: Flight[];
  onSendContact: (
    flightId: string | number,
    message: string,
    station: string,
    position: string
  ) => void;
  activeAcarsFlights: Set<string | number>;
  airportIcao: string;
  fallbackFrequency?: string;
}

export default function ContactAcarsSidebar({
  open,
  onClose,
  flights,
  onSendContact,
  airportIcao,
  fallbackFrequency,
}: ContactAcarsSidebarProps) {
  const [selectedFlight, setSelectedFlight] = useState<Flight | null>(null);
  const [customMessage, setCustomMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<string>('TWR');
  const [frequencies, setFrequencies] = useState<
    { type: string; freq: string }[]
  >([]);
  const [searchTerm, setSearchTerm] = useState('');

  const isCenterStation = airportIcao.includes('_CTR');

  const filteredFlights = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return flights;
    return flights.filter((flight) =>
      [
        flight.callsign,
        flight.user?.discord_username,
        flight.aircraft,
        flight.departure,
        flight.arrival,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [flights, searchTerm]);

  const getDefaultMessage = () => {
    const freq = frequencies.find((f) => f.type === selectedPosition);
    if (freq) {
      return isCenterStation
        ? `CONTACT ME ON ${airportIcao} ${freq.freq}`
        : `CONTACT ME ON ${airportIcao}_${selectedPosition} ${freq.freq}`;
    }
    if (isCenterStation) {
      return fallbackFrequency
        ? `CONTACT ME ON ${airportIcao} ${fallbackFrequency}`
        : `CONTACT ME ON ${airportIcao}`;
    }
    return 'CONTACT ME ON FREQUENCY';
  };

  const currentMessage = customMessage.trim() || getDefaultMessage();
  const hasContentViolation =
    containsProfanity(currentMessage) || containsHateSpeech(currentMessage);
  const canSendMessage = Boolean(
    selectedFlight && !sending && !hasContentViolation
  );

  useEffect(() => {
    if (!airportIcao) return;
    const loadFrequencies = async () => {
      try {
        const freqData: AirportFrequency[] = await fetchFrequencies();
        const airportFreq = freqData.find((f) => f.icao === airportIcao);
        const freqs = Array.isArray(airportFreq?.frequencies)
          ? airportFreq.frequencies
          : [];
        setFrequencies(freqs);
        if (freqs.length > 0) {
          const twr = freqs.find((f) => f.type === 'TWR');
          setSelectedPosition(twr ? 'TWR' : freqs[0].type);
        }
      } catch {
        setFrequencies([]);
      }
    };
    loadFrequencies();
  }, [airportIcao]);

  const handleSend = async () => {
    if (!selectedFlight || !canSendMessage) return;
    setSending(true);
    try {
      await minDuration(
        Promise.resolve(
          onSendContact(
            selectedFlight.id,
            currentMessage,
            airportIcao,
            selectedPosition
          )
        )
      );
      setCustomMessage('');
      setSelectedFlight(null);
      onClose();
    } finally {
      setSending(false);
    }
  };

  return (
    <SidePanel open={open} className="shadcn-scope">
      <PanelHeader icon={Radio} title="Contact ACARS" onClose={onClose} />

      <PanelBody>
        {flights.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-zinc-800 bg-zinc-900 px-6 py-10 text-center">
            <Radio className="size-10 text-blue-400" />
            <div className="space-y-1">
              <p className="font-medium">No active ACARS terminals</p>
              <p className="text-sm text-muted-foreground">
                Pilots need to open their ACARS terminal first.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search callsign, pilot, aircraft, route..."
                aria-label="Search flights"
                className="h-11 rounded-xl border-2 border-zinc-800 bg-zinc-950 pl-10 shadow-none focus-visible:border-blue-600 dark:bg-zinc-950"
              />
            </div>

            <PanelSection title="Flight">
              {filteredFlights.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Nothing matches “{searchTerm.trim()}”.
                </p>
              ) : (
                <div role="radiogroup" className="flex flex-col gap-2">
                  {filteredFlights.map((flight) => {
                    const isSelected = selectedFlight?.id === flight.id;
                    return (
                      <button
                        key={flight.id}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => setSelectedFlight(flight)}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left transition-colors outline-none focus-visible:border-blue-400',
                          isSelected
                            ? 'border-blue-600 bg-zinc-800'
                            : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700 hover:bg-zinc-800/60'
                        )}
                      >
                        {flight.user?.discord_avatar_url ? (
                          <img
                            src={flight.user.discord_avatar_url}
                            alt=""
                            className="size-9 shrink-0 rounded-full"
                          />
                        ) : (
                          <span className="flex size-9 shrink-0 items-center justify-center">
                            <Plane className="size-5 text-zinc-500" />
                          </span>
                        )}
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="font-mono text-sm font-semibold">
                            {flight.callsign}
                          </span>
                          <span className="truncate text-xs text-zinc-400">
                            {flight.user?.discord_username || 'Unknown pilot'}
                          </span>
                          <span className="flex items-center gap-1.5 font-mono text-xs text-zinc-300">
                            {flight.departure || '----'}
                            <ArrowRight className="size-3 text-zinc-500" />
                            {flight.arrival || '----'}
                            {flight.aircraft && (
                              <span className="ml-1.5 text-zinc-500">
                                {flight.aircraft}
                              </span>
                            )}
                          </span>
                        </div>
                        {isSelected && (
                          <CheckCircle2 className="size-5 shrink-0 text-blue-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </PanelSection>

            {selectedFlight && (
              <PanelSection title="Message">
                <div className="flex flex-col gap-3">
                  {frequencies.length > 0 && !isCenterStation && (
                    <Select
                      value={selectedPosition}
                      onValueChange={setSelectedPosition}
                    >
                      <SelectTrigger
                        aria-label="Contact position"
                        className={cn(
                          FIELD_TRIGGER_CLASS,
                          'shadow-none data-[size=default]:h-11 dark:bg-zinc-950 dark:hover:bg-zinc-950'
                        )}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent
                        position="popper"
                        className={cn(
                          'shadcn-scope z-10001 p-0',
                          FIELD_PANEL_CLASS
                        )}
                      >
                        {frequencies.map((freq) => (
                          <SelectItem
                            key={freq.type}
                            value={freq.type}
                            className={cn(FIELD_OPTION_CLASS, 'font-mono')}
                          >
                            {freq.type} {freq.freq}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Input
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSend();
                    }}
                    placeholder={getDefaultMessage()}
                    aria-label="Message"
                    aria-invalid={hasContentViolation || undefined}
                    maxLength={100}
                    className={cn(FIELD_INPUT_CLASS, 'font-mono')}
                  />
                  {hasContentViolation ? (
                    <p className="text-xs text-red-400">
                      This message violates our guidelines and can't be sent.
                    </p>
                  ) : (
                    <p className="text-xs text-zinc-500">
                      Leave empty to send the default message.
                    </p>
                  )}
                </div>
              </PanelSection>
            )}
          </>
        )}
      </PanelBody>

      <PanelFooter>
        <Button variant="outline" onClick={onClose} disabled={sending}>
          Cancel
        </Button>
        <Button onClick={handleSend} disabled={!canSendMessage}>
          {sending ? <Loader2 className="animate-spin" /> : <Send />}
          {sending ? 'Sending…' : 'Send message'}
        </Button>
      </PanelFooter>
    </SidePanel>
  );
}
