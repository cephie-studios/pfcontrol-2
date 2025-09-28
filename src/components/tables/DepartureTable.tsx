import type { Flight } from '../../types/flight';

interface DepartureTableProps {
	flights: Flight[];
}

export default function DepartureTable({ flights }: DepartureTableProps) {
	return (
		<div className="mt-8 px-4">
			<table className="min-w-full bg-zinc-900 rounded-lg overflow-hidden">
				<thead>
					<tr className="bg-blue-950 text-blue-200">
						<th className="py-3 px-4 text-left">TIME</th>
						<th className="py-3 px-4 text-left">CALLSIGN</th>
						<th className="py-3 px-4 text-left">STAND</th>
						<th className="py-3 px-4 text-left">ATYP</th>
						<th className="py-3 px-4 text-left">W</th>
						<th className="py-3 px-4 text-left">V</th>
						<th className="py-3 px-4 text-left">ADES</th>
						<th className="py-3 px-4 text-left">RWY</th>
						<th className="py-3 px-4 text-left">SID</th>
						<th className="py-3 px-4 text-left">RFL</th>
						<th className="py-3 px-4 text-left">CFL</th>
						<th className="py-3 px-4 text-left">ASSR</th>
						<th className="py-3 px-4 text-left">C</th>
						<th className="py-3 px-4 text-left">STS</th>
						<th className="py-3 px-4 text-left">RMK</th>
						<th className="py-3 px-4 text-left">PDC</th>
						<th className="py-3 px-4 text-left">HIDE</th>
						<th className="py-3 px-4 text-left">DEL</th>
					</tr>
				</thead>
				<tbody>
					{flights.length === 0 ? (
						<tr>
							<td
								colSpan={18}
								className="py-6 px-4 text-center text-gray-400"
							>
								No departures found.
							</td>
						</tr>
					) : (
						flights.map((flight) => (
							<tr
								key={flight.id}
								className="border-b border-zinc-800"
							>
								<td className="py-2 px-4">
									{flight.timestamp || '-'}
								</td>
								<td className="py-2 px-4">
									{flight.callsign || '-'}
								</td>
								<td className="py-2 px-4">
									{flight.stand || '-'}
								</td>
								<td className="py-2 px-4">
									{flight.aircraft_type ||
										flight.aircraft ||
										'-'}
								</td>
								<td className="py-2 px-4">
									{flight.wtc || '-'}
								</td>
								<td className="py-2 px-4">
									{flight.flightType ||
										flight.flight_type ||
										'-'}
								</td>
								<td className="py-2 px-4">
									{flight.arrival || '-'}
								</td>
								<td className="py-2 px-4">
									{flight.runway || '-'}
								</td>
								<td className="py-2 px-4">
									{flight.sid || '-'}
								</td>
								<td className="py-2 px-4">
									{flight.rfl || flight.cruisingFL || '-'}
								</td>
								<td className="py-2 px-4">
									{flight.cfl || flight.clearedFL || '-'}
								</td>
								<td className="py-2 px-4">
									{flight.squawk || '-'}
								</td>
								<td className="py-2 px-4">
									<input
										type="checkbox"
										checked={!!flight.clearance}
										readOnly
									/>
								</td>
								<td className="py-2 px-4">
									{flight.status || '-'}
								</td>
								<td className="py-2 px-4">
									{flight.remark || '-'}
								</td>
								<td className="py-2 px-4">
									<button
										className="bg-blue-700 text-white px-2 py-1 rounded"
										onClick={() => {
											/* open PDC modal logic here */
										}}
									>
										PDC
									</button>
								</td>
								<td className="py-2 px-4"> </td>
								<td className="py-2 px-4"> </td>
							</tr>
						))
					)}
				</tbody>
			</table>
		</div>
	);
}
