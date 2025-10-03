import { useState } from 'react';
import { useMediaQuery } from 'react-responsive';
import { EyeOff, Eye, Trash2, FileSpreadsheet } from 'lucide-react';
import type { Flight } from '../../types/flight';
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

interface DepartureTableProps {
	flights: Flight[];
	onFlightUpdate: (
		flightId: string | number,
		updates: Partial<Flight>
	) => void;
	onFlightDelete: (flightId: string | number) => void;
	onFlightChange?: (
		flightId: string | number,
		updates: Partial<Flight>
	) => void;
}

export default function DepartureTable({
	flights,
	onFlightDelete,
	onFlightChange
}: DepartureTableProps) {
	const [showHidden, setShowHidden] = useState(false);
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
			<div className="mt-24 px-4 py-6 text-center text-gray-400">
				No departures found.
			</div>
		);
	}

	if (isMobile) {
		return (
			<DepartureTableMobile
				flights={flights}
				onFlightDelete={onFlightDelete}
				onFlightChange={onFlightChange}
			/>
		);
	}

	// Desktop table view
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
			<div className="table-view">
				<table className="min-w-full bg-zinc-900 rounded-lg">
					<thead>
						<tr className="bg-blue-950 text-blue-200">
							<th className="py-2.5 px-4 text-left column-time">
								TIME
							</th>
							<th className="py-2.5 px-4 text-left w">
								CALLSIGN
							</th>
							<th className="py-2.5 px-4 text-left w-24 column-stand">
								STAND
							</th>
							<th className="py-2.5 px-4 text-left">ATYP</th>
							<th className="py-2.5 px-4 text-left column-w">
								W
							</th>
							<th className="py-2.5 px-4 text-left">V</th>
							<th className="py-2.5 px-4 text-left">ADES</th>
							<th className="py-2.5 px-4 text-left column-rwy">
								RWY
							</th>
							<th className="py-2.5 px-4 text-left">SID</th>
							<th className="py-2.5 px-4 text-left column-rfl">
								RFL
							</th>
							<th className="py-2.5 px-4 text-left">CFL</th>
							<th className="py-2.5 px-4 text-left w-28">ASSR</th>
							<th className="py-2.5 px-4 text-left">C</th>
							<th className="py-2.5 px-4 text-left">STS</th>
							<th className="py-2.5 px-4 text-left w-64 column-rmk">
								RMK
							</th>
							<th className="py-2.5 px-4 text-left column-pdc">
								PDC
							</th>
							<th className="py-2.5 px-4 text-left column-hide">
								HIDE
							</th>
							<th className="py-2.5 px-4 text-left">DEL</th>
						</tr>
					</thead>
					<tbody>
						{visibleFlights.map((flight) => (
							<tr
								key={flight.id}
								className={`border-b border-zinc-800 ${
									flight.hidden
										? 'bg-zinc-800 text-gray-500'
										: ''
								}`}
							>
								<td className="py-2 px-4 column-time">
									{flight.timestamp
										? new Date(
												flight.timestamp
										  ).toLocaleTimeString('en-GB', {
												hour: '2-digit',
												minute: '2-digit',
												timeZone: 'UTC'
										  })
										: '-'}
								</td>
								<td className="py-2 px-4">
									<TextInput
										value={flight.callsign || ''}
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
									/>
								</td>
								<td className="py-2 px-4 column-stand">
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
								</td>
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
								<td className="py-2 px-4 column-w">
									{flight.wtc || '-'}
								</td>
								<td className="py-2 px-4">
									{flight.flight_type || '-'}
								</td>
								<td className="py-2 px-4">
									<AirportDropdown
										value={flight.arrival}
										onChange={(icao) =>
											handleArrivalChange(flight.id, icao)
										}
										size="xs"
										showFullName={false}
									/>
								</td>
								<td className="py-2 px-4 column-rwy">
									<RunwayDropdown
										airportIcao={flight.departure || ''}
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
								<td className="py-2 px-4">
									<SidDropdown
										airportIcao={flight.departure || ''}
										value={flight.sid}
										onChange={(sid) =>
											handleSidChange(flight.id, sid)
										}
										size="xs"
										placeholder="-"
									/>
								</td>
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
								<td className="py-2 px-4">
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
								</td>
								<td className="py-2 px-4">
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
								</td>
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
								<td className="py-2 px-4 column-rmk">
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
								</td>
								<td className="py-2 px-4 column-pdc">
									<button
										className="text-gray-400 hover:text-blue-500 px-2 py-1 rounded"
										onClick={() => {
											/* open PDC modal logic here */
										}}
									>
										<FileSpreadsheet />
									</button>
								</td>
								<td className="py-2 px-4 column-hide">
									<button
										title={
											flight.hidden ? 'Unhide' : 'Hide'
										}
										className="text-gray-400 hover:text-blue-500"
										onClick={() =>
											flight.hidden
												? handleUnhideFlight(flight.id)
												: handleHideFlight(flight.id)
										}
									>
										{flight.hidden ? <Eye /> : <EyeOff />}
									</button>
								</td>
								<td className="py-2 px-4">
									<button
										title="Delete"
										className="text-gray-400 hover:text-red-500"
										onClick={() =>
											handleDeleteFlight(flight.id)
										}
									>
										<Trash2 />
									</button>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
