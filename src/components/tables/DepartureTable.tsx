import { useState } from 'react';
import type { Flight } from '../../types/flight';
import { EyeOff, Eye, Trash2, FileSpreadsheet } from 'lucide-react';
import Checkbox from '../common/Checkbox';
import TextInput from '../common/TextInput';
import AirportDropdown from '../dropdowns/AirportDropdown';
import RunwayDropdown from '../dropdowns/RunwayDropdown';
import AircraftDropdown from '../dropdowns/AircraftDropdown';
import SidDropdown from '../dropdowns/SidDropdown';
import AltitudeDropdown from '../dropdowns/AltitudeDropdown';

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

	const visibleFlights = showHidden
		? flights
		: flights.filter((flight) => !flight.hidden);

	return (
		<div className="mt-8 px-4">
			{flights.some((flight) => flight.hidden) && (
				<div className="mb-2 flex items-center gap-2">
					<button
						className="bg-zinc-800 text-blue-200 px-3 py-1 rounded flex items-center gap-1"
						onClick={() => setShowHidden((v) => !v)}
					>
						{showHidden ? (
							<Eye className="w-4 h-4" />
						) : (
							<EyeOff className="w-4 h-4" />
						)}
						{showHidden
							? 'Hide hidden flights'
							: 'Show hidden flights'}
					</button>
				</div>
			)}
			<table className="min-w-full bg-zinc-900 rounded-lg">
				<thead>
					<tr className="bg-blue-950 text-blue-200">
						<th className="py-2.5 px-4 text-left">TIME</th>
						<th className="py-2.5 px-4 text-left">CALLSIGN</th>
						<th className="py-2.5 px-4 text-left">STAND</th>
						<th className="py-2.5 px-4 text-left">ATYP</th>
						<th className="py-2.5 px-4 text-left">W</th>
						<th className="py-2.5 px-4 text-left">V</th>
						<th className="py-2.5 px-4 text-left">ADES</th>
						<th className="py-2.5 px-4 text-left">RWY</th>
						<th className="py-2.5 px-4 text-left">SID</th>
						<th className="py-2.5 px-4 text-left">RFL</th>
						<th className="py-2.5 px-4 text-left">CFL</th>
						<th className="py-2.5 px-4 text-left">ASSR</th>
						<th className="py-2.5 px-4 text-left">C</th>
						<th className="py-2.5 px-4 text-left">STS</th>
						<th className="py-2.5 px-4 text-left">RMK</th>
						<th className="py-2.5 px-4 text-left">PDC</th>
						<th className="py-2.5 px-4 text-left">HIDE</th>
						<th className="py-2.5 px-4 text-left">DEL</th>
					</tr>
				</thead>
				<tbody>
					{visibleFlights.length === 0 ? (
						<tr>
							<td
								colSpan={18}
								className="py-6 px-4 text-center text-gray-400"
							>
								No departures found.
							</td>
						</tr>
					) : (
						visibleFlights.map((flight) => (
							<tr
								key={flight.id}
								className={`border-b border-zinc-800 ${
									flight.hidden
										? 'bg-zinc-800 text-gray-500'
										: ''
								}`}
							>
								<td className="py-2 px-4">
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
										onKeyDown={(e) => {
											if (e.key === 'Enter') {
												e.currentTarget.blur();
											}
										}}
									/>
								</td>
								<td className="py-2 px-4">
									<TextInput
										value={flight.stand || ''}
										onChange={(value) =>
											handleStandChange(flight.id, value)
										}
										className="bg-transparent border-none focus:bg-gray-800 px-1 rounded text-white"
										placeholder="-"
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
								<td className="py-2 px-4">
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
								<td className="py-2 px-4">
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
								<td className="py-2 px-4">
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
									{flight.status || '-'}
								</td>
								<td className="py-2 px-4">
									<TextInput
										value={flight.remark || ''}
										onChange={(value) =>
											handleRemarkChange(flight.id, value)
										}
										className="bg-transparent border-none focus:bg-gray-800 px-1 rounded text-white"
										placeholder="-"
										onKeyDown={(e) => {
											if (e.key === 'Enter') {
												e.currentTarget.blur();
											}
										}}
									/>
								</td>
								<td className="py-2 px-4">
									<button
										className="text-gray-400 hover:text-blue-500 px-2 py-1 rounded"
										onClick={() => {
											/* open PDC modal logic here */
										}}
									>
										<FileSpreadsheet />
									</button>
								</td>
								<td className="py-2 px-4">
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
						))
					)}
				</tbody>
			</table>
		</div>
	);
}
