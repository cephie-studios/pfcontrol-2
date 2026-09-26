import { useState, useEffect, useMemo } from 'react';
import { Radio, Plane, MapPin, Search, Check } from 'lucide-react';
import { fetchFrequencies } from '../../utils/fetch/data';
import type { AirportFrequency } from '../../types/airports';
import type { Flight } from '../../types/flight';
import Button from '../common/Button';
import Dropdown from '../common/Dropdown';
import {
  PanelBody,
  PanelFooter,
  PanelHeader,
  PanelSection,
  SidePanel,
  panelCardClass,
  panelInputClass,
} from '../common/SidePanel';
import { cn } from '@/lib/utils';
import {
  containsHateSpeech,
  containsProfanity,
} from '../../utils/hateSpeechFilter';

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
  activeAcarsFlights,
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

  const flightsWithAcars = flights;

  const isCenterStation = airportIcao.includes('_CTR');

  const filteredFlights = useMemo(() => {
    if (!searchTerm.trim()) return flightsWithAcars;
    const lowerSearch = searchTerm.toLowerCase();
    return flightsWithAcars.filter(
      (flight) =>
        (flight.callsign?.toLowerCase() || '').includes(lowerSearch) ||
        flight.user?.discord_username?.toLowerCase().includes(lowerSearch) ||
        flight.aircraft?.toLowerCase().includes(lowerSearch) ||
        (flight.departure?.toLowerCase() || '').includes(lowerSearch) ||
        (flight.arrival?.toLowerCase() || '').includes(lowerSearch)
    );
  }, [flightsWithAcars, searchTerm]);

  const getDefaultMessage = () => {
    if (frequencies.length > 0) {
      const freq = frequencies.find((f) => f.type === selectedPosition);
      if (freq) {
        if (isCenterStation) {
          return `CONTACT ME ON ${airportIcao} ${freq.freq}`;
        }
        return `CONTACT ME ON ${airportIcao}_${selectedPosition} ${freq.freq}`;
      }
    }

    if (isCenterStation) {
      if (fallbackFrequency) {
        return `CONTACT ME ON ${airportIcao} ${fallbackFrequency}`;
      }
      return `CONTACT ME ON ${airportIcao}`;
    }
    return 'CONTACT ME ON FREQUENCY';
  };

  const currentMessage = useMemo(() => {
    return customMessage.trim() || getDefaultMessage();
  }, [customMessage, frequencies, selectedPosition, airportIcao]);

  const hasContentViolation = useMemo(() => {
    return (
      containsProfanity(currentMessage) || containsHateSpeech(currentMessage)
    );
  }, [currentMessage]);

  const canSendMessage = () => {
    return selectedFlight && !sending && !hasContentViolation;
  };

  useEffect(() => {
    const loadFrequencies = async () => {
      try {
        const freqData: AirportFrequency[] = await fetchFrequencies();
        const airportFreq = freqData.find(
          (f: AirportFrequency) => f.icao === airportIcao
        );
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

    if (airportIcao) {
      loadFrequencies();
    }
  }, [airportIcao]);

  const handleSend = async () => {
    if (!selectedFlight) return;

    setSending(true);
    try {
      await onSendContact(
        selectedFlight.id,
        customMessage || getDefaultMessage(),
        airportIcao,
        selectedPosition
      );
      setCustomMessage('');
      setSelectedFlight(null);
      onClose();
    } finally {
      setSending(false);
    }
  };

  const defaultMessagePreview = (
    <p
      className={`px-4 py-3 font-mono text-xs text-zinc-500 ${panelCardClass}`}
    >
      Default: <span className="text-blue-400">"{getDefaultMessage()}"</span>
    </p>
  );

  return (
    <SidePanel open={open}>
      <PanelHeader icon={Radio} title="Contact ACARS" onClose={onClose} />

      <PanelBody>
        {flightsWithAcars.length === 0 ? (
          <div
            className={`flex flex-col items-center px-6 py-10 text-center ${panelCardClass}`}
          >
            <Radio className="mb-4 h-10 w-10 text-blue-400 opacity-40" />
            <p className="font-medium text-zinc-300">
              No active ACARS terminals
            </p>
            <p className="mt-2 text-sm text-zinc-500">
              Flights must open their ACARS terminal first
            </p>
          </div>
        ) : (
          <>
            <PanelSection title="Search Flights">
              <div className="relative">
                <Search className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search by callsign, pilot, aircraft, or route..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={cn(panelInputClass, 'pl-10')}
                />
              </div>
            </PanelSection>

            <PanelSection title="Select Flight">
              <div className="space-y-2">
                {filteredFlights.map((flight) => {
                  const isSelected = selectedFlight?.id === flight.id;
                  return (
                    <button
                      key={flight.id}
                      type="button"
                      onClick={() => setSelectedFlight(flight)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors',
                        isSelected
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-zinc-800 bg-zinc-800/40 hover:border-zinc-700 hover:bg-zinc-800'
                      )}
                    >
                      {flight.user?.discord_avatar_url ? (
                        <img
                          src={flight.user.discord_avatar_url}
                          alt={flight.user.discord_username || 'User'}
                          className="h-10 w-10 shrink-0 rounded-full"
                        />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-800">
                          <Plane className="h-4 w-4 text-zinc-400" />
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-sm font-semibold text-white">
                          {flight.callsign}
                        </div>
                        <div className="truncate text-xs text-zinc-400">
                          {flight.user?.discord_username || 'Unknown Pilot'}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">
                            {flight.departure} → {flight.arrival}
                          </span>
                          {flight.aircraft && (
                            <>
                              <span className="text-zinc-700">•</span>
                              <span className="font-mono">
                                {flight.aircraft}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {isSelected && (
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500">
                          <Check className="h-3 w-3 text-white" />
                        </span>
                      )}
                    </button>
                  );
                })}
                {filteredFlights.length === 0 && searchTerm.trim() && (
                  <p className="py-8 text-center text-sm text-zinc-400">
                    No flights match your search.
                  </p>
                )}
              </div>
            </PanelSection>

            {selectedFlight && frequencies.length > 0 && !isCenterStation && (
              <PanelSection title="Contact Position">
                <Dropdown
                  options={frequencies.map((freq) => ({
                    value: freq.type,
                    label: `${freq.type} - ${freq.freq}`,
                  }))}
                  value={selectedPosition}
                  onChange={setSelectedPosition}
                  size="sm"
                />
                {defaultMessagePreview}
              </PanelSection>
            )}

            {selectedFlight && isCenterStation && defaultMessagePreview}

            {selectedFlight && (
              <PanelSection title="Custom Message (Optional)">
                <input
                  type="text"
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && canSendMessage()) {
                      handleSend();
                    }
                  }}
                  placeholder={getDefaultMessage()}
                  className={cn(
                    panelInputClass,
                    'font-mono',
                    hasContentViolation && 'border-red-500 focus:border-red-500'
                  )}
                  maxLength={100}
                />
                {hasContentViolation ? (
                  <p className="text-xs text-red-500">
                    This message violates our guidelines and cannot be sent via
                    ACARS
                  </p>
                ) : (
                  <p className="text-xs text-zinc-500">
                    Leave blank to use default message
                  </p>
                )}
              </PanelSection>
            )}
          </>
        )}
      </PanelBody>

      <PanelFooter>
        <Button
          variant="outline"
          size="sm"
          onClick={onClose}
          disabled={sending}
        >
          Cancel
        </Button>
        <Button size="sm" onClick={handleSend} disabled={!canSendMessage()}>
          {sending ? 'Sending...' : 'Send ACARS Message'}
        </Button>
      </PanelFooter>
    </SidePanel>
  );
}
