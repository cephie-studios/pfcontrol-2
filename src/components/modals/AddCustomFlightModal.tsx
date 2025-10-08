import { useState, useEffect } from 'react';
import { X, Plane } from 'lucide-react';
import Button from '../common/Button';
import TextInput from '../common/TextInput';
import AircraftDropdown from '../dropdowns/AircraftDropdown';
import AirportDropdown from '../dropdowns/AirportDropdown';
import type { Flight } from '../../types/flight';

// Aircraft data with Wake Turbulence Categories
const AIRCRAFT_WTC_MAP: Record<string, string> = {
    A220: 'M',
    A320: 'M',
    A330: 'H',
    A350: 'H',
    B717: 'M',
    B727: 'M',
    B737: 'M',
    B757: 'M',
    B77W: 'H',
    B787: 'H',
    MD80: 'M',
    E145: 'M',
    CRJ7: 'M',
    AT72: 'M',
    DH8D: 'M',
    B738: 'M',
    A319: 'M',
    A321: 'M',
    B744: 'H',
    B748: 'H',
    A388: 'J',
    AN225: 'J',
    B77L: 'H',
    B789: 'H',
    A359: 'H',
    B77F: 'H',
};

interface AddCustomFlightModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (flightData: Partial<Flight>) => void;
    flightType: 'departure' | 'arrival';
    airportIcao?: string;
}

export default function AddCustomFlightModal({
    isOpen,
    onClose,
    onAdd,
    flightType,
    airportIcao = '',
}: AddCustomFlightModalProps) {
    const [formData, setFormData] = useState<Partial<Flight>>({
        callsign: '',
        aircraft: '',
        flight_type: 'IFR',
        departure: flightType === 'departure' ? airportIcao : '',
        arrival: flightType === 'arrival' ? airportIcao : '',
        stand: flightType === 'departure' ? '' : undefined,
        gate: flightType === 'arrival' ? '' : undefined,
        runway: '',
        sid: flightType === 'departure' ? '' : undefined,
        star: flightType === 'arrival' ? '' : undefined,
        cruisingFL: '',
        clearedFL: '',
        squawk: '',
        wtc: 'M',
        remark: '',
        status: flightType === 'departure' ? 'PENDING' : 'APPR',
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    // Update departure/arrival when modal opens or airportIcao changes
    useEffect(() => {
        if (isOpen && airportIcao) {
            setFormData((prev) => ({
                ...prev,
                departure:
                    flightType === 'departure' ? airportIcao : prev.departure,
                arrival: flightType === 'arrival' ? airportIcao : prev.arrival,
            }));
        }
    }, [isOpen, airportIcao, flightType]);

    if (!isOpen) return null;

    const handleChange = (field: keyof Flight, value: string) => {
        const updates: Partial<Flight> = { [field]: value };

        // Auto-detect Wake Turbulence Category when aircraft type changes
        if (field === 'aircraft' && value) {
            const wtc = AIRCRAFT_WTC_MAP[value.toUpperCase()] || 'M';
            updates.wtc = wtc;
        }

        setFormData((prev) => ({ ...prev, ...updates }));

        // Clear error when user starts typing
        if (errors[field]) {
            setErrors((prev) => {
                const newErrors = { ...prev };
                delete newErrors[field];
                return newErrors;
            });
        }
    };

    const validateForm = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (!formData.callsign?.trim()) {
            newErrors.callsign = 'Callsign is required';
        }
        if (!formData.aircraft?.trim()) {
            newErrors.aircraft = 'Aircraft type is required';
        }
        if (flightType === 'departure' && !formData.arrival?.trim()) {
            newErrors.arrival = 'Destination is required';
        }
        if (flightType === 'arrival' && !formData.departure?.trim()) {
            newErrors.departure = 'Origin is required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = () => {
        if (!validateForm()) return;

        onAdd(formData);
        handleClose();
    };

    const handleClose = () => {
        setFormData({
            callsign: '',
            aircraft: '',
            flight_type: 'IFR',
            departure: flightType === 'departure' ? airportIcao : '',
            arrival: flightType === 'arrival' ? airportIcao : '',
            stand: flightType === 'departure' ? '' : undefined,
            gate: flightType === 'arrival' ? '' : undefined,
            runway: '',
            sid: flightType === 'departure' ? '' : undefined,
            star: flightType === 'arrival' ? '' : undefined,
            cruisingFL: '',
            clearedFL: '',
            squawk: '',
            wtc: 'M',
            remark: '',
            status: flightType === 'departure' ? 'PENDING' : 'APPR',
        });
        setErrors({});
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div
                className="bg-zinc-900 rounded-xl border border-zinc-700 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-zinc-700">
                    <div className="flex items-center space-x-3">
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                            <Plane className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">
                                Add Custom{' '}
                                {flightType === 'departure'
                                    ? 'Departure'
                                    : 'Arrival'}
                            </h2>
                            <p className="text-sm text-gray-400">
                                {flightType === 'departure'
                                    ? `Departing from ${airportIcao}`
                                    : `Arriving at ${airportIcao}`}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-zinc-800 rounded-lg"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <div className="p-6 space-y-6">
                    {/* Basic Info */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                            Basic Information
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Callsign *
                                </label>
                                <TextInput
                                    value={formData.callsign || ''}
                                    onChange={(value) =>
                                        handleChange('callsign', value)
                                    }
                                    placeholder="ABC123"
                                    maxLength={16}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                />
                                {errors.callsign && (
                                    <p className="text-red-400 text-xs mt-1">
                                        {errors.callsign}
                                    </p>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Aircraft Type *
                                </label>
                                <AircraftDropdown
                                    value={formData.aircraft || ''}
                                    onChange={(value) =>
                                        handleChange('aircraft', value)
                                    }
                                />
                                {errors.aircraft && (
                                    <p className="text-red-400 text-xs mt-1">
                                        {errors.aircraft}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Flight Type
                                </label>
                                <select
                                    value={formData.flight_type || 'IFR'}
                                    onChange={(e) =>
                                        handleChange(
                                            'flight_type',
                                            e.target.value
                                        )
                                    }
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                >
                                    <option value="IFR">IFR</option>
                                    <option value="VFR">VFR</option>
                                    <option value="SVFR">SVFR</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Wake Turbulence (Auto)
                                </label>
                                <select
                                    value={formData.wtc || 'M'}
                                    disabled
                                    className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-2 text-gray-400 cursor-not-allowed"
                                >
                                    <option value="L">L (Light)</option>
                                    <option value="M">M (Medium)</option>
                                    <option value="H">H (Heavy)</option>
                                    <option value="J">J (Super)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Status
                                </label>
                                <select
                                    value={formData.status || ''}
                                    onChange={(e) =>
                                        handleChange('status', e.target.value)
                                    }
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                >
                                    {flightType === 'departure' ? (
                                        <>
                                            <option value="PENDING">
                                                PENDING
                                            </option>
                                            <option value="STUP">STUP</option>
                                            <option value="PUSH">PUSH</option>
                                            <option value="TAXI">TAXI</option>
                                            <option value="RWY">RWY</option>
                                            <option value="DEPA">DEPA</option>
                                        </>
                                    ) : (
                                        <>
                                            <option value="APPR">APPR</option>
                                            <option value="LAND">LAND</option>
                                            <option value="TAXI">TAXI</option>
                                            <option value="RYW">RWY</option>
                                            <option value="GATE">GATE</option>
                                        </>
                                    )}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Route Info */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                            Route Information
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {flightType === 'departure' ? (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Departure (ADEP)
                                        </label>
                                        <div className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-2 text-gray-400 cursor-not-allowed">
                                            {airportIcao || 'N/A'}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Destination (ADES) *
                                        </label>
                                        <AirportDropdown
                                            value={formData.arrival || ''}
                                            onChange={(value) =>
                                                handleChange('arrival', value)
                                            }
                                        />
                                        {errors.arrival && (
                                            <p className="text-red-400 text-xs mt-1">
                                                {errors.arrival}
                                            </p>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Origin (ADEP) *
                                        </label>
                                        <AirportDropdown
                                            value={formData.departure || ''}
                                            onChange={(value) =>
                                                handleChange('departure', value)
                                            }
                                        />
                                        {errors.departure && (
                                            <p className="text-red-400 text-xs mt-1">
                                                {errors.departure}
                                            </p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Arrival (ADES)
                                        </label>
                                        <div className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-2 text-gray-400 cursor-not-allowed">
                                            {airportIcao || 'N/A'}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Operations Info */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                            Operations
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    {flightType === 'departure'
                                        ? 'Stand'
                                        : 'Gate'}
                                </label>
                                <TextInput
                                    value={
                                        flightType === 'departure'
                                            ? formData.stand || ''
                                            : formData.gate || ''
                                    }
                                    onChange={(value) =>
                                        handleChange(
                                            flightType === 'departure'
                                                ? 'stand'
                                                : 'gate',
                                            value.toUpperCase()
                                        )
                                    }
                                    placeholder={
                                        flightType === 'departure'
                                            ? 'A12'
                                            : 'B5'
                                    }
                                    maxLength={8}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Runway
                                </label>
                                <TextInput
                                    value={formData.runway || ''}
                                    onChange={(value) =>
                                        handleChange(
                                            'runway',
                                            value.toUpperCase()
                                        )
                                    }
                                    placeholder="08R"
                                    maxLength={5}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    {flightType === 'departure'
                                        ? 'SID'
                                        : 'STAR'}
                                </label>
                                <TextInput
                                    value={
                                        flightType === 'departure'
                                            ? formData.sid || ''
                                            : formData.star || ''
                                    }
                                    onChange={(value) =>
                                        handleChange(
                                            flightType === 'departure'
                                                ? 'sid'
                                                : 'star',
                                            value.toUpperCase()
                                        )
                                    }
                                    placeholder={
                                        flightType === 'departure'
                                            ? 'MARUN1A'
                                            : 'RIXE1A'
                                    }
                                    maxLength={10}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Squawk
                                </label>
                                <TextInput
                                    value={formData.squawk || ''}
                                    onChange={(value) =>
                                        handleChange('squawk', value)
                                    }
                                    placeholder="2000"
                                    maxLength={4}
                                    pattern="[0-9]*"
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Requested FL (RFL)
                                </label>
                                <TextInput
                                    value={formData.cruisingFL || ''}
                                    onChange={(value) =>
                                        handleChange('cruisingFL', value)
                                    }
                                    placeholder="350"
                                    maxLength={5}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Cleared FL (CFL)
                                </label>
                                <TextInput
                                    value={formData.clearedFL || ''}
                                    onChange={(value) =>
                                        handleChange('clearedFL', value)
                                    }
                                    placeholder="150"
                                    maxLength={5}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Additional Info */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                            Additional Information
                        </h3>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Remark
                            </label>
                            <TextInput
                                value={formData.remark || ''}
                                onChange={(value) =>
                                    handleChange('remark', value)
                                }
                                placeholder="Optional notes..."
                                maxLength={50}
                                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end space-x-3 p-6 border-t border-zinc-700">
                    <Button onClick={handleClose} variant="outline" size="md">
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} variant="primary" size="md">
                        Add Flight
                    </Button>
                </div>
            </div>
        </div>
    );
}
