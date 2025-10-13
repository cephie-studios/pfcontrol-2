import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Loader from '../components/common/Loader';
import { useAuth } from '../hooks/auth/useAuth';
import {
	ArrowLeft,
	Plane,
	Clock,
	MapPin,
	TrendingUp,
	Award,
	Gauge,
	AlertCircle,
	Bug,
	Database,
	Download,
	Terminal,
	Trash,
	RefreshCw,
	Share2,
	Check
} from 'lucide-react';
import { Line as ChartLine } from 'react-chartjs-2';
import {
	Chart as ChartJS,
	CategoryScale,
	LinearScale,
	PointElement,
	LineElement,
	Title,
	Tooltip as ChartTooltip,
	Legend as ChartLegend,
	Filler
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
	CategoryScale,
	LinearScale,
	PointElement,
	LineElement,
	Title,
	ChartTooltip,
	ChartLegend,
	Filler
);

interface Flight {
	id: string;
	callsign: string;
	departure_icao: string;
	arrival_icao: string;
	aircraft_icao: string;
	aircraft_model: string | null;
	livery: string | null;
	route: string | null;
	flight_status: string;
	controller_status?: string | null;
	duration_minutes: number | null;
	total_distance_nm: number | null;
	max_altitude_ft: number | null;
	max_speed_kts: number | null;
	average_speed_kts: number | null;
	landing_rate_fpm: number | null;
	landing_score: number | null;
	smoothness_score: number | null;
	created_at: string;
	completed_at: string | null;
	flight_start?: string | null;
	// Active flight data
	is_active?: boolean;
	current_altitude?: number | null;
	current_speed?: number | null;
	current_heading?: number | null;
	current_phase?: string | null;
	last_update?: string | null;
	landing_detected?: boolean;
	stationary_notification_sent?: boolean;
	telemetry_count?: number;
}

interface TelemetryPoint {
	timestamp: string;
	altitude_ft: number;
	speed_kts: number;
	heading: number;
	flight_phase: string;
}

export default function FlightDetail() {
	const { flightId } = useParams<{ flightId: string }>();
	const navigate = useNavigate();
	const { user } = useAuth();
	const [flight, setFlight] = useState<Flight | null>(null);
	const [telemetry, setTelemetry] = useState<TelemetryPoint[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [liveDuration, setLiveDuration] = useState<number | null>(null);
	const [lastFetchTime, setLastFetchTime] = useState<number>(Date.now());

	// Share state
	const [shareUrl, setShareUrl] = useState<string>('');
	const [shareLoading, setShareLoading] = useState(false);
	const [shareCopied, setShareCopied] = useState(false);

	// Debug state
	const [showDebug, setShowDebug] = useState(false);
	const [debugData, setDebugData] = useState<{ type: string; data: unknown } | null>(null);
	const [debugLoading, setDebugLoading] = useState(false);

	// Completion popup state
	const [showCompletionPopup, setShowCompletionPopup] = useState(false);
	const [completingFlight, setCompletingFlight] = useState(false);

	const fetchFlightDetails = useCallback(async () => {
		try {
			const res = await fetch(
				`${import.meta.env.VITE_SERVER_URL}/api/logbook/flights/${flightId}`,
				{ credentials: 'include' }
			);
			if (res.ok) {
				const data = await res.json();
				setFlight(data);
				setLastFetchTime(Date.now()); // Track when we got fresh data
			} else {
				setError('Flight not found');
			}
		} catch {
			setError('Failed to load flight details');
		} finally {
			setLoading(false);
		}
	}, [flightId]);

	const fetchTelemetry = useCallback(async () => {
		try {
			const res = await fetch(
				`${import.meta.env.VITE_SERVER_URL}/api/logbook/flights/${flightId}/telemetry`,
				{ credentials: 'include' }
			);
			if (res.ok) {
				const data = await res.json();

				const seen = new Map<number, TelemetryPoint>();
				const deduplicated = data.filter((point: TelemetryPoint) => {
					const timestamp = new Date(point.timestamp).getTime();
					const roundedTime = Math.round(timestamp / 5000) * 5000;

					if (!seen.has(roundedTime)) {
						seen.set(roundedTime, point);
						return true;
					}
					return false;
				});

				setTelemetry(deduplicated);
			}
		} catch (err) {
			console.error('Failed to load telemetry:', err);
		}
	}, [flightId]);

	useEffect(() => {
		fetchFlightDetails();
		fetchTelemetry();

		// Poll for updates if flight is active
		let pollInterval: NodeJS.Timeout;

		const startPolling = () => {
			pollInterval = setInterval(() => {
				fetchFlightDetails();
				fetchTelemetry(); // Also update telemetry graphs in real-time
			}, 5000); // Poll every 5 seconds
		};

		// Check if we need to poll after initial load
		const checkPolling = setTimeout(() => {
			if (flight?.is_active) {
				startPolling();
			}
		}, 1000);

		return () => {
			clearInterval(pollInterval);
			clearTimeout(checkPolling);
		};
	}, [flightId, flight?.is_active, fetchFlightDetails, fetchTelemetry]);

	// Live duration counter for active flights
	// Server calculates duration_minutes from created_at every 5s
	// We interpolate between updates for smooth second-by-second counting
	useEffect(() => {
		if (!flight?.is_active) {
			setLiveDuration(null);
			return;
		}

		const baseDuration = flight.duration_minutes || 0;

		const updateDuration = () => {
			// Calculate seconds since last server update
			const secondsSinceUpdate = Math.floor((Date.now() - lastFetchTime) / 1000);
			// Add to server's base duration (convert seconds to fractional minutes)
			setLiveDuration(baseDuration + (secondsSinceUpdate / 60));
		};

		// Update immediately
		updateDuration();

		// Update every second for smooth counting
		const interval = setInterval(updateDuration, 1000);

		return () => clearInterval(interval);
	}, [flight?.is_active, flight?.duration_minutes, lastFetchTime]);

	// Show completion popup when flight is stationary
	useEffect(() => {
		if (flight?.stationary_notification_sent && !showCompletionPopup && !completingFlight) {
			setShowCompletionPopup(true);
		}
	}, [flight?.stationary_notification_sent, showCompletionPopup, completingFlight]);

	const handleShare = async () => {
		setShareLoading(true);
		try {
			const res = await fetch(
				`${import.meta.env.VITE_SERVER_URL}/api/logbook/flights/${flightId}/share`,
				{
					method: 'POST',
					credentials: 'include'
				}
			);

			if (res.ok) {
				const data = await res.json();
				setShareUrl(data.shareUrl);

				// Copy to clipboard
				await navigator.clipboard.writeText(data.shareUrl);
				setShareCopied(true);

				// Reset copied state after 3 seconds
				setTimeout(() => setShareCopied(false), 3000);
			}
		} catch (err) {
			console.error('Failed to generate share link:', err);
		} finally {
			setShareLoading(false);
		}
	};

	const handleCompleteFlight = async () => {
		setCompletingFlight(true);
		try {
			const res = await fetch(
				`${import.meta.env.VITE_SERVER_URL}/api/logbook/flights/${flightId}/complete`,
				{
					method: 'POST',
					credentials: 'include'
				}
			);

			if (res.ok) {
				setShowCompletionPopup(false);
				fetchFlightDetails();
				navigate('/logbook');
			} else {
				const data = await res.json();
				alert(data.error || 'Failed to complete flight');
			}
		} catch (err) {
			console.error('Failed to complete flight:', err);
			alert('Failed to complete flight');
		} finally {
			setCompletingFlight(false);
		}
	};

	const formatDuration = (minutes: number | null, isLive: boolean = false) => {
		if (minutes === null || minutes === undefined) return 'N/A';
		if (minutes < 1 && !isLive) return 'N/A';
		if (minutes < 1) return '0m';
		const totalMinutes = Math.floor(minutes);
		const hours = Math.floor(totalMinutes / 60);
		const mins = totalMinutes % 60;
		return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
	};

	const getLandingGrade = (fpm: number | null) => {
		if (!fpm) return {
			text: 'N/A',
			color: 'text-gray-400',
			bg: 'bg-gradient-to-br from-gray-800/50 to-gray-900/50',
			border: 'border-gray-600/50',
			glow: 'shadow-gray-500/0'
		};

		const rate = Math.abs(fpm);

		if (rate < 100) return {
			text: 'Butter',
			color: 'text-yellow-400',
			bg: 'bg-gradient-to-br from-yellow-900/30 to-orange-900/30',
			border: 'border-yellow-500/50',
			glow: 'shadow-lg shadow-yellow-500/20'
		};
		if (rate < 300) return {
			text: 'Smooth',
			color: 'text-green-400',
			bg: 'bg-gradient-to-br from-green-900/30 to-emerald-900/30',
			border: 'border-green-500/50',
			glow: 'shadow-lg shadow-green-500/20'
		};
		if (rate < 600) return {
			text: 'Firm',
			color: 'text-blue-400',
			bg: 'bg-gradient-to-br from-blue-900/30 to-cyan-900/30',
			border: 'border-blue-500/50',
			glow: 'shadow-lg shadow-blue-500/20'
		};
		if (rate < 1000) return {
			text: 'Hard',
			color: 'text-orange-400',
			bg: 'bg-gradient-to-br from-orange-900/30 to-red-900/30',
			border: 'border-orange-500/50',
			glow: 'shadow-lg shadow-orange-500/20'
		};
		return {
			text: 'Crash',
			color: 'text-red-400',
			bg: 'bg-gradient-to-br from-red-900/30 to-rose-900/30',
			border: 'border-red-500/50',
			glow: 'shadow-lg shadow-red-500/20'
		};
	};

	const getPhaseTimeline = () => {
		if (telemetry.length === 0) return [];

		// Normalize phase names to group similar phases
		const normalizePhase = (phase: string | null): string => {
			if (!phase) return 'unknown';
			const lower = phase.toLowerCase();

			// Group all taxi phases
			if (lower.includes('taxi')) return 'taxi';
			// Group all runway phases
			if (lower.includes('runway') || lower === 'rwy') return 'runway';

			return lower;
		};

		const phases: Array<{
			phase: string;
			startTime: Date;
			endTime: Date;
			duration: number;
		}> = [];

		let currentPhase = normalizePhase(telemetry[0].flight_phase);
		let phaseStart = new Date(telemetry[0].timestamp);

		for (let i = 1; i < telemetry.length; i++) {
			const normalizedPhase = normalizePhase(telemetry[i].flight_phase);

			if (normalizedPhase !== currentPhase) {
				// Phase changed
				const phaseEnd = new Date(telemetry[i - 1].timestamp);
				const duration = Math.round((phaseEnd.getTime() - phaseStart.getTime()) / 60000);

				// Only add phases that last at least 1 minute
				if (duration >= 1) {
					phases.push({
						phase: currentPhase,
						startTime: phaseStart,
						endTime: phaseEnd,
						duration
					});
				}

				currentPhase = normalizedPhase;
				phaseStart = new Date(telemetry[i].timestamp);
			}
		}

		// Add the last phase
		const phaseEnd = new Date(telemetry[telemetry.length - 1].timestamp);
		const duration = Math.round((phaseEnd.getTime() - phaseStart.getTime()) / 60000);
		if (duration >= 1) {
			phases.push({
				phase: currentPhase,
				startTime: phaseStart,
				endTime: phaseEnd,
				duration
			});
		}

		// Filter out unknowns and consolidate consecutive duplicate phases
		const filtered = phases.filter(p => p.phase !== 'unknown');
		const consolidated: typeof phases = [];

		for (const phase of filtered) {
			const last = consolidated[consolidated.length - 1];
			if (last && last.phase === phase.phase) {
				// Merge with previous phase
				last.endTime = phase.endTime;
				last.duration = Math.round((last.endTime.getTime() - last.startTime.getTime()) / 60000);
			} else {
				consolidated.push(phase);
			}
		}

		// Add "Gate" phase at the end for completed flights
		if (!isActive && consolidated.length > 0) {
			const lastPhase = consolidated[consolidated.length - 1];
			// Only add gate if the last phase is taxi (destination taxi)
			if (lastPhase.phase === 'taxi') {
				consolidated.push({
					phase: 'gate',
					startTime: lastPhase.endTime,
					endTime: lastPhase.endTime,
					duration: 0
				});
			}
		}

		return consolidated;
	};

	// Debug functions
	const loadFlightDebug = async () => {
		setDebugLoading(true);
		try {
			const res = await fetch(
				`${import.meta.env.VITE_SERVER_URL}/api/logbook/debug/raw-flights`,
				{ credentials: 'include' }
			);
			if (res.ok) {
				const data = await res.json();
				const currentFlight = data.find((f: Flight) => f.id === flightId);
				setDebugData({ type: 'flight-data', data: currentFlight });
			}
		} catch (err) {
			console.error('Error loading flight debug:', err);
		} finally {
			setDebugLoading(false);
		}
	};

	const loadTelemetryDebug = async () => {
		setDebugLoading(true);
		try {
			const res = await fetch(
				`${import.meta.env.VITE_SERVER_URL}/api/logbook/flights/${flightId}/telemetry`,
				{ credentials: 'include' }
			);
			if (res.ok) {
				const data = await res.json();
				setDebugData({ type: 'telemetry', data });
			}
		} catch (err) {
			console.error('Error loading telemetry debug:', err);
		} finally {
			setDebugLoading(false);
		}
	};

	const clearTelemetry = async () => {
		if (!confirm('Delete all telemetry data for this flight? This cannot be undone.')) return;
		setDebugLoading(true);
		try {
			const res = await fetch(
				`${import.meta.env.VITE_SERVER_URL}/api/logbook/debug/clear-telemetry/${flightId}`,
				{
					method: 'DELETE',
					credentials: 'include'
				}
			);
			if (res.ok) {
				alert('Telemetry cleared successfully!');
				setTelemetry([]);
			}
		} catch (err) {
			console.error('Error clearing telemetry:', err);
			alert('Failed to clear telemetry');
		} finally {
			setDebugLoading(false);
		}
	};

	const exportFlightData = async () => {
		setDebugLoading(true);
		try {
			const data = {
				flight,
				telemetry,
				exportedAt: new Date().toISOString()
			};
			const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `flight-${flightId}-export-${new Date().toISOString()}.json`;
			a.click();
		} catch (err) {
			console.error('Error exporting data:', err);
			alert('Failed to export data');
		} finally {
			setDebugLoading(false);
		}
	};

	if (loading) {
		return (
			<div className="min-h-screen bg-gray-950 text-white">
				<Navbar />
				<div className="flex items-center justify-center h-[calc(100vh-4rem)]">
					<Loader />
				</div>
			</div>
		);
	}

	if (error || !flight) {
		return (
			<div className="min-h-screen bg-gray-950 text-white">
				<Navbar />
				<div className="container mx-auto max-w-4xl px-4 py-30">
					<div className="bg-red-900/30 border-2 border-red-700 rounded-xl p-6 flex items-center">
						<AlertCircle className="h-6 w-6 mr-3 text-red-400" />
						<div>
							<p className="text-red-200 font-semibold">
								{error || 'Flight not found'}
							</p>
							<button
								onClick={() => navigate('/logbook')}
								className="text-sm text-red-400 hover:text-red-300 mt-1"
							>
								← Back to Logbook
							</button>
						</div>
					</div>
				</div>
			</div>
		);
	}

	const landingGrade = getLandingGrade(flight.landing_rate_fpm);
	const isActive = flight.is_active && (flight.flight_status === 'active' || flight.flight_status === 'pending');

	const getPhaseColor = (phase: string | null | undefined) => {
		const colors: Record<string, string> = {
			awaiting_clearance: 'text-cyan-400 bg-cyan-900/30',
			origin_taxi: 'text-gray-400 bg-gray-900/50',
			destination_taxi: 'text-gray-400 bg-gray-900/50',
			taxi: 'text-gray-400 bg-gray-900/50',
			origin_runway: 'text-pink-400 bg-pink-900/30',
			destination_runway: 'text-pink-400 bg-pink-900/30',
			runway: 'text-pink-400 bg-pink-900/30',
			climb: 'text-blue-400 bg-blue-900/30',
			cruise: 'text-purple-400 bg-purple-900/30',
			descent: 'text-yellow-400 bg-yellow-900/30',
			approach: 'text-orange-400 bg-orange-900/30',
			landing: 'text-red-400 bg-red-900/30',
			push: 'text-indigo-400 bg-indigo-900/30',
			parked: 'text-slate-400 bg-slate-900/30'
		};
		return colors[phase || ''] || 'text-gray-400 bg-gray-900/50';
	};

	return (
		<div className="min-h-screen bg-gray-950 text-white">
			<Navbar />

			{/* Modern Hero Header */}
			<div className="relative w-full bg-gradient-to-br from-blue-900/40 via-purple-900/30 to-gray-900/40 border-b-2 border-blue-800/30 py-8">
				<div className="absolute inset-0 bg-[url('/assets/app/backgrounds/mdpc_01.png')] bg-cover bg-center opacity-10"></div>
				<div className="relative container mx-auto max-w-6xl px-4 py-8">
					{/* Navigation Bar */}
					<div className="flex items-center justify-between mb-6">
						<button
							onClick={() => navigate('/logbook')}
							className="flex items-center text-blue-300 hover:text-blue-200 transition-colors group"
						>
							<ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
							Back to Logbook
						</button>

						<button
							onClick={handleShare}
							disabled={shareLoading}
							className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border-2 border-blue-500/50 rounded-lg transition-all text-blue-300 hover:text-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{shareCopied ? (
								<>
									<Check className="h-4 w-4" />
									<span className="text-sm font-medium">Copied!</span>
								</>
							) : (
								<>
									<Share2 className="h-4 w-4" />
									<span className="text-sm font-medium">
										{shareLoading ? 'Generating...' : 'Share Flight'}
									</span>
								</>
							)}
						</button>
					</div>

					{/* Flight Header */}
					<div className="flex items-start justify-between">
						<div className="flex items-start gap-4">
							<div className="p-3 bg-blue-500/20 rounded-xl">
								<Plane className="h-8 w-8 text-blue-400" />
							</div>
							<div>
								<div className="flex items-center gap-3 mb-2">
									<h1 className="text-4xl md:text-5xl font-bold text-white">
										{flight.callsign}
									</h1>
									{isActive && (
										<div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 border-2 border-green-500/50 rounded-full">
											<div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
											<span className="text-green-300 font-semibold text-sm">
												LIVE
											</span>
										</div>
									)}
								</div>
								<div className="flex items-center gap-3 text-xl mb-3">
									<span className="font-semibold text-blue-300">
										{flight.departure_icao}
									</span>
									<div className="flex items-center gap-1">
										<div className="w-2 h-2 bg-blue-400 rounded-full"></div>
										<div className="w-8 h-px bg-blue-400"></div>
										<Plane className="h-5 w-5 text-blue-400 -rotate-45" />
										<div className="w-8 h-px bg-blue-400"></div>
										<div className="w-2 h-2 bg-blue-400 rounded-full"></div>
									</div>
									<span className="font-semibold text-blue-300">
										{flight.arrival_icao}
									</span>
								</div>
								<div className="flex items-center gap-4 text-sm text-blue-200/70">
									<span className="flex items-center gap-1.5">
										<Plane className="h-4 w-4" />
										{flight.aircraft_model || flight.aircraft_icao}
									</span>
									<span className="flex items-center gap-1.5">
										<Clock className="h-4 w-4" />
										{new Date(flight.created_at).toLocaleDateString()}{' '}
										{new Date(flight.created_at).toLocaleTimeString([], {
											hour: '2-digit',
											minute: '2-digit'
										})}{' '}
										UTC
									</span>
								</div>
								{flight.route && (
									<div className="mt-2 text-sm text-blue-200/60 font-mono">
										Route: {flight.route}
									</div>
								)}
							</div>
						</div>
						{/* Show landing grade for completed flights */}
						{flight.landing_rate_fpm !== null && !isActive && (
							<div className={`${landingGrade.bg} ${landingGrade.glow} border-2 ${landingGrade.border} rounded-xl px-8 py-5 backdrop-blur-sm transition-all hover:scale-105`}>
								<p className={`text-4xl font-bold ${landingGrade.color} mb-2 tracking-tight`}>
									{landingGrade.text}
								</p>
								<p className="text-sm text-gray-300 text-center font-semibold">
									{flight.landing_rate_fpm} fpm
								</p>
							</div>
						)}

						{/* Show landing rate for active flights when controller has set destination status */}
						{isActive && flight.landing_rate_fpm !== null && flight.controller_status &&
						 ['destination_runway', 'destination_taxi', 'gate'].includes(flight.controller_status.toLowerCase()) && (
							<div className={`${landingGrade.bg} border-2 ${landingGrade.border} rounded-xl px-8 py-5 backdrop-blur-sm text-center ${landingGrade.glow}`}>
								<p className="text-sm text-gray-400 mb-1">Landing Rate</p>
								<p className={`text-3xl font-bold ${landingGrade.color} tracking-tight`}>
									{flight.landing_rate_fpm} fpm
								</p>
								<p className={`text-lg font-semibold ${landingGrade.color} mt-2`}>
									{landingGrade.text}
								</p>
							</div>
						)}
					</div>
				</div>
			</div>

			<div className="container mx-auto max-w-6xl px-4 py-8">

				{/* Completion Popup Modal */}
				{showCompletionPopup && (
					<div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
						<div className="bg-gradient-to-br from-gray-900 to-gray-800 border-2 border-green-600/50 rounded-2xl p-8 max-w-md w-full shadow-2xl shadow-green-500/20">
							<div className="flex items-center gap-4 mb-6">
								<div className="p-3 bg-green-500/20 rounded-xl">
									<Check className="h-8 w-8 text-green-400" />
								</div>
								<div>
									<h2 className="text-2xl font-bold text-white">Flight Ready to Complete</h2>
									<p className="text-gray-400 text-sm mt-1">You've arrived at the gate</p>
								</div>
							</div>

							<p className="text-gray-300 mb-6">
								Your flight <span className="font-bold text-blue-300">{flight?.callsign}</span> has been stationary for over 1 minute.
								Would you like to complete your flight now?
							</p>

							<div className="flex gap-3">
								<button
									onClick={() => setShowCompletionPopup(false)}
									disabled={completingFlight}
									className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
								>
									Not Yet
								</button>
								<button
									onClick={handleCompleteFlight}
									disabled={completingFlight}
									className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
								>
									{completingFlight ? (
										<>
											<RefreshCw className="h-4 w-4 animate-spin" />
											Completing...
										</>
									) : (
										<>
											<Check className="h-4 w-4" />
											Complete Flight
										</>
									)}
								</button>
							</div>

							<p className="text-xs text-gray-500 mt-4 text-center">
								Your flight will automatically complete if you leave the game
							</p>
						</div>
					</div>
				)}

				{/* Real-Time Status - Only for active flights */}
				{isActive && (
					<div className="bg-gradient-to-br from-green-900/20 via-blue-900/20 to-purple-900/20 backdrop-blur-sm rounded-xl border-2 border-green-700/40 p-6 mb-6 shadow-lg shadow-green-500/5">
						<div className="flex items-center gap-3 mb-6">
							<div className="p-2 bg-green-500/20 rounded-lg">
								<div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
							</div>
							<h2 className="text-2xl font-bold text-white">
								Real-Time Flight Status
							</h2>
						</div>
						<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
							<div className="bg-gradient-to-br from-gray-900/80 to-gray-900/40 rounded-xl p-4 border-2 border-gray-700/50 hover:border-gray-600/70 transition-all">
								<p className="text-xs text-gray-400 mb-2">Current Phase</p>
								<div className={`inline-block px-3 py-1.5 rounded-lg font-semibold text-sm capitalize ${getPhaseColor(flight.current_phase)}`}>
									{flight.current_phase?.replace(/_/g, ' ') || 'Pending'}
								</div>
							</div>
							<div className="bg-gradient-to-br from-gray-900/80 to-gray-900/40 rounded-xl p-4 border-2 border-gray-700/50 hover:border-gray-600/70 transition-all">
								<p className="text-xs text-gray-400 mb-2">Altitude</p>
								<p className="text-xl font-bold text-white">
									{flight.current_altitude !== null && flight.current_altitude !== undefined
										? `${Math.round(flight.current_altitude).toLocaleString()}`
										: '---'}
								</p>
								<p className="text-xs text-gray-500 mt-1">ft</p>
							</div>
							<div className="bg-gradient-to-br from-gray-900/80 to-gray-900/40 rounded-xl p-4 border-2 border-gray-700/50 hover:border-gray-600/70 transition-all">
								<p className="text-xs text-gray-400 mb-2">Speed</p>
								<p className="text-xl font-bold text-white">
									{flight.current_speed !== null && flight.current_speed !== undefined
										? `${Math.round(flight.current_speed)}`
										: '---'}
								</p>
								<p className="text-xs text-gray-500 mt-1">kts</p>
							</div>
							<div className="bg-gradient-to-br from-gray-900/80 to-gray-900/40 rounded-xl p-4 border-2 border-gray-700/50 hover:border-gray-600/70 transition-all">
								<p className="text-xs text-gray-400 mb-2">Heading</p>
								<p className="text-xl font-bold text-white">
									{flight.current_heading !== null && flight.current_heading !== undefined
										? `${Math.round(flight.current_heading)}°`
										: '---'}
								</p>
								<p className="text-xs text-gray-500 mt-1">degrees</p>
							</div>
						</div>
						{flight.last_update && (
							<div className="mt-4 flex items-center justify-end gap-2 text-xs text-green-400/70">
								<div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
								Last update: {new Date(flight.last_update).toLocaleTimeString()}
							</div>
						)}
					</div>
				)}

				{/* Flight Statistics */}
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
					{/* Duration */}
					<div className="group bg-gradient-to-br from-blue-900/20 to-blue-900/5 backdrop-blur-sm rounded-xl border-2 border-blue-800/30 p-6 hover:border-blue-600/50 transition-all hover:shadow-lg hover:shadow-blue-500/10">
						<div className="flex items-center justify-between mb-3">
							<div className="p-2 bg-blue-500/20 rounded-lg">
								<Clock className="h-5 w-5 text-blue-400" />
							</div>
							<div className="text-right">
								<div className="text-2xl font-bold text-white">
									{formatDuration(liveDuration !== null ? liveDuration : flight.duration_minutes, liveDuration !== null)}
								</div>
								<div className="text-xs text-blue-300">
									Duration {isActive && '(so far)'}
								</div>
							</div>
						</div>
						<div className="h-1 bg-gray-800 rounded-full overflow-hidden">
							<div className="h-full bg-gradient-to-r from-blue-600 to-blue-400 w-full"></div>
						</div>
					</div>

					{/* Distance */}
					<div className="group bg-gradient-to-br from-purple-900/20 to-purple-900/5 backdrop-blur-sm rounded-xl border-2 border-purple-800/30 p-6 hover:border-purple-600/50 transition-all hover:shadow-lg hover:shadow-purple-500/10">
						<div className="flex items-center justify-between mb-3">
							<div className="p-2 bg-purple-500/20 rounded-lg">
								<MapPin className="h-5 w-5 text-purple-400" />
							</div>
							<div className="text-right">
								<div className="text-2xl font-bold text-white">
									{flight.total_distance_nm
										? `${Number(flight.total_distance_nm).toFixed(0)}`
										: isActive ? <span className="text-gray-500 text-lg">---</span> : '---'}
								</div>
								<div className="text-xs text-purple-300">
									Nautical Miles {isActive && '(so far)'}
								</div>
							</div>
						</div>
						<div className="h-1 bg-gray-800 rounded-full overflow-hidden">
							<div className={`h-full bg-gradient-to-r from-purple-600 to-purple-400 ${flight.total_distance_nm ? 'w-full' : 'w-0'}`}></div>
						</div>
					</div>

					{/* Max Altitude */}
					<div className="group bg-gradient-to-br from-green-900/20 to-green-900/5 backdrop-blur-sm rounded-xl border-2 border-green-800/30 p-6 hover:border-green-600/50 transition-all hover:shadow-lg hover:shadow-green-500/10">
						<div className="flex items-center justify-between mb-3">
							<div className="p-2 bg-green-500/20 rounded-lg">
								<TrendingUp className="h-5 w-5 text-green-400" />
							</div>
							<div className="text-right">
								<div className="text-2xl font-bold text-white">
									{flight.max_altitude_ft
										? `${Number(flight.max_altitude_ft).toLocaleString()}`
										: isActive ? <span className="text-gray-500 text-lg">---</span> : '---'}
								</div>
								<div className="text-xs text-green-300">
									Max Altitude (ft)
								</div>
							</div>
						</div>
						<div className="h-1 bg-gray-800 rounded-full overflow-hidden">
							<div className={`h-full bg-gradient-to-r from-green-600 to-green-400 ${flight.max_altitude_ft ? 'w-full' : 'w-0'}`}></div>
						</div>
					</div>

					{/* Max Speed */}
					<div className="group bg-gradient-to-br from-yellow-900/20 to-yellow-900/5 backdrop-blur-sm rounded-xl border-2 border-yellow-800/30 p-6 hover:border-yellow-600/50 transition-all hover:shadow-lg hover:shadow-yellow-500/10">
						<div className="flex items-center justify-between mb-3">
							<div className="p-2 bg-yellow-500/20 rounded-lg">
								<Gauge className="h-5 w-5 text-yellow-400" />
							</div>
							<div className="text-right">
								<div className="text-2xl font-bold text-white">
									{flight.max_speed_kts
										? `${flight.max_speed_kts}`
										: isActive ? <span className="text-gray-500 text-lg">---</span> : '---'}
								</div>
								<div className="text-xs text-yellow-300">
									Max Speed (kts)
								</div>
							</div>
						</div>
						<div className="h-1 bg-gray-800 rounded-full overflow-hidden">
							<div className={`h-full bg-gradient-to-r from-yellow-600 to-yellow-400 ${flight.max_speed_kts ? 'w-full' : 'w-0'}`}></div>
						</div>
					</div>

					{/* Avg Speed */}
					<div className="group bg-gradient-to-br from-cyan-900/20 to-cyan-900/5 backdrop-blur-sm rounded-xl border-2 border-cyan-800/30 p-6 hover:border-cyan-600/50 transition-all hover:shadow-lg hover:shadow-cyan-500/10">
						<div className="flex items-center justify-between mb-3">
							<div className="p-2 bg-cyan-500/20 rounded-lg">
								<Gauge className="h-5 w-5 text-cyan-400" />
							</div>
							<div className="text-right">
								<div className="text-2xl font-bold text-white">
									{flight.average_speed_kts
										? `${flight.average_speed_kts}`
										: isActive ? <span className="text-gray-500 text-lg">---</span> : '---'}
								</div>
								<div className="text-xs text-cyan-300">
									Avg Speed (kts)
								</div>
							</div>
						</div>
						<div className="h-1 bg-gray-800 rounded-full overflow-hidden">
							<div className={`h-full bg-gradient-to-r from-cyan-600 to-cyan-400 ${flight.average_speed_kts ? 'w-full' : 'w-0'}`}></div>
						</div>
					</div>

					{/* Smoothness */}
					<div className="group bg-gradient-to-br from-pink-900/20 to-pink-900/5 backdrop-blur-sm rounded-xl border-2 border-pink-800/30 p-6 hover:border-pink-600/50 transition-all hover:shadow-lg hover:shadow-pink-500/10">
						<div className="flex items-center justify-between mb-3">
							<div className="p-2 bg-pink-500/20 rounded-lg">
								<Award className="h-5 w-5 text-pink-400" />
							</div>
							<div className="text-right">
								<div className="text-2xl font-bold text-white">
									{flight.smoothness_score
										? `${flight.smoothness_score}/100`
										: isActive ? <span className="text-gray-500 text-lg">---</span> : '---'}
								</div>
								<div className="text-xs text-pink-300">
									Smoothness Score
								</div>
							</div>
						</div>
						<div className="h-1 bg-gray-800 rounded-full overflow-hidden">
							<div
								className="h-full bg-gradient-to-r from-pink-600 to-pink-400"
								style={{ width: flight.smoothness_score ? `${flight.smoothness_score}%` : '0%' }}
							></div>
						</div>
					</div>
				</div>

				{/* Altitude & Speed Graph */}
				{telemetry.length > 0 && (
					<div className="mb-6">
						<div className="flex items-center gap-3 mb-4">
							<div className="p-2 bg-orange-500/20 rounded-lg">
								<TrendingUp className="h-5 w-5 text-orange-400" />
							</div>
							<h2 className="text-2xl font-bold text-white">
								Speed & Altitude Graph
							</h2>
							{isActive && (
								<span className="text-sm text-yellow-400 flex items-center gap-2 ml-auto">
									<Clock className="h-4 w-4" />
									Updates in real time
								</span>
							)}
						</div>
						<div className="bg-gray-900/50 backdrop-blur-sm rounded-xl border-2 border-gray-800 p-6">
							<div className="bg-gray-800/50 rounded-lg p-4">
								<ChartLine
								data={{
									labels: telemetry.map(t =>
										new Date(t.timestamp).toLocaleTimeString('en-US', {
											hour: '2-digit',
											minute: '2-digit',
											second: '2-digit',
											timeZone: 'UTC'
										})
									),
									datasets: [
										{
											label: 'Altitude (ft)',
											data: telemetry.map(t => t.altitude_ft),
											borderColor: '#F59E0B',
											backgroundColor: 'rgba(245, 158, 11, 0.05)',
											fill: true,
											tension: 0.5,
											borderWidth: 3,
											pointRadius: 0,
											pointHoverRadius: 5,
											pointHoverBackgroundColor: '#F59E0B',
											pointHoverBorderColor: '#FCD34D',
											pointHoverBorderWidth: 2,
											yAxisID: 'y'
										},
										{
											label: 'Speed (kts)',
											data: telemetry.map(t => t.speed_kts),
											borderColor: '#3B82F6',
											backgroundColor: 'rgba(59, 130, 246, 0.05)',
											fill: true,
											tension: 0.5,
											borderWidth: 3,
											pointRadius: 0,
											pointHoverRadius: 5,
											pointHoverBackgroundColor: '#3B82F6',
											pointHoverBorderColor: '#60A5FA',
											pointHoverBorderWidth: 2,
											yAxisID: 'y1'
										}
									]
								}}
								options={{
									responsive: true,
									maintainAspectRatio: false,
									animation: {
										duration: 1500,
										easing: 'easeInOutQuart'
									},
									transitions: {
										show: {
											animation: {
												duration: 0
											}
										},
										hide: {
											animation: {
												duration: 0
											}
										}
									},
									interaction: {
										mode: 'index' as const,
										intersect: false
									},
									plugins: {
										legend: {
											position: 'bottom' as const,
											labels: {
												color: '#F9FAFB',
												font: { size: 12 },
												padding: 15,
												usePointStyle: true
											}
										},
										tooltip: {
											backgroundColor: 'rgba(17, 24, 39, 0.95)',
											titleColor: '#F9FAFB',
											bodyColor: '#D1D5DB',
											borderColor: '#374151',
											borderWidth: 1,
											cornerRadius: 8,
											displayColors: true,
											mode: 'index' as const,
											intersect: false,
											padding: 12,
											caretPadding: 10,
											caretSize: 6,
											bodyFont: {
												size: 13
											},
											titleFont: {
												size: 14,
												weight: 'bold' as const
											}
										}
									},
									scales: {
										x: {
											grid: {
												color: 'rgba(55, 65, 81, 0.3)'
											},
											border: {
												display: false
											},
											ticks: {
												color: '#9CA3AF',
												font: { size: 11 },
												maxRotation: 0,
												autoSkipPadding: 50
											}
										},
										y: {
											type: 'linear' as const,
											position: 'left' as const,
											title: {
												display: true,
												text: 'Altitude (ft)',
												color: '#F59E0B',
												font: { size: 12, weight: 'bold' as const }
											},
											grid: {
												color: 'rgba(55, 65, 81, 0.3)'
											},
											border: {
												display: false
											},
											ticks: {
												color: '#F59E0B',
												font: { size: 11 }
											}
										},
										y1: {
											type: 'linear' as const,
											position: 'right' as const,
											title: {
												display: true,
												text: 'Speed (kts)',
												color: '#3B82F6',
												font: { size: 12, weight: 'bold' as const }
											},
											grid: {
												drawOnChartArea: false
											},
											border: {
												display: false
											},
											ticks: {
												color: '#3B82F6',
												font: { size: 11 }
											}
										}
									}
								}}
								height={400}
								/>
							</div>
						</div>
					</div>
				)}

				{/* Flight Timeline - Only show for completed flights */}
				{!isActive && telemetry.length > 0 && getPhaseTimeline().length > 0 && (
					<div className="mb-6">
						<div className="flex items-center gap-3 mb-4">
							<div className="p-2 bg-purple-500/20 rounded-lg">
								<Clock className="h-5 w-5 text-purple-400" />
							</div>
							<h2 className="text-2xl font-bold text-white">
								Flight Timeline
							</h2>
						</div>
						<div className="bg-gray-900/50 backdrop-blur-sm rounded-xl border-2 border-gray-800 p-8">
							<div className="relative overflow-x-auto">
								<div className="flex items-center min-w-max">
									{getPhaseTimeline().map((item, index, array) => {
										const phaseColor: Record<string, { dot: string; bg: string; text: string; baseColor: string }> = {
											taxi: { dot: 'bg-red-500 shadow-red-500/50', bg: 'bg-red-500/20', text: 'text-red-300', baseColor: 'red-500' },
											runway: { dot: 'bg-pink-500 shadow-pink-500/50', bg: 'bg-pink-500/20', text: 'text-pink-300', baseColor: 'pink-500' },
											takeoff: { dot: 'bg-emerald-500 shadow-emerald-500/50', bg: 'bg-emerald-500/20', text: 'text-emerald-300', baseColor: 'emerald-500' },
											climb: { dot: 'bg-blue-500 shadow-blue-500/50', bg: 'bg-blue-500/20', text: 'text-blue-300', baseColor: 'blue-500' },
											cruise: { dot: 'bg-purple-500 shadow-purple-500/50', bg: 'bg-purple-500/20', text: 'text-purple-300', baseColor: 'purple-500' },
											descent: { dot: 'bg-yellow-500 shadow-yellow-500/50', bg: 'bg-yellow-500/20', text: 'text-yellow-300', baseColor: 'yellow-500' },
											approach: { dot: 'bg-orange-500 shadow-orange-500/50', bg: 'bg-orange-500/20', text: 'text-orange-300', baseColor: 'orange-500' },
											landing: { dot: 'bg-rose-500 shadow-rose-500/50', bg: 'bg-rose-500/20', text: 'text-rose-300', baseColor: 'rose-500' },
											push: { dot: 'bg-indigo-500 shadow-indigo-500/50', bg: 'bg-indigo-500/20', text: 'text-indigo-300', baseColor: 'indigo-500' },
											gate: { dot: 'bg-green-500 shadow-green-500/50', bg: 'bg-green-500/20', text: 'text-green-300', baseColor: 'green-500' },
											parked: { dot: 'bg-slate-500 shadow-slate-500/50', bg: 'bg-slate-500/20', text: 'text-slate-300', baseColor: 'slate-500' }
										};

										const colors = phaseColor[item.phase] || { dot: 'bg-gray-500 shadow-gray-500/50', bg: 'bg-gray-500/20', text: 'text-gray-300', baseColor: 'gray-500' };
										const nextPhase = index < array.length - 1 ? array[index + 1].phase : null;

										// Create gradient line to next phase (predefined gradients for Tailwind)
										const gradientMap: Record<string, string> = {
											'taxi-runway': 'bg-gradient-to-r from-red-500 to-pink-500',
											'taxi-takeoff': 'bg-gradient-to-r from-red-500 to-emerald-500',
											'taxi-climb': 'bg-gradient-to-r from-red-500 to-blue-500',
											'taxi-gate': 'bg-gradient-to-r from-red-500 to-green-500',
											'runway-climb': 'bg-gradient-to-r from-pink-500 to-blue-500',
											'runway-takeoff': 'bg-gradient-to-r from-pink-500 to-emerald-500',
											'takeoff-climb': 'bg-gradient-to-r from-emerald-500 to-blue-500',
											'climb-cruise': 'bg-gradient-to-r from-blue-500 to-purple-500',
											'cruise-descent': 'bg-gradient-to-r from-purple-500 to-yellow-500',
											'descent-approach': 'bg-gradient-to-r from-yellow-500 to-orange-500',
											'approach-landing': 'bg-gradient-to-r from-orange-500 to-rose-500',
											'landing-taxi': 'bg-gradient-to-r from-rose-500 to-red-500',
											'landing-gate': 'bg-gradient-to-r from-rose-500 to-green-500',
											'taxi-parked': 'bg-gradient-to-r from-red-500 to-slate-500',
										};

										const lineGradient = nextPhase && gradientMap[`${item.phase}-${nextPhase}`]
											? gradientMap[`${item.phase}-${nextPhase}`]
											: colors.dot.split(' ')[0]; // Use base color as fallback

										const displayPhase = item.phase.replace(/_/g, ' ');

										return (
											<div key={index} className="flex items-center">
												{/* Phase Card */}
												<div className="flex flex-col items-center">
													{/* Timeline dot with glow */}
													<div className={`w-8 h-8 rounded-full ${colors.dot} shadow-lg relative z-10 flex items-center justify-center border-4 border-gray-900`}>
														<div className={`w-3 h-3 rounded-full ${colors.dot} animate-pulse`}></div>
													</div>

													{/* Content below dot */}
													<div className={`mt-4 text-center min-w-[140px] px-4 py-3 rounded-xl ${colors.bg} border-2 border-gray-700/50 backdrop-blur-sm`}>
														<h3 className={`text-sm font-bold ${colors.text} capitalize mb-2`}>
															{displayPhase}
														</h3>
														<div className="flex flex-col gap-1">
															<div className="flex items-center justify-center gap-1 text-xs text-gray-400">
																<Clock className="w-3 h-3" />
																{item.startTime.toLocaleTimeString('en-US', {
																	hour: '2-digit',
																	minute: '2-digit',
																	timeZone: 'UTC'
																})}
															</div>
															{item.phase !== 'gate' && (
																<div className="text-xs font-semibold text-gray-300">
																	{item.duration} min
																</div>
															)}
														</div>
													</div>
												</div>

												{/* Connecting line with gradient */}
												{index < array.length - 1 && (
													<div className={`h-1 w-20 mx-2 ${lineGradient} rounded-full shadow-sm`}></div>
												)}
											</div>
										);
									})}
								</div>
							</div>
						</div>
					</div>
				)}

				{/* Admin Debug Panel */}
				{user?.isAdmin && (
					<div className="mt-8">
						<button
							onClick={() => setShowDebug(!showDebug)}
							className="flex items-center gap-2 px-4 py-2 bg-red-900/20 border-2 border-red-700 rounded-lg text-red-400 hover:bg-red-900/30 transition-colors mb-4"
						>
							<Bug className="h-5 w-5" />
							{showDebug ? 'Hide' : 'Show'} Debug Panel
						</button>

						{showDebug && (
							<div className="bg-gray-900/50 backdrop-blur-sm rounded-xl border-2 border-red-700 p-6">
								<h2 className="text-xl font-bold text-red-400 mb-4 flex items-center gap-2">
									<Terminal className="h-5 w-5" />
									Flight Debug Tools
								</h2>

								{/* Action Buttons */}
								<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
									<button
										onClick={loadFlightDebug}
										disabled={debugLoading}
										className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-900/30 border-2 border-blue-700 rounded-lg text-blue-300 hover:bg-blue-900/50 transition-colors disabled:opacity-50"
									>
										<Database className="h-4 w-4" />
										Flight Data
									</button>

									<button
										onClick={loadTelemetryDebug}
										disabled={debugLoading}
										className="flex items-center justify-center gap-2 px-4 py-3 bg-purple-900/30 border-2 border-purple-700 rounded-lg text-purple-300 hover:bg-purple-900/50 transition-colors disabled:opacity-50"
									>
										<RefreshCw className="h-4 w-4" />
										Telemetry Data
									</button>

									<button
										onClick={clearTelemetry}
										disabled={debugLoading}
										className="flex items-center justify-center gap-2 px-4 py-3 bg-red-900/30 border-2 border-red-700 rounded-lg text-red-300 hover:bg-red-900/50 transition-colors disabled:opacity-50"
									>
										<Trash className="h-4 w-4" />
										Clear Telemetry
									</button>

									<button
										onClick={exportFlightData}
										disabled={debugLoading}
										className="flex items-center justify-center gap-2 px-4 py-3 bg-green-900/30 border-2 border-green-700 rounded-lg text-green-300 hover:bg-green-900/50 transition-colors disabled:opacity-50"
									>
										<Download className="h-4 w-4" />
										Export JSON
									</button>
								</div>

								{/* Debug Data Display */}
								{debugLoading && (
									<div className="flex items-center justify-center py-8">
										<Loader />
									</div>
								)}

								{debugData && !debugLoading && (
									<div className="bg-black/50 rounded-lg p-4 border-2 border-gray-700">
										<div className="flex items-center justify-between mb-3">
											<h3 className="text-sm font-semibold text-gray-300 uppercase">
												{debugData.type.replace(/-/g, ' ')}
											</h3>
											<button
												onClick={() => setDebugData(null)}
												className="text-gray-500 hover:text-gray-300"
											>
												<Trash className="h-4 w-4" />
											</button>
										</div>
										<pre className="text-xs text-gray-300 overflow-auto max-h-96 whitespace-pre-wrap">
											{JSON.stringify(debugData.data, null, 2)}
										</pre>
									</div>
								)}

								{/* Quick Flight Info */}
								<div className="mt-6 p-4 bg-gray-800/50 rounded-lg border-2 border-gray-700">
									<h3 className="text-sm font-semibold text-gray-400 mb-2">Quick Info</h3>
									<div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
										<div>
											<p className="text-gray-500">Flight ID</p>
											<p className="text-gray-300 font-mono">{flightId}</p>
										</div>
										<div>
											<p className="text-gray-500">Status</p>
											<p className="text-gray-300 font-mono capitalize">{flight?.flight_status}</p>
										</div>
										<div>
											<p className="text-gray-500">Telemetry Points</p>
											<p className="text-gray-300 font-mono">{telemetry.length.toLocaleString()}</p>
										</div>
										<div>
											<p className="text-gray-500">Is Active</p>
											<p className="text-gray-300 font-mono">{isActive ? 'Yes' : 'No'}</p>
										</div>
									</div>
								</div>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
