import { useState, useEffect } from 'react';
import { X, Radio, Plane, MapPin } from 'lucide-react';
import { fetchFrequencies } from '../../utils/fetch/data';
import type { AirportFrequency } from '../../types/airports';
import type { Flight } from '../../types/flight';
import Button from '../common/Button';
import Dropdown from '../common/Dropdown';

interface ContactAcarsModalProps {
    isOpen: boolean;
    onClose: () => void;
    flights: Flight[];
    onSendContact: (flightId: string | number, message: string) => void;
    activeAcarsFlights: Set<string | number>;
    airportIcao: string;
}

export default function ContactAcarsModal({
    isOpen,
    onClose,
    flights,
    onSendContact,
    activeAcarsFlights,
    airportIcao,
}: ContactAcarsModalProps) {
    const [selectedFlight, setSelectedFlight] = useState<Flight | null>(null);
    const [customMessage, setCustomMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [selectedPosition, setSelectedPosition] = useState<string>('TWR');
    const [frequencies, setFrequencies] = useState<
        { type: string; freq: string }[]
    >([]);

    const flightsWithAcars = flights.filter((f) =>
        activeAcarsFlights.has(f.id)
    );

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

    const getDefaultMessage = () => {
        const freq = frequencies.find((f) => f.type === selectedPosition);
        if (freq) {
            return `CONTACT ME ON ${airportIcao}_${selectedPosition} ${freq.freq}`;
        }
        return 'CONTACT ME ON FREQUENCY';
    };

    const handleSend = async () => {
        if (!selectedFlight) return;

        setSending(true);
        try {
            await onSendContact(
                selectedFlight.id,
                customMessage || getDefaultMessage()
            );
            setCustomMessage('');
            setSelectedFlight(null);
            onClose();
        } finally {
            setSending(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-900 border-2 border-blue-800 rounded-lg max-w-2xl w-full max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-gray-700 flex-shrink-0">
                    <div className="flex justify-between items-start">
                        <div className="flex items-center">
                            <div className="p-2 bg-blue-900/30 rounded-full mr-3">
                                <Radio className="h-6 w-6 text-blue-400" />
                            </div>
                            <div>
                                <h3 className="text-xl font-semibold">
                                    Contact ACARS Terminal
                                </h3>
                                <p className="text-sm text-gray-400 mt-1">
                                    Send a message to a flight's ACARS terminal
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1 rounded-full hover:bg-gray-700 transition-colors"
                        >
                            <X className="h-5 w-5 text-gray-400" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {flightsWithAcars.length === 0 ? (
                        <div className="text-center py-8 text-gray-400">
                            <Radio className="h-12 w-12 mx-auto mb-3 opacity-50" />
                            <p>No flights with active ACARS terminals</p>
                            <p className="text-sm mt-2">
                                Flights must open their ACARS terminal first
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Flight Selection */}
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-300 mb-3">
                                    Select Flight
                                </label>
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                    {flightsWithAcars.map((flight) => (
                                        <button
                                            key={flight.id}
                                            onClick={() =>
                                                setSelectedFlight(flight)
                                            }
                                            className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                                                selectedFlight?.id === flight.id
                                                    ? 'border-blue-500 bg-blue-500/10'
                                                    : 'border-gray-700 hover:border-gray-600 bg-gray-800/50'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <Plane className="h-5 w-5 text-blue-400" />
                                                    <div>
                                                        <div className="font-semibold text-white">
                                                            {flight.callsign}
                                                        </div>
                                                        <div className="text-sm text-gray-400 flex items-center gap-2 mt-1">
                                                            <MapPin className="h-3 w-3" />
                                                            {flight.departure} →{' '}
                                                            {flight.arrival}
                                                        </div>
                                                    </div>
                                                </div>
                                                {selectedFlight?.id ===
                                                    flight.id && (
                                                    <div className="h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center">
                                                        <div className="h-2 w-2 rounded-full bg-white"></div>
                                                    </div>
                                                )}
                                            </div>
                                            {flight.aircraft && (
                                                <div className="text-xs text-gray-500 ml-8 mt-1">
                                                    Aircraft: {flight.aircraft}
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Position Selector */}
                            {selectedFlight && frequencies.length > 0 && (
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-300 mb-3">
                                        Contact as
                                    </label>
                                    <Dropdown
                                        options={frequencies.map((freq) => ({
                                            value: freq.type,
                                            label: `${freq.type} - ${freq.freq}`,
                                        }))}
                                        value={selectedPosition}
                                        onChange={setSelectedPosition}
                                        size="sm"
                                    />
                                    <p className="text-xs text-gray-500 mt-2">
                                        Default message: "{getDefaultMessage()}"
                                    </p>
                                </div>
                            )}

                            {/* Custom Message */}
                            {selectedFlight && (
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Custom Message (optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={customMessage}
                                        onChange={(e) =>
                                            setCustomMessage(e.target.value)
                                        }
                                        placeholder={getDefaultMessage()}
                                        className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        maxLength={100}
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Leave blank to use default message
                                    </p>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-700 flex justify-end gap-3 flex-shrink-0">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={sending}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSend}
                        disabled={!selectedFlight || sending}
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        {sending ? 'Sending...' : 'Send Message'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
