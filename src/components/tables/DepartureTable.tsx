import { useState } from 'react';
import { useMediaQuery } from 'react-responsive';
import { EyeOff, Eye, Trash2, FileSpreadsheet, RefreshCw } from 'lucide-react';
import type { Flight } from '../../types/flight';
import type { DepartureTableColumnSettings } from '../../types/settings';
import type { FieldEditingState } from '../../sockets/sessionUsersSocket';
import Checkbox from '../common/Checkbox';
import TextInput from '../common/TextInput';
import AirportDropdown from '../dropdowns/AirportDropdown';
import RunwayDropdown from '../dropdowns/RunwayDropdown';
import AircraftDropdown from '../dropdowns/AircraftDropdown';
import SidDropdown from '../dropdowns/SidDropdown';
import AltitudeDropdown from '../dropdowns/AltitudeDropdown';
import StatusDropdown from '../dropdowns/StatusDropdown';
import Button from '../common/Button';
import DepartureTableMobile from './mobile/DepartureTableMobile';
import PDCModal from '../tools/PDCModal';

interface DepartureTableProps {
    flights: Flight[];
    onFlightChange: (
        flightId: string | number,
        updates: Partial<Flight>
    ) => void;
    onFlightDelete: (flightId: string | number) => void;
    backgroundStyle?: React.CSSProperties;
    departureColumns?: DepartureTableColumnSettings;
    fieldEditingStates?: FieldEditingState[];
    onFieldEditingStart?: (
        flightId: string | number,
        fieldName: string
    ) => void;
    flashFlightId: string | null;
    onFieldEditingStop?: (flightId: string | number, fieldName: string) => void;
    onIssuePDC?: (
        flightId: string | number,
        pdcText: string
    ) => Promise<void> | void;
    onToggleClearance: (flightId: string | number, checked: boolean) => void;
    flashingPDCIds: Set<string>;
}

export default function DepartureTable({
    flights,
    onFlightDelete,
    onFlightChange,
    backgroundStyle,
    departureColumns = {
        time: true,
        callsign: true,
        stand: true,
        aircraft: true,
        wakeTurbulence: true,
        flightType: true,
        arrival: true,
        runway: true,
        sid: true,
        rfl: true,
        cfl: true,
        squawk: true,
        clearance: true,
        status: true,
        remark: true,
        pdc: true,
        hide: true,
        delete: true,
    },
    fieldEditingStates = [],
    onFieldEditingStart,
    onFieldEditingStop,
    onIssuePDC,

    onToggleClearance,
    flashingPDCIds,
}: DepartureTableProps) {
    const [showHidden, setShowHidden] = useState(false);
    const [pdcModalOpen, setPdcModalOpen] = useState(false);
    const [selectedFlight, setSelectedFlight] = useState<Flight | null>(null);
    const isMobile = useMediaQuery({ maxWidth: 1000 });

    const handleHideFlight = async (flightId: string | number) => {
        if (onFlightChange) {
            onFlightChange(flightId, { hidden: true });
        }
    };

    const handleUnhideFlight = async (flightId: string | number) => {
        if (onFlightChange) {
            onFlightChange(flightId, { hidden: false });
        }
    };

    const handleDeleteFlight = async (flightId: string | number) => {
        onFlightDelete(flightId);
    };

    const isClearanceChecked = (v: boolean | string | undefined) => {
        if (typeof v === 'boolean') return v;
        if (typeof v === 'string')
            return ['true', 'c', 'yes', '1'].includes(v.trim().toLowerCase());
        return false;
    };

    const handleRemarkChange = (flightId: string | number, remark: string) => {
        if (onFlightChange) {
            onFlightChange(flightId, { remark });
        }
    };

    const handleCallsignChange = (
        flightId: string | number,
        callsign: string
    ) => {
        if (onFlightChange) {
            onFlightChange(flightId, { callsign });
        }
    };

    const handleStandChange = (flightId: string | number, stand: string) => {
        if (onFlightChange) {
            onFlightChange(flightId, { stand });
        }
    };

    const handleSquawkChange = (flightId: string | number, squawk: string) => {
        if (onFlightChange) {
            onFlightChange(flightId, { squawk });
        }
    };

    const handleArrivalChange = (
        flightId: string | number,
        arrival: string
    ) => {
        if (onFlightChange) {
            onFlightChange(flightId, { arrival });
        }
    };

    const handleRunwayChange = (flightId: string | number, runway: string) => {
        if (onFlightChange) {
            onFlightChange(flightId, { runway });
        }
    };

    const handleAircraftChange = (
        flightId: string | number,
        aircraft: string
    ) => {
        if (onFlightChange) {
            onFlightChange(flightId, { aircraft });
        }
    };

    const handleSidChange = (flightId: string | number, sid: string) => {
        if (onFlightChange) {
            onFlightChange(flightId, { sid });
        }
    };

    const handleCruisingFLChange = (
        flightId: string | number,
        cruisingFL: string
    ) => {
        if (onFlightChange) {
            onFlightChange(flightId, { cruisingFL });
        }
    };

    const handleClearedFLChange = (
        flightId: string | number,
        clearedFL: string
    ) => {
        if (onFlightChange) {
            onFlightChange(flightId, { clearedFL });
        }
    };

    const handleStatusChange = (flightId: string | number, status: string) => {
        if (onFlightChange) {
            onFlightChange(flightId, { status });
        }
    };

    const visibleFlights = showHidden
        ? flights
        : flights.filter((flight) => !flight.hidden);
    const hasHiddenFlights = flights.some((flight) => flight.hidden);

    const handlePDCOpen = (flight: Flight) => {
        setSelectedFlight(flight);
        setPdcModalOpen(true);
    };

    const handlePDCClose = () => {
        setPdcModalOpen(false);
        setSelectedFlight(null);
    };

    const getFieldEditingState = (
        flightId: string | number,
        fieldName: string
    ) => {
        return fieldEditingStates.find(
            (state) =>
                state.flightId === flightId && state.fieldName === fieldName
        );
    };

    const handleFieldFocus = (flightId: string | number, fieldName: string) => {
        if (onFieldEditingStart) {
            onFieldEditingStart(flightId, fieldName);
        }
    };

    const handleFieldBlur = (flightId: string | number, fieldName: string) => {
        if (onFieldEditingStop) {
            onFieldEditingStop(flightId, fieldName);
        }
    };

    const generateRandomSquawk = (): string => {
        let squawk = '';
        for (let i = 0; i < 4; i++) {
            squawk += Math.floor(Math.random() * 6) + 1;
        }
        return squawk;
    };

    const handleRegenerateSquawk = (flightId: string | number) => {
        const newSquawk = generateRandomSquawk();
        if (onFlightChange) {
            onFlightChange(flightId, { squawk: newSquawk });
        }
    };

    // when rendering mobile variant
    if (isMobile) {
        return (
            <>
                <DepartureTableMobile
                    flights={flights}
                    onFlightDelete={onFlightDelete}
                    onFlightChange={onFlightChange}
                    backgroundStyle={backgroundStyle}
                    departureColumns={departureColumns}
                    onPDCOpen={handlePDCOpen}
                />
                <PDCModal
                    isOpen={pdcModalOpen}
                    onClose={handlePDCClose}
                    flight={selectedFlight}
                    onIssuePDC={onIssuePDC}
                />
            </>
        );
    }

    return (
        <div className="mt-8 px-4">
            {hasHiddenFlights && (
                <div className="mb-2 flex items-center gap-2">
                    <Button
                        className="px-3 py-1 rounded flex items-center gap-1"
                        onClick={() => setShowHidden((v) => !v)}
                        variant="outline"
                        size="sm"
                    >
                        {showHidden ? (
                            <Eye className="w-4 h-4" />
                        ) : (
                            <EyeOff className="w-4 h-4" />
                        )}
                        {showHidden
                            ? 'Hide hidden flights'
                            : 'Show hidden flights'}
                    </Button>
                </div>
            )}

            {visibleFlights.length === 0 ? (
                <div className="mt-24 px-4 py-6 text-center text-gray-400">
                    No departures found.
                </div>
            ) : (
                <div className="table-view">
                    <table className="min-w-full rounded-lg">
                        <thead>
                            <tr className="bg-blue-950 text-blue-200">
                                {/* Time column is always visible */}
                                <th className="py-2.5 px-4 text-left column-time">
                                    TIME
                                </th>
                                {departureColumns.callsign !== false && (
                                    <th className="py-2.5 px-4 text-left w">
                                        CALLSIGN
                                    </th>
                                )}
                                {departureColumns.stand !== false && (
                                    <th className="py-2.5 px-4 text-left w-24 column-stand">
                                        STAND
                                    </th>
                                )}
                                {departureColumns.aircraft !== false && (
                                    <th className="py-2.5 px-4 text-left">
                                        ATYP
                                    </th>
                                )}
                                {departureColumns.wakeTurbulence !== false && (
                                    <th className="py-2.5 px-4 text-left column-w">
                                        W
                                    </th>
                                )}
                                {departureColumns.flightType !== false && (
                                    <th className="py-2.5 px-4 text-left">V</th>
                                )}
                                {departureColumns.arrival !== false && (
                                    <th className="py-2.5 px-4 text-left">
                                        ADES
                                    </th>
                                )}
                                {departureColumns.runway !== false && (
                                    <th className="py-2.5 px-4 text-left column-rwy">
                                        RWY
                                    </th>
                                )}
                                {departureColumns.sid !== false && (
                                    <th className="py-2.5 px-4 text-left">
                                        SID
                                    </th>
                                )}
                                {departureColumns.rfl !== false && (
                                    <th className="py-2.5 px-4 text-left column-rfl">
                                        RFL
                                    </th>
                                )}
                                {departureColumns.cfl !== false && (
                                    <th className="py-2.5 px-4 text-left">
                                        CFL
                                    </th>
                                )}
                                {departureColumns.squawk !== false && (
                                    <th className="py-2.5 px-4 text-left w-28">
                                        ASSR
                                    </th>
                                )}
                                {departureColumns.clearance !== false && (
                                    <th className="py-2.5 px-4 text-left">C</th>
                                )}
                                {departureColumns.status !== false && (
                                    <th className="py-2.5 px-4 text-left">
                                        STS
                                    </th>
                                )}
                                {departureColumns.remark !== false && (
                                    <th className="py-2.5 px-4 text-left w-64 column-rmk">
                                        RMK
                                    </th>
                                )}
                                {departureColumns.pdc !== false && (
                                    <th className="py-2.5 px-4 text-left column-pdc">
                                        PDC
                                    </th>
                                )}
                                {departureColumns.hide !== false && (
                                    <th className="py-2.5 px-4 text-left column-hide">
                                        HIDE
                                    </th>
                                )}
                                {departureColumns.delete !== false && (
                                    <th className="py-2.5 px-4 text-left">
                                        DEL
                                    </th>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {visibleFlights.map((flight) => {
                                const callsignEditingState =
                                    getFieldEditingState(flight.id, 'callsign');
                                const standEditingState = getFieldEditingState(
                                    flight.id,
                                    'stand'
                                );
                                const squawkEditingState = getFieldEditingState(
                                    flight.id,
                                    'squawk'
                                );
                                const remarkEditingState = getFieldEditingState(
                                    flight.id,
                                    'remark'
                                );
                                const isFlashing =
                                    flashingPDCIds?.has(String(flight.id)) &&
                                    !isClearanceChecked(flight.clearance);
                                return (
                                    <tr
                                        key={flight.id}
                                        className={`flight-row ${
                                            flight.hidden
                                                ? 'opacity-60 text-gray-400'
                                                : ''
                                        }`}
                                        style={backgroundStyle}
                                    >
                                        {/* Time column is always visible */}
                                        <td className="py-2 px-4 column-time">
                                            {flight.timestamp
                                                ? new Date(
                                                      flight.timestamp
                                                  ).toLocaleTimeString(
                                                      'en-GB',
                                                      {
                                                          hour: '2-digit',
                                                          minute: '2-digit',
                                                          timeZone: 'UTC',
                                                      }
                                                  )
                                                : '-'}
                                        </td>
                                        {departureColumns.callsign !==
                                            false && (
                                            <td className="py-2 px-4">
                                                <TextInput
                                                    value={
                                                        flight.callsign || ''
                                                    }
                                                    onChange={(value) =>
                                                        handleCallsignChange(
                                                            flight.id,
                                                            value
                                                        )
                                                    }
                                                    className="bg-transparent border-none focus:bg-gray-800 px-1 rounded text-white"
                                                    placeholder="-"
                                                    maxLength={16}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.currentTarget.blur();
                                                        }
                                                    }}
                                                    editingAvatar={
                                                        callsignEditingState?.avatar ||
                                                        null
                                                    }
                                                    editingUsername={
                                                        callsignEditingState?.username
                                                    }
                                                    onFocus={() =>
                                                        handleFieldFocus(
                                                            flight.id,
                                                            'callsign'
                                                        )
                                                    }
                                                    onBlur={() =>
                                                        handleFieldBlur(
                                                            flight.id,
                                                            'callsign'
                                                        )
                                                    }
                                                />
                                            </td>
                                        )}
                                        {departureColumns.stand !== false && (
                                            <td className="py-2 px-4 column-stand">
                                                <TextInput
                                                    value={flight.stand || ''}
                                                    onChange={(value) =>
                                                        handleStandChange(
                                                            flight.id,
                                                            value
                                                        )
                                                    }
                                                    className="bg-transparent border-none focus:bg-gray-800 px-1 rounded text-white"
                                                    placeholder="-"
                                                    maxLength={8}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.currentTarget.blur();
                                                        }
                                                    }}
                                                    editingAvatar={
                                                        standEditingState?.avatar ||
                                                        null
                                                    }
                                                    editingUsername={
                                                        standEditingState?.username
                                                    }
                                                    onFocus={() =>
                                                        handleFieldFocus(
                                                            flight.id,
                                                            'stand'
                                                        )
                                                    }
                                                    onBlur={() =>
                                                        handleFieldBlur(
                                                            flight.id,
                                                            'stand'
                                                        )
                                                    }
                                                />
                                            </td>
                                        )}
                                        {departureColumns.aircraft !==
                                            false && (
                                            <td className="py-2 px-4">
                                                <AircraftDropdown
                                                    value={flight.aircraft}
                                                    onChange={(type) =>
                                                        handleAircraftChange(
                                                            flight.id,
                                                            type
                                                        )
                                                    }
                                                    size="xs"
                                                    showFullName={false}
                                                />
                                            </td>
                                        )}
                                        {departureColumns.wakeTurbulence !==
                                            false && (
                                            <td className="py-2 px-4 column-w">
                                                {flight.wtc || '-'}
                                            </td>
                                        )}
                                        {departureColumns.flightType !==
                                            false && (
                                            <td className="py-2 px-4">
                                                {flight.flight_type || '-'}
                                            </td>
                                        )}
                                        {departureColumns.arrival !== false && (
                                            <td className="py-2 px-4">
                                                <AirportDropdown
                                                    value={flight.arrival}
                                                    onChange={(icao) =>
                                                        handleArrivalChange(
                                                            flight.id,
                                                            icao
                                                        )
                                                    }
                                                    size="xs"
                                                    showFullName={false}
                                                />
                                            </td>
                                        )}
                                        {departureColumns.runway !== false && (
                                            <td className="py-2 px-4 column-rwy">
                                                <RunwayDropdown
                                                    airportIcao={
                                                        flight.departure || ''
                                                    }
                                                    value={flight.runway}
                                                    onChange={(runway) =>
                                                        handleRunwayChange(
                                                            flight.id,
                                                            runway
                                                        )
                                                    }
                                                    size="xs"
                                                    placeholder="-"
                                                />
                                            </td>
                                        )}
                                        {departureColumns.sid !== false && (
                                            <td className="py-2 px-4">
                                                <SidDropdown
                                                    airportIcao={
                                                        flight.departure || ''
                                                    }
                                                    value={flight.sid}
                                                    onChange={(sid) =>
                                                        handleSidChange(
                                                            flight.id,
                                                            sid
                                                        )
                                                    }
                                                    size="xs"
                                                    placeholder="-"
                                                />
                                            </td>
                                        )}
                                        {departureColumns.rfl !== false && (
                                            <td className="py-2 px-4 column-rfl">
                                                <AltitudeDropdown
                                                    value={flight.cruisingFL}
                                                    onChange={(alt) =>
                                                        handleCruisingFLChange(
                                                            flight.id,
                                                            alt
                                                        )
                                                    }
                                                    size="xs"
                                                    placeholder="-"
                                                />
                                            </td>
                                        )}
                                        {departureColumns.cfl !== false && (
                                            <td className="py-2 px-4">
                                                <AltitudeDropdown
                                                    value={flight.clearedFL}
                                                    onChange={(alt) =>
                                                        handleClearedFLChange(
                                                            flight.id,
                                                            alt
                                                        )
                                                    }
                                                    size="xs"
                                                    placeholder="-"
                                                />
                                            </td>
                                        )}
                                        {departureColumns.squawk !== false && (
                                            <td className="py-2 px-4">
                                                <div className="flex items-center gap-0.5 w-full">
                                                    <TextInput
                                                        value={
                                                            flight.squawk || ''
                                                        }
                                                        onChange={(value) =>
                                                            handleSquawkChange(
                                                                flight.id,
                                                                value
                                                            )
                                                        }
                                                        className="bg-transparent border-none focus:bg-gray-800 px-1 rounded text-white w-full min-w-0"
                                                        placeholder="-"
                                                        maxLength={4}
                                                        pattern="[0-9]*"
                                                        onKeyDown={(e) => {
                                                            if (
                                                                e.key ===
                                                                'Enter'
                                                            ) {
                                                                e.currentTarget.blur();
                                                            }
                                                        }}
                                                        editingAvatar={
                                                            squawkEditingState?.avatar ||
                                                            null
                                                        }
                                                        editingUsername={
                                                            squawkEditingState?.username
                                                        }
                                                        onFocus={() =>
                                                            handleFieldFocus(
                                                                flight.id,
                                                                'squawk'
                                                            )
                                                        }
                                                        onBlur={() =>
                                                            handleFieldBlur(
                                                                flight.id,
                                                                'squawk'
                                                            )
                                                        }
                                                    />
                                                    <button
                                                        onClick={() =>
                                                            handleRegenerateSquawk(
                                                                flight.id
                                                            )
                                                        }
                                                        className="text-gray-400 hover:text-blue-500 rounded transition-colors flex-shrink-0 ml-0.5"
                                                        title="Generate new squawk"
                                                        type="button"
                                                    >
                                                        <RefreshCw className="w-2.5 h-2.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        )}
                                        {departureColumns.clearance !==
                                            false && (
                                            <td className="py-2 px-4">
                                                <Checkbox
                                                    checked={isClearanceChecked(
                                                        flight.clearance
                                                    )}
                                                    onChange={() =>
                                                        onToggleClearance(
                                                            flight.id,
                                                            !isClearanceChecked(
                                                                flight.clearance
                                                            )
                                                        )
                                                    } // or: onToggleClearance(flight.id)
                                                    label=""
                                                    checkedClass="bg-green-600 border-green-600"
                                                    flashing={isFlashing}
                                                />
                                            </td>
                                        )}
                                        {departureColumns.status !== false && (
                                            <td className="py-2 px-4">
                                                <StatusDropdown
                                                    value={flight.status}
                                                    onChange={(status) =>
                                                        handleStatusChange(
                                                            flight.id,
                                                            status
                                                        )
                                                    }
                                                    size="xs"
                                                    placeholder="-"
                                                />
                                            </td>
                                        )}
                                        {departureColumns.remark !== false && (
                                            <td className="py-2 px-4 column-rmk">
                                                <TextInput
                                                    value={flight.remark || ''}
                                                    onChange={(value) =>
                                                        handleRemarkChange(
                                                            flight.id,
                                                            value
                                                        )
                                                    }
                                                    className="bg-transparent border-none focus:bg-gray-800 px-1 rounded text-white"
                                                    placeholder="-"
                                                    maxLength={50}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.currentTarget.blur();
                                                        }
                                                    }}
                                                    editingAvatar={
                                                        remarkEditingState?.avatar ||
                                                        null
                                                    }
                                                    editingUsername={
                                                        remarkEditingState?.username
                                                    }
                                                    onFocus={() =>
                                                        handleFieldFocus(
                                                            flight.id,
                                                            'remark'
                                                        )
                                                    }
                                                    onBlur={() =>
                                                        handleFieldBlur(
                                                            flight.id,
                                                            'remark'
                                                        )
                                                    }
                                                />
                                            </td>
                                        )}
                                        {departureColumns.pdc !== false && (
                                            <td className="py-2 px-4 column-pdc">
                                                <button
                                                    className="text-gray-400 hover:text-blue-500 px-2 py-1 rounded transition-colors"
                                                    onClick={() =>
                                                        handlePDCOpen(flight)
                                                    }
                                                    title="Generate PDC"
                                                >
                                                    <FileSpreadsheet />
                                                </button>
                                            </td>
                                        )}
                                        {departureColumns.hide !== false && (
                                            <td className="py-2 px-4 column-hide">
                                                <button
                                                    title={
                                                        flight.hidden
                                                            ? 'Unhide'
                                                            : 'Hide'
                                                    }
                                                    className="text-gray-400 hover:text-blue-500"
                                                    onClick={() =>
                                                        flight.hidden
                                                            ? handleUnhideFlight(
                                                                  flight.id
                                                              )
                                                            : handleHideFlight(
                                                                  flight.id
                                                              )
                                                    }
                                                >
                                                    {flight.hidden ? (
                                                        <Eye />
                                                    ) : (
                                                        <EyeOff />
                                                    )}
                                                </button>
                                            </td>
                                        )}
                                        {departureColumns.delete !== false && (
                                            <td className="py-2 px-4">
                                                <button
                                                    title="Delete"
                                                    className="text-gray-400 hover:text-red-500"
                                                    onClick={() =>
                                                        handleDeleteFlight(
                                                            flight.id
                                                        )
                                                    }
                                                >
                                                    <Trash2 />
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            <PDCModal
                isOpen={pdcModalOpen}
                onClose={handlePDCClose}
                flight={selectedFlight}
                onIssuePDC={onIssuePDC}
            />
        </div>
    );
}
