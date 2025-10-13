import { useState, useEffect } from 'react';
import { X, Radio, Plane, MapPin } from 'lucide-react';
import { fetchFrequencies } from '../../utils/fetch/data';
import type { AirportFrequency } from '../../types/airports';
import type { Flight } from '../../types/flight';
import Button from '../common/Button';
import Dropdown from '../common/Dropdown';

interface ContactAcarsSidebarProps {
    open: boolean;
    onClose: () => void;
    flights: Flight[];
    onSendContact: (flightId: string | number, message: string) => void;
    activeAcarsFlights: Set<string | number>;
    airportIcao: string;
}

export default function ContactAcarsSidebar({
    open,
    onClose,
    flights,
    onSendContact,
    activeAcarsFlights,
    airportIcao,
}: ContactAcarsSidebarProps) {
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

    if (!open) return null;

    return (
        <div
            className={`fixed top-0 right-0 h-full w-100 bg-zinc-900 text-white transition-transform duration-300 ${
                open ? 'translate-x-0' : 'translate-x-full'
            } rounded-l-3xl border-l-2 border-blue-800 flex flex-col`}
            style={{ zIndex: 100 }}
        >
            {/* Header */}
            <div className="flex justify-between items-center p-5 border-b border-blue-800 rounded-tl-3xl">
                <div className="flex items-center gap-3">
                    <span className="font-extrabold text-xl text-blue-300">
                        Contact ACARS
                    </span>
                </div>
                <button
                    onClick={onClose}
                    className="p-1 rounded-full hover:bg-gray-700"
                >
                    <X className="h-5 w-5 text-gray-400" />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {flightsWithAcars.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                        <div className="bg-gray-900 rounded-xl p-8 border border-gray-800">
                            <Radio className="h-12 w-12 mx-auto mb-4 opacity-40 text-blue-400" />
                            <p className="text-gray-300 font-medium">
                                No active ACARS terminals
                            </p>
                            <p className="text-sm mt-2 text-gray-500">
                                Flights must open their ACARS terminal first
                            </p>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Flight Selection */}
                        <div className="mb-6">
                            <label className="block text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide">
                                Select Flight
                            </label>
                            <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                                {flightsWithAcars.map((flight) => (
                                    <button
                                        key={flight.id}
                                        onClick={() =>
                                            setSelectedFlight(flight)
                                        }
                                        className={`w-full text-left p-4 rounded-xl border transition-all ${
                                            selectedFlight?.id === flight.id
                                                ? 'border-blue-500 bg-blue-950 shadow-lg shadow-blue-500/20'
                                                : 'border-gray-800 hover:border-gray-700 bg-gray-950 hover:bg-gray-900'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            {/* Discord Avatar */}
                                            {flight.user?.discord_avatar_url ? (
                                                <img
                                                    src={
                                                        flight.user
                                                            .discord_avatar_url
                                                    }
                                                    alt={
                                                        flight.user
                                                            .discord_username ||
                                                        'User'
                                                    }
                                                    className="w-12 h-12 rounded-full border-2 border-gray-700"
                                                />
                                            ) : (
                                                <div className="w-12 h-12 rounded-full bg-gray-800 border-2 border-gray-700 flex items-center justify-center">
                                                    <Plane className="h-5 w-5 text-gray-400" />
                                                </div>
                                            )}

                                            {/* Flight Info */}
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <div className="font-semibold text-white font-mono text-sm">
                                                            {flight.callsign}
                                                        </div>
                                                        <div className="text-xs text-gray-400 mt-0.5">
                                                            {flight.user
                                                                ?.discord_username ||
                                                                'Unknown Pilot'}
                                                        </div>
                                                    </div>
                                                    {selectedFlight?.id ===
                                                        flight.id && (
                                                        <div className="h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center">
                                                            <div className="h-2 w-2 rounded-full bg-white"></div>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                                                    <div className="flex items-center gap-1">
                                                        <MapPin className="h-3 w-3" />
                                                        <span>
                                                            {flight.departure} →{' '}
                                                            {flight.arrival}
                                                        </span>
                                                    </div>
                                                    {flight.aircraft && (
                                                        <>
                                                            <span className="text-gray-700">
                                                                •
                                                            </span>
                                                            <span className="font-mono">
                                                                {
                                                                    flight.aircraft
                                                                }
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Position Selector */}
                        {selectedFlight && frequencies.length > 0 && (
                            <div className="mb-6">
                                <label className="block text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide">
                                    Contact Position
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
                                <div className="mt-3 bg-gray-950 border border-gray-800 rounded-lg p-3">
                                    <p className="text-xs text-gray-500 font-mono">
                                        Default:{' '}
                                        <span className="text-blue-400">
                                            "{getDefaultMessage()}"
                                        </span>
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Custom Message */}
                        {selectedFlight && (
                            <div className="mb-4">
                                <label className="block text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide">
                                    Custom Message (Optional)
                                </label>
                                <input
                                    type="text"
                                    value={customMessage}
                                    onChange={(e) =>
                                        setCustomMessage(e.target.value)
                                    }
                                    placeholder={getDefaultMessage()}
                                    className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                                    maxLength={100}
                                />
                                <p className="text-xs text-gray-500 mt-2">
                                    Leave blank to use default message
                                </p>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-blue-800 bg-zinc-900 rounded-bl-3xl flex justify-end gap-3">
                <Button
                    variant="outline"
                    onClick={onClose}
                    disabled={sending}
                    className="border-gray-700 hover:bg-gray-800 text-gray-300"
                >
                    Cancel
                </Button>
                <Button
                    onClick={handleSend}
                    disabled={!selectedFlight || sending}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-800 disabled:text-gray-600"
                >
                    {sending ? 'Sending...' : 'Send Message'}
                </Button>
            </div>
        </div>
    );
}
