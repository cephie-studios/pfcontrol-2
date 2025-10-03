import { useState, useEffect } from 'react';
import {
	MapPin,
	Users,
	Plane,
	Clock,
	Eye,
	EyeOff,
	Check,
	X
} from 'lucide-react';
import { createOverviewSocket } from '../sockets/overviewSocket';
import type { OverviewData, OverviewSession } from '../types/overview';
import type { Flight } from '../types/flight';
import Navbar from '../components/Navbar';
import WindDisplay from '../components/tools/WindDisplay';
import Button from '../components/common/Button';
import TextInput from '../components/common/TextInput';
import Dropdown from '../components/common/Dropdown';
import Loader from '../components/common/Loader';

interface FlightWithDetails extends Flight {
	sessionId: string;
	departureAirport: string;
}

export default function PFATCFlights() {
	const [overviewData, setOverviewData] = useState<OverviewData | null>(null);
	const [loading, setLoading] = useState(true);
	const [searchTerm, setSearchTerm] = useState('');
	const [selectedAirport, setSelectedAirport] = useState<string>('');
	const [selectedStatus, setSelectedStatus] = useState<string>('');
	const [selectedFlightType, setSelectedFlightType] = useState<string>('');
	const [showInactive, setShowInactive] = useState(false);
	const [sortBy, setSortBy] = useState<'time' | 'callsign' | 'airport'>(
		'time'
	);

	useEffect(() => {
		const socket = createOverviewSocket(
			(data) => {
				// Transform the data directly without relying on existing state
				const transformedArrivalsByAirport: Record<
					string,
					(Flight & { sessionId: string; departureAirport: string })[]
				> = {};

				if (data.arrivalsByAirport && data.activeSessions) {
					for (const [icao, flights] of Object.entries(
						data.arrivalsByAirport
					)) {
						transformedArrivalsByAirport[icao] = flights.map(
							(flight) => {
								const session = data.activeSessions.find((s) =>
									s.flights.some((f) => f.id === flight.id)
								);
								return {
									...flight,
									sessionId: session?.sessionId || '',
									departureAirport: flight.departure || ''
								};
							}
						);
					}
				}

				setOverviewData({
					...data,
					arrivalsByAirport: transformedArrivalsByAirport
				});
				setLoading(false);
			},
			(error) => {
				console.error('Overview socket error:', error);
				setLoading(false);
			}
		);

		return () => {
			socket.disconnect();
		};
	}, []);

	const activeAirports =
		overviewData?.activeSessions.map((session) => session.airportIcao) ||
		[];
	const allFlights: FlightWithDetails[] = [];
	overviewData?.activeSessions.forEach((session) => {
		session.flights.forEach((flight) => {
			allFlights.push({
				...flight,
				sessionId: session.sessionId,
				departureAirport: session.airportIcao
			});
		});
	});

	const filteredFlights = allFlights.filter((flight) => {
		const matchesSearch =
			!searchTerm ||
			flight.callsign?.toLowerCase().includes(searchTerm.toLowerCase()) ||
			flight.aircraft?.toLowerCase().includes(searchTerm.toLowerCase()) ||
			flight.departure
				?.toLowerCase()
				.includes(searchTerm.toLowerCase()) ||
			flight.arrival?.toLowerCase().includes(searchTerm.toLowerCase());

		const matchesAirport =
			!selectedAirport ||
			flight.departure === selectedAirport ||
			flight.arrival === selectedAirport;

		const matchesStatus =
			!selectedStatus || flight.status === selectedStatus;
		const matchesFlightType =
			!selectedFlightType || flight.flight_type === selectedFlightType;

		return (
			matchesSearch &&
			matchesAirport &&
			matchesStatus &&
			matchesFlightType
		);
	});

	const sortedFlights = [...filteredFlights].sort((a, b) => {
		switch (sortBy) {
			case 'callsign':
				return (a.callsign || '').localeCompare(b.callsign || '');
			case 'airport':
				return (a.departure || '').localeCompare(b.departure || '');
			case 'time':
			default:
				return (
					new Date(b.created_at || 0).getTime() -
					new Date(a.created_at || 0).getTime()
				);
		}
	});

	const airportSessions =
		overviewData?.activeSessions.reduce((acc, session) => {
			if (!acc[session.airportIcao]) {
				acc[session.airportIcao] = [];
			}
			acc[session.airportIcao].push(session);
			return acc;
		}, {} as Record<string, OverviewSession[]>) || {};

	const statusOptions = [
		{ label: 'All Statuses', value: '' },
		{ label: 'PENDING', value: 'PENDING' },
		{ label: 'STUP', value: 'STUP' },
		{ label: 'PUSH', value: 'PUSH' },
		{ label: 'TAXI', value: 'TAXI' },
		{ label: 'RWY', value: 'RWY' },
		{ label: 'DEPA', value: 'DEPA' }
	];

	const flightTypeOptions = [
		{ label: 'All Types', value: '' },
		{ label: 'IFR', value: 'IFR' },
		{ label: 'VFR', value: 'VFR' }
	];

	const sortOptions = [
		{ label: 'Sort by Time', value: 'time' },
		{ label: 'Sort by Callsign', value: 'callsign' },
		{ label: 'Sort by Airport', value: 'airport' }
	];

	const getStatusClass = (status: string) => {
		switch (status) {
			case 'PENDING':
				return 'bg-yellow-900/30 text-yellow-400';
			case 'CLEARED':
				return 'bg-green-900/30 text-green-400';
			case 'TAXI':
				return 'bg-pink-900/30 text-pink-400';
			case 'DEPARTED':
				return 'bg-purple-900/30 text-purple-400';
			case 'STUP':
				return 'bg-cyan-900/30 text-cyan-400';
			case 'PUSH':
				return 'bg-blue-900/30 text-blue-400';
			case 'RWY':
				return 'bg-red-900/30 text-red-400';
			case 'DEPA':
				return 'bg-green-900/30 text-green-400';
			default:
				return 'bg-gray-900/30 text-gray-400';
		}
	};

	if (loading) {
		return (
			<div className="min-h-screen bg-zinc-900 text-white">
				<Navbar />
				<div className="pt-16 flex items-center justify-center min-h-[50vh]">
					<div className="text-center">
						<Loader />
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-zinc-900 text-white">
			<Navbar />

			<div className="pt-16 bg-gradient-to-b from-black via-blue-900/10 to-blue-600/20 border-b border-gray-800">
				<div className="container mx-auto px-4 py-8">
					<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
						<div>
							<h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold bg-gradient-to-br from-blue-400 to-blue-900 bg-clip-text text-transparent leading-tight mb-4">
								<span className="text-transparent bg-gradient-to-r from-white to-blue-600 bg-clip-text">
									PFATC
								</span>{' '}
								Network Overview
							</h1>
							<p className="text-gray-400 mt-2">
								Live view of all PFATC flights and active
								airports
							</p>
						</div>
						<div className="flex items-center gap-6 text-sm">
							<div className="flex items-center gap-2">
								<MapPin className="h-4 w-4 text-blue-400" />
								<span>
									{overviewData?.totalActiveSessions || 0}{' '}
									Active Airports
								</span>
							</div>
							<div className="flex items-center gap-2">
								<Plane className="h-4 w-4 text-green-400" />
								<span>
									{overviewData?.totalFlights || 0} Total
									Flights
								</span>
							</div>
							<div className="flex items-center gap-2">
								<Clock className="h-4 w-4 text-gray-400" />
								<span>
									Last updated:{' '}
									{overviewData?.lastUpdated
										? new Date(
												overviewData.lastUpdated
										  ).toLocaleTimeString()
										: 'Never'}
								</span>
							</div>
						</div>
					</div>
				</div>
			</div>

			<div className="container mx-auto px-4 py-6">
				<div className="bg-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-800 p-6 mb-6 relative z-20">
					<div className="flex flex-col lg:flex-row gap-4">
						<div className="flex-1">
							<TextInput
								value={searchTerm}
								onChange={setSearchTerm}
								placeholder="Search flights by callsign, aircraft, departure, or arrival..."
							/>
						</div>
						<div className="flex flex-col sm:flex-row gap-4">
							<Dropdown
								size="sm"
								value={selectedAirport}
								onChange={setSelectedAirport}
								placeholder="All Airports"
								options={[
									{ label: 'All Airports', value: '' },
									...activeAirports.map((icao) => ({
										label: icao,
										value: icao
									}))
								]}
							/>
							<Dropdown
								size="sm"
								value={selectedStatus}
								onChange={setSelectedStatus}
								placeholder="All Statuses"
								options={statusOptions}
							/>
							<Dropdown
								size="sm"
								value={selectedFlightType}
								onChange={setSelectedFlightType}
								placeholder="All Types"
								options={flightTypeOptions}
							/>
							<Dropdown
								size="sm"
								value={sortBy}
								onChange={(value) =>
									setSortBy(
										value as 'time' | 'callsign' | 'airport'
									)
								}
								placeholder="Sort"
								options={sortOptions}
							/>
						</div>
					</div>
				</div>

				<div className="bg-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-800 overflow-hidden relative z-10">
					<div className="p-6 border-b border-gray-800">
						<div className="flex items-center justify-between">
							<h2 className="text-2xl font-bold">
								All Flights ({sortedFlights.length})
							</h2>
							<Button
								variant="outline"
								size="sm"
								onClick={() => setShowInactive(!showInactive)}
								className="flex items-center gap-2"
							>
								{showInactive ? (
									<EyeOff className="h-4 w-4" />
								) : (
									<Eye className="h-4 w-4" />
								)}
								{showInactive ? 'Hide Inactive' : 'Show All'}
							</Button>
						</div>
					</div>

					<div className="overflow-x-auto">
						<table className="w-full">
							<thead className="bg-gray-800/50">
								<tr>
									<th className="text-left p-4 font-medium text-gray-300">
										Time
									</th>
									<th className="text-left p-4 font-medium text-gray-300">
										Callsign
									</th>
									<th className="text-left p-4 font-medium text-gray-300">
										Clearance
									</th>
									<th className="text-left p-4 font-medium text-gray-300">
										Status
									</th>
									<th className="text-left p-4 font-medium text-gray-300">
										Route
									</th>
									<th className="text-left p-4 font-medium text-gray-300">
										Aircraft
									</th>
									<th className="text-left p-4 font-medium text-gray-300">
										RFL
									</th>
									<th className="text-left p-4 font-medium text-gray-300">
										CFL
									</th>
									<th className="text-left p-4 font-medium text-gray-300">
										SID
									</th>
									<th className="text-left p-4 font-medium text-gray-300">
										STAR
									</th>
									<th className="text-left p-4 font-medium text-gray-300">
										Controller
									</th>
								</tr>
							</thead>
							<tbody>
								{sortedFlights.length === 0 ? (
									<tr>
										<td
											colSpan={11}
											className="text-center p-8 text-gray-400"
										>
											No flights found matching your
											criteria
										</td>
									</tr>
								) : (
									sortedFlights.map((flight) => (
										<tr
											key={`${flight.sessionId}-${flight.id}`}
											className="border-b border-gray-800 hover:bg-gray-800/30"
										>
											<td className="p-4 text-sm text-gray-400">
												{flight.created_at
													? new Date(
															flight.created_at
													  ).toLocaleTimeString()
													: 'N/A'}
											</td>
											<td className="p-4">
												<span className="font-mono font-semibold text-blue-400">
													{flight.callsign || 'N/A'}
												</span>
											</td>
											<td className="p-4">
												{flight.clearance ? (
													<Check className="h-4 w-4 text-green-400" />
												) : (
													<X className="h-4 w-4 text-red-400" />
												)}
											</td>
											<td className="p-4">
												<span
													className={`px-2 py-1 rounded text-xs font-medium ${getStatusClass(
														flight.status || ''
													)}`}
												>
													{flight.status || 'UNKNOWN'}
												</span>
											</td>
											<td className="p-4">
												<div className="flex items-center gap-2">
													<span className="font-mono text-green-400">
														{flight.departure ||
															'N/A'}
													</span>
													<span className="text-gray-500">
														→
													</span>
													<span className="font-mono text-blue-400">
														{flight.arrival ||
															'N/A'}
													</span>
												</div>
											</td>
											<td className="p-4">
												<span className="font-mono">
													{flight.aircraft || 'N/A'}
												</span>
											</td>
											<td className="p-4">
												<span className="font-mono">
													{flight.cruisingFL || 'N/A'}
												</span>
											</td>
											<td className="p-4">
												<span className="font-mono">
													{flight.clearedFL || 'N/A'}
												</span>
											</td>
											<td className="p-4">
												<span className="font-mono">
													{flight.sid || 'N/A'}
												</span>
											</td>
											<td className="p-4">
												<span className="font-mono">
													{flight.star || 'N/A'}
												</span>
											</td>
											<td className="p-4">
												<span className="text-gray-300">
													{flight.departureAirport}
												</span>
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
				</div>

				{overviewData &&
					Object.keys(overviewData.arrivalsByAirport).length > 0 && (
						<div className="mt-8">
							<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
								{Object.entries(
									overviewData.arrivalsByAirport
								).map(([icao, arrivals]) => (
									<div
										key={icao}
										className="bg-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-800 overflow-hidden"
									>
										<div className="p-4 border-b border-gray-800 bg-gray-800/30">
											<div className="flex items-center justify-between">
												<h3 className="text-lg font-bold text-blue-400">
													{icao} Arrivals
												</h3>
												<span className="text-sm text-gray-400">
													{arrivals.length} flights
												</span>
											</div>
											<div className="mt-2 max-w-xs">
												<WindDisplay
													icao={icao}
													size="small"
												/>
											</div>
										</div>
										<div className="max-h-96 overflow-y-auto">
											<table className="w-full">
												<thead className="bg-gray-800/50 sticky top-0">
													<tr>
														<th className="text-left p-3 text-sm font-medium text-gray-300">
															Callsign
														</th>
														<th className="text-left p-3 text-sm font-medium text-gray-300">
															From
														</th>
														<th className="text-left p-3 text-sm font-medium text-gray-300">
															Aircraft
														</th>
														<th className="text-left p-3 text-sm font-medium text-gray-300">
															CFL
														</th>
														<th className="text-left p-3 text-sm font-medium text-gray-300">
															STAR
														</th>
													</tr>
												</thead>
												<tbody>
													{arrivals.map((flight) => (
														<tr
															key={`${flight.sessionId}-${flight.id}`}
															className="border-b border-gray-800/50 hover:bg-gray-800/20"
														>
															<td className="p-3">
																<span className="font-mono text-blue-400 text-sm">
																	{flight.callsign ||
																		'N/A'}
																</span>
															</td>
															<td className="p-3">
																<span className="font-mono text-green-400 text-sm">
																	{
																		flight.departureAirport
																	}
																</span>
															</td>
															<td className="p-3">
																<span className="font-mono text-gray-300 text-sm">
																	{flight.aircraft ||
																		'N/A'}
																</span>
															</td>
															<td className="p-3">
																<span className="font-mono text-gray-300 text-sm">
																	{flight.clearedFL ||
																		'N/A'}
																</span>
															</td>
															<td className="p-3">
																<span className="font-mono text-gray-300 text-sm">
																	{flight.star ||
																		'N/A'}
																</span>
															</td>
														</tr>
													))}
												</tbody>
											</table>
										</div>
									</div>
								))}
							</div>
						</div>
					)}

				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
					{Object.entries(airportSessions).map(([icao, sessions]) => {
						const totalFlights = sessions.reduce(
							(sum, session) => sum + session.flightCount,
							0
						);
						const totalUsers = sessions.reduce(
							(sum, session) => sum + session.activeUsers,
							0
						);

						return (
							<div
								key={icao}
								className="bg-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-800 p-6"
							>
								<div className="flex items-center justify-between mb-4">
									<h3 className="text-xl font-bold text-blue-400">
										{icao}
									</h3>
									<div className="flex items-center gap-2">
										<div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
										<span className="text-sm text-green-400">
											Active
										</span>
									</div>
								</div>

								<WindDisplay icao={icao} size="small" />

								<div className="mt-4 space-y-2">
									<div className="flex items-center justify-between text-sm">
										<span className="text-gray-400">
											Controllers:
										</span>
										<div className="flex items-center gap-1">
											<Users className="h-4 w-4" />
											<span>{totalUsers}</span>
										</div>
									</div>
									<div className="flex items-center justify-between text-sm">
										<span className="text-gray-400">
											Flights:
										</span>
										<div className="flex items-center gap-1">
											<Plane className="h-4 w-4" />
											<span>{totalFlights}</span>
										</div>
									</div>
									{sessions[0]?.activeRunway && (
										<div className="flex items-center justify-between text-sm">
											<span className="text-gray-400">
												Active Runway:
											</span>
											<span className="font-mono">
												{sessions[0].activeRunway}
											</span>
										</div>
									)}
								</div>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}
