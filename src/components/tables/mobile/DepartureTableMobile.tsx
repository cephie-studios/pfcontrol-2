import { useState } from 'react';
import { EyeOff, Eye, Trash2, FileSpreadsheet } from 'lucide-react';
import type { Flight } from '../../../types/flight';
import Checkbox from '../../common/Checkbox';
import TextInput from '../../common/TextInput';
import AirportDropdown from '../../dropdowns/AirportDropdown';
import RunwayDropdown from '../../dropdowns/RunwayDropdown';
import AircraftDropdown from '../../dropdowns/AircraftDropdown';
import SidDropdown from '../../dropdowns/SidDropdown';
import AltitudeDropdown from '../../dropdowns/AltitudeDropdown';
import StatusDropdown from '../../dropdowns/StatusDropdown';
import Button from '../../common/Button';

interface DepartureTableProps {
	flights: Flight[];
	onFlightDelete: (flightId: string | number) => void;
	onFlightChange?: (
		flightId: string | number,
		updates: Partial<Flight>
	) => void;
}

export default function DepartureTableMobile({
	flights,
	onFlightDelete,
	onFlightChange
}: DepartureTableProps) {
	const [showHidden, setShowHidden] = useState(false);

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

	const handleToggleClearance = (
		flightId: string | number,
		checked: boolean
	) => {
		if (onFlightChange) {
			onFlightChange(flightId, { clearance: checked });
		}
	};

	const isClearanceChecked = (
		clearance: boolean | string | undefined
	): boolean => {
		if (typeof clearance === 'boolean') {
			return clearance;
		}
		if (typeof clearance === 'string') {
			return clearance.toLowerCase() === 'true';
		}
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

	if (visibleFlights.length === 0) {
		return (
			<div className="mt-8 px-4 py-6 text-center text-gray-400">
				No departures found.
			</div>
		);
	}

	return (
		<div className="mt-8 px-4">
			{flights.some((flight) => flight.hidden) && (
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
			<div className="card-view space-y-4">
				{visibleFlights.map((flight) => (
					<div
						key={flight.id}
						className={`bg-zinc-900 p-4 rounded-lg border border-zinc-800 ${
							flight.hidden ? 'bg-zinc-800 text-gray-500' : ''
						}`}
					>
						<div className="grid grid-cols-2 gap-2 text-sm">
							<div>
								<strong>Callsign:</strong>{' '}
								<TextInput
									value={flight.callsign || ''}
									onChange={(value) =>
										handleCallsignChange(flight.id, value)
									}
									className="bg-transparent border-none focus:bg-gray-800 px-1 rounded text-white"
									placeholder="-"
									maxLength={16}
									onKeyDown={(e) => {
										if (e.key === 'Enter') {
											e.currentTarget.blur();
										}
									}}
								/>
							</div>
							<div>
								<strong>Stand:</strong>{' '}
								<TextInput
									value={flight.stand || ''}
									onChange={(value) =>
										handleStandChange(flight.id, value)
									}
									className="bg-transparent border-none focus:bg-gray-800 px-1 rounded text-white"
									placeholder="-"
									maxLength={8}
									onKeyDown={(e) => {
										if (e.key === 'Enter') {
											e.currentTarget.blur();
										}
									}}
								/>
							</div>
							<div>
								<strong>Aircraft:</strong>{' '}
								<AircraftDropdown
									value={flight.aircraft}
									onChange={(type) =>
										handleAircraftChange(flight.id, type)
									}
									size="xs"
									showFullName={false}
								/>
							</div>
							<div>
								<strong>WTC:</strong> {flight.wtc || '-'}
							</div>
							<div>
								<strong>Type:</strong>{' '}
								{flight.flight_type || '-'}
							</div>
							<div>
								<strong>ADES:</strong>{' '}
								<AirportDropdown
									value={flight.arrival}
									onChange={(icao) =>
										handleArrivalChange(flight.id, icao)
									}
									size="xs"
									showFullName={false}
								/>
							</div>
							<div>
								<strong>Runway:</strong>{' '}
								<RunwayDropdown
									airportIcao={flight.departure || ''}
									value={flight.runway}
									onChange={(runway) =>
										handleRunwayChange(flight.id, runway)
									}
									size="xs"
									placeholder="-"
								/>
							</div>
							<div>
								<strong>SID:</strong>{' '}
								<SidDropdown
									airportIcao={flight.departure || ''}
									value={flight.sid}
									onChange={(sid) =>
										handleSidChange(flight.id, sid)
									}
									size="xs"
									placeholder="-"
								/>
							</div>
							<div>
								<strong>RFL:</strong>{' '}
								<AltitudeDropdown
									value={flight.cruisingFL}
									onChange={(alt) =>
										handleCruisingFLChange(flight.id, alt)
									}
									size="xs"
									placeholder="-"
								/>
							</div>
							<div>
								<strong>CFL:</strong>{' '}
								<AltitudeDropdown
									value={flight.clearedFL}
									onChange={(alt) =>
										handleClearedFLChange(flight.id, alt)
									}
									size="xs"
									placeholder="-"
								/>
							</div>
							<div>
								<strong>Squawk:</strong>{' '}
								<TextInput
									value={flight.squawk || ''}
									onChange={(value) =>
										handleSquawkChange(flight.id, value)
									}
									className="bg-transparent border-none focus:bg-gray-800 px-1 rounded text-white"
									placeholder="-"
									maxLength={4}
									pattern="[0-9]*"
									onKeyDown={(e) => {
										if (e.key === 'Enter') {
											e.currentTarget.blur();
										}
									}}
								/>
							</div>
							<div>
								<strong>Clearance:</strong>{' '}
								<Checkbox
									checked={isClearanceChecked(
										flight.clearance
									)}
									onChange={(checked) =>
										handleToggleClearance(
											flight.id,
											checked
										)
									}
									label=""
									checkedClass="bg-green-600 border-green-600"
								/>
							</div>
							<div>
								<strong>Status:</strong>{' '}
								<StatusDropdown
									value={flight.status}
									onChange={(status) =>
										handleStatusChange(flight.id, status)
									}
									size="xs"
									placeholder="-"
								/>
							</div>
							<div className="col-span-2">
								<strong>Remark:</strong>{' '}
								<TextInput
									value={flight.remark || ''}
									onChange={(value) =>
										handleRemarkChange(flight.id, value)
									}
									className="bg-transparent border-none focus:bg-gray-800 px-1 rounded text-white"
									placeholder="-"
									maxLength={50}
									onKeyDown={(e) => {
										if (e.key === 'Enter') {
											e.currentTarget.blur();
										}
									}}
								/>
							</div>
							<div>
								<strong>Time:</strong>{' '}
								{flight.timestamp
									? new Date(
											flight.timestamp
									  ).toLocaleTimeString('en-GB', {
											hour: '2-digit',
											minute: '2-digit',
											timeZone: 'UTC'
									  })
									: '-'}
							</div>
						</div>
						<div className="flex gap-2 mt-4">
							<button
								className="text-gray-400 hover:text-blue-500 px-2 py-1 rounded"
								onClick={() => {
									/* open PDC modal logic here */
								}}
							>
								<FileSpreadsheet className="w-4 h-4" />
							</button>
							<button
								title={flight.hidden ? 'Unhide' : 'Hide'}
								className="text-gray-400 hover:text-blue-500 px-2 py-1 rounded"
								onClick={() =>
									flight.hidden
										? handleUnhideFlight(flight.id)
										: handleHideFlight(flight.id)
								}
							>
								<EyeOff className="w-4 h-4" />
							</button>
							<button
								title="Delete"
								className="text-gray-400 hover:text-red-500 px-2 py-1 rounded"
								onClick={() => handleDeleteFlight(flight.id)}
							>
								<Trash2 className="w-4 h-4" />
							</button>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
