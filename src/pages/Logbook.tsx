import React, { useEffect, useState, type JSX } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Loader from '../components/common/Loader';
import { useAuth } from '../hooks/auth/useAuth';
import {
	BookOpen,
	Plane,
	Clock,
	MapPin,
	TrendingUp,
	Award,
	ChevronRight,
	AlertCircle,
	Check,
	Ruler,
	Trash2,
	RefreshCw,
	Calendar,
	Zap,
	Bug,
	Database,
	Download,
	Terminal,
	RotateCw,
	Trash,
	X,
	AlertTriangle
} from 'lucide-react';

interface Flight {
	id: string;
	callsign: string;
	departure_icao: string;
	arrival_icao: string;
	aircraft_icao: string;
	aircraft_model: string | null;
	flight_status: string;
	controller_status: string | null;
	current_phase: string | null;
	duration_minutes: number | null;
	total_distance_nm: number | null;
	landing_rate_fpm: number | null;
	landing_score: number | null;
	smoothness_score: number | null;
	created_at: string;
}

interface Stats {
	total_flights: number;
	total_flight_time_minutes: number;
	total_distance_nm: number;
	favorite_aircraft: string | null;
	favorite_departure: string | null;
	best_landing_rate: number | null;
	average_landing_score: number | null;
}

interface Notification {
	id: number;
	type: 'info' | 'warning' | 'success' | 'error';
	title: string;
	message: string;
	read: boolean;
	created_at: string;
}

export default function Logbook() {
	const navigate = useNavigate();
	const { user } = useAuth();
	const [flights, setFlights] = useState<Flight[]>([]);
	const [activeFlights, setActiveFlights] = useState<Flight[]>([]);
	const [stats, setStats] = useState<Stats | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [page, setPage] = useState(1);
	const [hasMore, setHasMore] = useState(true);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [notifications, setNotifications] = useState<Notification[]>([]);

	// Debug state
	const [showDebug, setShowDebug] = useState(false);
	const [debugData, setDebugData] = useState<any>(null);
	const [debugLoading, setDebugLoading] = useState(false);

	useEffect(() => {
		fetchStats();
		fetchActiveFlights();
		fetchFlights();
		fetchNotifications();
	}, [page]);

	// Auto-refresh notifications every 10 seconds
	useEffect(() => {
		const interval = setInterval(() => {
			fetchNotifications();
		}, 10000);

		return () => clearInterval(interval);
	}, []);

	// Auto-refresh active flights every 5 seconds
	useEffect(() => {
		const interval = setInterval(() => {
			fetchActiveFlights();
		}, 5000);

		return () => clearInterval(interval);
	}, []);

	const fetchStats = async () => {
		try {
			const res = await fetch(
				`${import.meta.env.VITE_SERVER_URL}/api/logbook/stats`,
				{ credentials: 'include' }
			);
			if (res.ok) {
				const data = await res.json();
				setStats(data);
			}
		} catch (err) {
			console.error('Failed to fetch stats:', err);
		}
	};

	const fetchActiveFlights = async (manual = false) => {
		if (manual) setIsRefreshing(true);
		try {
			// Fetch both pending and active flights
			const [pendingRes, activeRes] = await Promise.all([
				fetch(
					`${import.meta.env.VITE_SERVER_URL}/api/logbook/flights?page=1&limit=10&status=pending`,
					{ credentials: 'include' }
				),
				fetch(
					`${import.meta.env.VITE_SERVER_URL}/api/logbook/flights?page=1&limit=10&status=active`,
					{ credentials: 'include' }
				)
			]);

			const pending = pendingRes.ok ? (await pendingRes.json()).flights : [];
			const active = activeRes.ok ? (await activeRes.json()).flights : [];

			// Combine and sort by created_at (newest first)
			const combined = [...active, ...pending].sort(
				(a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
			);

			setActiveFlights(combined);
		} catch (err) {
			console.error('Failed to fetch active flights:', err);
		} finally {
			if (manual) {
				setTimeout(() => setIsRefreshing(false), 500);
			}
		}
	};

	const fetchFlights = async () => {
		try {
			const res = await fetch(
				`${import.meta.env.VITE_SERVER_URL}/api/logbook/flights?page=${page}&limit=20&status=completed`,
				{ credentials: 'include' }
			);
			if (res.ok) {
				const data = await res.json();
				setFlights((prev) =>
					page === 1 ? data.flights : [...prev, ...data.flights]
				);
				setHasMore(data.hasMore);
			} else {
				setError('Failed to load flights');
			}
		} catch (err) {
			setError('Failed to load flights');
		} finally {
			setLoading(false);
		}
	};

	const fetchNotifications = async () => {
		try {
			const res = await fetch(
				`${import.meta.env.VITE_SERVER_URL}/api/logbook/notifications?unreadOnly=true`,
				{ credentials: 'include' }
			);
			if (res.ok) {
				const data = await res.json();
				setNotifications(data);
			}
		} catch (err) {
			console.error('Failed to fetch notifications:', err);
		}
	};

	const dismissNotification = async (notificationId: number) => {
		try {
			await fetch(
				`${import.meta.env.VITE_SERVER_URL}/api/logbook/notifications/${notificationId}/read`,
				{
					method: 'POST',
					credentials: 'include'
				}
			);
			setNotifications(prev => prev.filter(n => n.id !== notificationId));
		} catch (err) {
			console.error('Failed to dismiss notification:', err);
		}
	};

	const formatDuration = (minutes: number | null) => {
		if (!minutes || minutes < 1) return 'N/A';
		const hours = Math.floor(minutes / 60);
		const mins = minutes % 60;
		return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
	};

	const getLandingGrade = (score: number | null) => {
		if (!score) return {
			text: 'N/A',
			color: 'text-gray-400',
			bg: 'bg-gradient-to-br from-gray-800/50 to-gray-900/50',
			border: 'border-gray-600/50',
			glow: 'shadow-gray-500/0'
		};
		if (score >= 90) return {
			text: 'Butter',
			color: 'text-green-300',
			bg: 'bg-gradient-to-br from-green-500/30 to-emerald-600/20',
			border: 'border-green-400/60',
			glow: 'shadow-lg shadow-green-500/20'
		};
		if (score >= 70) return {
			text: 'Good',
			color: 'text-blue-300',
			bg: 'bg-gradient-to-br from-blue-500/30 to-cyan-600/20',
			border: 'border-blue-400/60',
			glow: 'shadow-lg shadow-blue-500/20'
		};
		if (score >= 50) return {
			text: 'Firm',
			color: 'text-orange-300',
			bg: 'bg-gradient-to-br from-orange-500/30 to-yellow-600/20',
			border: 'border-orange-400/60',
			glow: 'shadow-lg shadow-orange-500/20'
		};
		return {
			text: 'Hard',
			color: 'text-red-300',
			bg: 'bg-gradient-to-br from-red-500/30 to-rose-600/20',
			border: 'border-red-400/60',
			glow: 'shadow-lg shadow-red-500/20'
		};
	};

	const getStatusBadge = (flight: Flight) => {
		const status = flight.flight_status;
		const controllerStatus = flight.controller_status?.toLowerCase();
		const currentPhase = flight.current_phase?.toLowerCase();

		// Determine display text and color
		let displayText: string | JSX.Element;
		let bgColor: string;
		let borderColor: string;
		let textColor: string;

		// If flight is completed, always show "Completed" regardless of controller status
		if (status === 'completed') {
			displayText = (
				<span className="flex items-center">
					<Check className="w-3 h-3 mr-1" />
					Completed
				</span>
			);
		}
		// Use controller status if available and flight not completed
		else if (controllerStatus) {
			// Determine if at origin or destination based on flight status
			// If flight is active (has departed), taxi/runway/gate are at destination
			// If flight is pending (not departed), taxi/runway are at origin
			const isArrivalPhase = ['depa', 'departure', 'cruise', 'appr', 'approach', 'gate'].includes(controllerStatus.toLowerCase())
				|| status === 'active';

			switch (controllerStatus.toLowerCase()) {
				case 'pending':
					displayText = 'Pending';
					break;
				case 'stup':
					displayText = 'Push & Start';
					break;
				case 'push':
					displayText = 'Push & Start';
					break;
				case 'origin_taxi':
					displayText = 'Origin Taxi';
					break;
				case 'destination_taxi':
					displayText = 'Destination Taxi';
					break;
				case 'taxi':
					displayText = isArrivalPhase ? 'Destination Taxi' : 'Origin Taxi';
					break;
				case 'origin_runway':
					displayText = 'Origin Runway';
					break;
				case 'destination_runway':
					displayText = 'Destination Runway';
					break;
				case 'rwy':
				case 'runway':
					displayText = isArrivalPhase ? 'Destination Runway' : 'Origin Runway';
					break;
				case 'depa':
				case 'departure':
					displayText = 'Climbing';
					break;
				case 'cruise':
					displayText = 'Cruising';
					break;
				case 'appr':
				case 'approach':
					displayText = 'Approach';
					break;
				case 'gate':
					displayText = 'Destination Gate';
					break;
				case 'climb':
					displayText = 'Climbing';
					break;
				case 'descent':
					displayText = 'Descending';
					break;
				case 'landing':
					displayText = 'Landing';
					break;
				case 'parked':
					displayText = 'Parked';
					break;
				default:
					// Fallback: capitalize first letter
					displayText = controllerStatus.charAt(0).toUpperCase() + controllerStatus.slice(1);
			}
		}
		// Use current phase from telemetry if active and no controller status
		else if (status === 'active' && currentPhase) {
			switch (currentPhase) {
				case 'origin_taxi':
					displayText = 'Origin Taxi';
					break;
				case 'destination_taxi':
					displayText = 'Destination Taxi';
					break;
				case 'taxi':
					displayText = 'Taxiing';
					break;
				case 'takeoff':
					displayText = 'Taking Off';
					break;
				case 'climb':
					displayText = 'Climbing';
					break;
				case 'cruise':
					displayText = 'Cruising';
					break;
				case 'descent':
					displayText = 'Descending';
					break;
				case 'approach':
					displayText = 'Approach';
					break;
				case 'landing':
					displayText = 'Landing';
					break;
				case 'parked':
					displayText = 'Parked';
					break;
				case 'push':
					displayText = 'Push & Start';
					break;
				case 'origin_runway':
					displayText = 'Origin Runway';
					break;
				case 'destination_runway':
					displayText = 'Destination Runway';
					break;
				case 'runway':
				case 'rwy':
					displayText = 'On Runway';
					break;
				default:
					displayText = 'In Flight';
			}
		} else if (status === 'pending') {
			displayText = 'Pending';
		} else if (status === 'active') {
			displayText = 'In Flight';
		} else {
			displayText = status;
		}

		// Color coding based on flight_status
		switch (status) {
			case 'pending':
				bgColor = 'bg-yellow-900/30';
				borderColor = 'border-yellow-700';
				textColor = 'text-yellow-300';
				break;
			case 'active':
				bgColor = 'bg-green-900/30';
				borderColor = 'border-green-700';
				textColor = 'text-green-300';
				break;
			case 'completed':
				bgColor = 'bg-blue-900/30';
				borderColor = 'border-blue-700';
				textColor = 'text-blue-300';
				break;
			default:
				bgColor = 'bg-gray-900/30';
				borderColor = 'border-gray-700';
				textColor = 'text-gray-300';
		}

		return {
			text: displayText,
			bgColor,
			borderColor,
			textColor
		};
	};

	const handleDeleteFlight = async (e: React.MouseEvent, flightId: string) => {
		e.stopPropagation(); // Prevent navigation when clicking delete button

		if (!confirm('Are you sure you want to delete this flight?')) {
			return;
		}

		try {
			const res = await fetch(
				`${import.meta.env.VITE_SERVER_URL}/api/logbook/flights/${flightId}`,
				{
					method: 'DELETE',
					credentials: 'include'
				}
			);

			if (res.ok) {
				// Remove from both lists
				setActiveFlights(prev => prev.filter(f => f.id !== flightId));
				setFlights(prev => prev.filter(f => f.id !== flightId));
				// Refresh stats
				fetchStats();
			} else {
				const data = await res.json();
				alert(data.error || 'Failed to delete flight');
			}
		} catch (err) {
			console.error('Error deleting flight:', err);
			alert('Failed to delete flight');
		}
	};

	// Debug functions
	const loadDebugData = async (type: string) => {
		setDebugLoading(true);
		try {
			const res = await fetch(
				`${import.meta.env.VITE_SERVER_URL}/api/logbook/debug/${type}`,
				{ credentials: 'include' }
			);
			if (res.ok) {
				const data = await res.json();
				setDebugData({ type, data });
			}
		} catch (err) {
			console.error('Error loading debug data:', err);
		} finally {
			setDebugLoading(false);
		}
	};

	const resetStats = async () => {
		if (!confirm('Reset stats cache and recalculate? This cannot be undone.')) return;
		setDebugLoading(true);
		try {
			const res = await fetch(
				`${import.meta.env.VITE_SERVER_URL}/api/logbook/debug/reset-stats`,
				{
					method: 'POST',
					credentials: 'include'
				}
			);
			if (res.ok) {
				alert('Stats reset successfully!');
				fetchStats();
				window.location.reload();
			}
		} catch (err) {
			console.error('Error resetting stats:', err);
			alert('Failed to reset stats');
		} finally {
			setDebugLoading(false);
		}
	};

	const exportData = async () => {
		setDebugLoading(true);
		try {
			const res = await fetch(
				`${import.meta.env.VITE_SERVER_URL}/api/logbook/debug/export-data`,
				{
					method: 'POST',
					credentials: 'include'
				}
			);
			if (res.ok) {
				const data = await res.json();
				const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = `logbook-export-${new Date().toISOString()}.json`;
				a.click();
			}
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

	return (
		<div className="min-h-screen bg-gray-950 text-white">
			<Navbar />
			{/* Modern Hero Header */}
			<div className="relative w-full bg-gradient-to-br from-blue-900/40 via-purple-900/30 to-gray-900/40 border-b border-blue-800/30 py-6">
			
				<div className="absolute inset-0 bg-[url('/assets/app/backgrounds/mdpc_01.png')] bg-cover bg-center opacity-10"></div>
				<div className="relative container mx-auto max-w-7xl px-4 py-12 md:py-16">
					<div className="flex items-center">
						<div className="p-3 bg-blue-500/20 rounded-xl mr-4">
							<BookOpen className="h-8 w-8 text-blue-400" />
						</div>
						<div>
							<h1 className="text-4xl md:text-5xl font-bold text-white mb-1">
								Flight Logbook
							</h1>
							<p className="text-blue-300/80 text-sm md:text-base">
								Your complete flight history and statistics
							</p>
						</div>
					</div>
				</div>
			</div>
						{/* Persistent Notifications - Sticky below navbar */}
						{notifications.length > 0 && (
				<div className="sticky top-16 z-40 w-full">
					<div className="container mx-auto max-w-7xl px-4 py-4">
						<div className="space-y-3">
							{notifications.map((notification) => {
								const notificationStyles = {
									error: {
										bg: 'bg-red-900/50',
										border: 'border-red-700',
										icon: 'text-red-400',
										text: 'text-red-200'
									},
									warning: {
										bg: 'bg-yellow-900/50',
										border: 'border-yellow-700',
										icon: 'text-yellow-400',
										text: 'text-yellow-200'
									},
									info: {
										bg: 'bg-blue-900/50',
										border: 'border-blue-700',
										icon: 'text-blue-400',
										text: 'text-blue-200'
									},
									success: {
										bg: 'bg-green-900/50',
										border: 'border-green-700',
										icon: 'text-green-400',
										text: 'text-green-200'
									}
								};

								const style = notificationStyles[notification.type];

								return (
									<div
										key={notification.id}
										className={`${style.bg} border-2 ${style.border} rounded-xl p-4 flex items-start justify-between gap-4`}
									>
										<div className="flex items-start gap-3 flex-1">
											<AlertTriangle className={`h-5 w-5 ${style.icon} flex-shrink-0 mt-0.5`} />
											<div className="flex-1">
												<h3 className={`font-semibold ${style.text} mb-1`}>
													{notification.title}
												</h3>
												<p className={`text-sm ${style.text} opacity-90`}>
													{notification.message}
												</p>
											</div>
										</div>
										<button
											onClick={() => dismissNotification(notification.id)}
											className={`p-1 hover:bg-white/10 rounded-lg transition-colors ${style.icon}`}
											title="Dismiss"
										>
											<X className="h-4 w-4" />
										</button>
									</div>
								);
							})}
						</div>
					</div>
				</div>
			)}


			<div className="container mx-auto max-w-7xl px-4 py-8">
				{error && (
					<div className="mb-6 p-4 bg-red-900/30 border-2 border-red-700 rounded-xl flex items-center">
						<AlertCircle className="h-5 w-5 mr-3 text-red-400" />
						<p className="text-red-200">{error}</p>
					</div>
				)}
				

				{/* Enhanced Stats Grid */}
				{stats && (
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
						{/* Total Flights */}
						<div className="group bg-gradient-to-br from-blue-900/20 to-blue-900/5 backdrop-blur-sm rounded-xl border-2 border-blue-800/30 p-6 hover:border-blue-600/50 transition-all hover:shadow-lg hover:shadow-blue-500/10">
							<div className="flex items-center justify-between mb-3">
								<div className="p-2 bg-blue-500/20 rounded-lg">
									<Plane className="h-5 w-5 text-blue-400" />
								</div>
								<div className="text-right">
									<div className="text-2xl font-bold text-white">
										{stats.total_flights || 0}
									</div>
									<div className="text-xs text-blue-300">Total Flights</div>
								</div>
							</div>
							<div className="h-1 bg-gray-800 rounded-full overflow-hidden">
								<div className="h-full bg-gradient-to-r from-blue-600 to-blue-400 w-full"></div>
							</div>
						</div>

						{/* Total Flight Time */}
						<div className="group bg-gradient-to-br from-green-900/20 to-green-900/5 backdrop-blur-sm rounded-xl border-2 border-green-800/30 p-6 hover:border-green-600/50 transition-all hover:shadow-lg hover:shadow-green-500/10">
							<div className="flex items-center justify-between mb-3">
								<div className="p-2 bg-green-500/20 rounded-lg">
									<Clock className="h-5 w-5 text-green-400" />
								</div>
								<div className="text-right">
									<div className="text-2xl font-bold text-white">
										{formatDuration(stats.total_flight_time_minutes)}
									</div>
									<div className="text-xs text-green-300">Total Flight Time</div>
								</div>
							</div>
							<div className="h-1 bg-gray-800 rounded-full overflow-hidden">
								<div className="h-full bg-gradient-to-r from-green-600 to-green-400 w-full"></div>
							</div>
						</div>

						{/* Total Distance */}
						<div className="group bg-gradient-to-br from-purple-900/20 to-purple-900/5 backdrop-blur-sm rounded-xl border-2 border-purple-800/30 p-6 hover:border-purple-600/50 transition-all hover:shadow-lg hover:shadow-purple-500/10">
							<div className="flex items-center justify-between mb-3">
								<div className="p-2 bg-purple-500/20 rounded-lg">
									<MapPin className="h-5 w-5 text-purple-400" />
								</div>
								<div className="text-right">
									<div className="text-2xl font-bold text-white">
										{stats.total_distance_nm ? Number(stats.total_distance_nm).toLocaleString() : 0}
									</div>
									<div className="text-xs text-purple-300">Nautical Miles</div>
								</div>
							</div>
							<div className="h-1 bg-gray-800 rounded-full overflow-hidden">
								<div className="h-full bg-gradient-to-r from-purple-600 to-purple-400 w-full"></div>
							</div>
						</div>

						{/* Best Landing */}
						<div className="group bg-gradient-to-br from-yellow-900/20 to-yellow-900/5 backdrop-blur-sm rounded-xl border-2 border-yellow-800/30 p-6 hover:border-yellow-600/50 transition-all hover:shadow-lg hover:shadow-yellow-500/10">
							<div className="flex items-center justify-between mb-3">
								<div className="p-2 bg-yellow-500/20 rounded-lg">
									<Award className="h-5 w-5 text-yellow-400" />
								</div>
								<div className="text-right">
									<div className="text-2xl font-bold text-white">
									-{stats.best_landing_rate ? `${Math.abs(stats.best_landing_rate)} fpm` : '---'}
									</div>
									<div className="text-xs text-yellow-300">Best Landing</div>
								</div>
							</div>
							<div className="h-1 bg-gray-800 rounded-full overflow-hidden">
								<div
									className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400"
									style={{ width: stats.best_landing_rate ? `${Math.min(100, (600 / Math.abs(stats.best_landing_rate)) * 100)}%` : '0%' }}
								></div>
							</div>
						</div>

						{/* Favorite Aircraft */}
						<div className="group bg-gradient-to-br from-cyan-900/20 to-cyan-900/5 backdrop-blur-sm rounded-xl border-2 border-cyan-800/30 p-6 hover:border-cyan-600/50 transition-all hover:shadow-lg hover:shadow-cyan-500/10">
							<div className="flex items-center justify-between mb-3">
								<div className="p-2 bg-cyan-500/20 rounded-lg">
									<Zap className="h-5 w-5 text-cyan-400" />
								</div>
								<div className="text-right">
									<div className="text-lg font-bold text-white truncate max-w-[140px]" title={stats.favorite_aircraft || 'No data yet'}>
										{stats.favorite_aircraft || '---'}
									</div>
									<div className="text-xs text-cyan-300">Favorite Aircraft</div>
								</div>
							</div>
							<div className="h-1 bg-gray-800 rounded-full overflow-hidden">
								<div className={`h-full bg-gradient-to-r from-cyan-600 to-cyan-400 ${stats.favorite_aircraft ? 'w-full' : 'w-0'}`}></div>
							</div>
						</div>

						{/* Favorite Departure */}
						<div className="group bg-gradient-to-br from-orange-900/20 to-orange-900/5 backdrop-blur-sm rounded-xl border-2 border-orange-800/30 p-6 hover:border-orange-600/50 transition-all hover:shadow-lg hover:shadow-orange-500/10">
							<div className="flex items-center justify-between mb-3">
								<div className="p-2 bg-orange-500/20 rounded-lg">
									<TrendingUp className="h-5 w-5 text-orange-400" />
								</div>
								<div className="text-right">
									<div className="text-2xl font-bold text-white" title={stats.favorite_departure || 'No data yet'}>
										{stats.favorite_departure || '---'}
									</div>
									<div className="text-xs text-orange-300">Favorite Departure</div>
								</div>
							</div>
							<div className="h-1 bg-gray-800 rounded-full overflow-hidden">
								<div className={`h-full bg-gradient-to-r from-orange-600 to-orange-400 ${stats.favorite_departure ? 'w-full' : 'w-0'}`}></div>
							</div>
						</div>
					</div>
				)}

				{/* Active/Pending Flights - Redesigned */}
				{activeFlights.length > 0 && (
					<div className="mb-8">
						<div className="flex items-center justify-between mb-4">
							<div className="flex items-center gap-3">
								<div className="relative">
									<Plane className="h-6 w-6 text-green-400" />
									<div className="absolute -top-1 -right-1 h-2.5 w-2.5 bg-red-500 rounded-full animate-pulse"></div>
								</div>
								<h2 className="text-2xl font-bold text-white">
									Live Flights
								</h2>
								<span className="px-3 py-1 bg-green-900/30 border-2 border-green-700 rounded-full text-sm font-semibold text-green-300">
									{activeFlights.length} Active
								</span>
							</div>
							<button
								onClick={(e) => {
									e.stopPropagation();
									fetchActiveFlights(true);
								}}
								className="p-2.5 hover:bg-green-800/20 rounded-xl transition-colors group border-2 border-transparent hover:border-green-700/50"
								title="Refresh live flights"
							>
								<RefreshCw className={`h-5 w-5 text-green-400 transition-transform ${isRefreshing ? 'animate-spin' : 'group-hover:rotate-180'}`} />
							</button>
						</div>

						<div className="grid grid-cols-1 gap-4">
							{activeFlights.map((flight) => {
								const statusBadge = getStatusBadge(flight);
								const landingGrade = getLandingGrade(flight.landing_score);
								return (
									<div
										key={flight.id}
										onClick={() => navigate(`/logbook/${flight.id}`)}
										className="group relative bg-gradient-to-r from-green-900/10 via-blue-900/5 to-purple-900/10 hover:from-green-900/20 hover:via-blue-900/15 hover:to-purple-900/20 backdrop-blur-sm rounded-xl border-2 border-green-800/30 hover:border-green-600/50 p-6 cursor-pointer transition-all hover:shadow-lg hover:shadow-green-500/10"
									>
										{/* Live indicator animation */}
										{flight.flight_status === 'active' && (
											<div className="absolute top-0 right-0 m-6">
												<div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 border-2 border-green-500/50 rounded-full">
													<div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
													<span className="text-xs font-semibold text-green-300">LIVE</span>
												</div>
											</div>
										)}

										<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
											<div className="flex-1">
												<div className="flex items-center gap-3 mb-3">
													<h3 className="text-2xl font-bold text-white">
														{flight.callsign}
													</h3>
													<span
														className={`px-3 py-1 rounded-lg text-xs font-semibold ${statusBadge.bgColor} ${statusBadge.borderColor} ${statusBadge.textColor} border`}
													>
														{statusBadge.text}
													</span>
												</div>

												<div className="flex items-center gap-4 mb-2">
													<div className="flex items-center text-lg">
														<span className="font-semibold text-blue-300">
															{flight.departure_icao}
														</span>
														<div className="mx-3 flex items-center gap-1">
															<div className="w-2 h-2 bg-blue-400 rounded-full"></div>
															<div className="w-8 h-px bg-blue-400"></div>
															<Plane className="h-4 w-4 text-blue-400 -rotate-45" />
															<div className="w-8 h-px bg-blue-400"></div>
															<div className="w-2 h-2 bg-blue-400 rounded-full"></div>
														</div>
														<span className="font-semibold text-blue-300">
															{flight.arrival_icao}
														</span>
													</div>
												</div>

												<div className="flex items-center gap-4 text-sm text-gray-400">
													<span className="flex items-center gap-1.5">
														<Plane className="h-3.5 w-3.5" />
														{flight.aircraft_model || flight.aircraft_icao}
													</span>
													<span className="flex items-center gap-1.5">
														<Calendar className="h-3.5 w-3.5" />
														{new Date(flight.created_at).toLocaleTimeString([], {
															hour: '2-digit',
															minute: '2-digit'
														})} UTC
													</span>
												</div>
											</div>

											<div className="flex items-center gap-4">
												{flight.flight_status === 'pending' && (
													<button
														onClick={(e) => handleDeleteFlight(e, flight.id)}
														className="p-2.5 hover:bg-red-900/30 rounded-lg transition-colors group/delete border-2 border-transparent hover:border-red-700/50"
														title="Delete flight"
													>
														<Trash2 className="h-4 w-4 text-gray-500 group-hover/delete:text-red-400" />
													</button>
												)}
												<ChevronRight className="h-6 w-6 text-gray-600 group-hover:text-green-400 transition-colors" />
											</div>
										</div>
									</div>
								);
							})}
						</div>
					</div>
				)}

				{/* Recent Flights - Redesigned */}
				<div>
					<div className="flex items-center gap-3 mb-4">
						<BookOpen className="h-6 w-6 text-blue-400" />
						<h2 className="text-2xl font-bold text-white">
							Flight History
						</h2>
					</div>

					{flights.length === 0 ? (
						<div className="bg-gray-900/30 backdrop-blur-sm rounded-xl border-2 border-gray-800 p-16 text-center">
							<div className="p-4 bg-gray-800/50 rounded-full w-fit mx-auto mb-4">
								<Plane className="h-12 w-12 text-gray-600" />
							</div>
							<h3 className="text-xl font-semibold text-gray-300 mb-2">
								No flights logged yet
							</h3>
							<p className="text-gray-500 max-w-md mx-auto">
								Submit a flight plan with the logbook checkbox enabled to start tracking your flights
							</p>
						</div>
					) : (
						<div className="grid grid-cols-1 gap-3">
							{flights.map((flight) => {
								const landingGrade = getLandingGrade(flight.landing_score);
								return (
									<div
										key={flight.id}
										onClick={() => navigate(`/logbook/${flight.id}`)}
										className="group bg-gray-900/30 hover:bg-gray-900/50 backdrop-blur-sm rounded-xl border-2 border-gray-800 hover:border-gray-700 p-5 cursor-pointer transition-all"
									>
										<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
											<div className="flex-1">
												<div className="flex items-center gap-3 mb-2">
													<h3 className="text-xl font-bold text-white">
														{flight.callsign}
													</h3>
													<span className="text-sm text-gray-400">
														{flight.aircraft_model || flight.aircraft_icao}
													</span>
												</div>

												<div className="flex items-center gap-4 mb-2">
													<div className="flex items-center text-sm">
														<span className="font-semibold text-gray-300">
															{flight.departure_icao}
														</span>
														<ChevronRight className="h-4 w-4 mx-2 text-gray-600" />
														<span className="font-semibold text-gray-300">
															{flight.arrival_icao}
														</span>
													</div>
												</div>

												<div className="flex items-center gap-4 text-xs text-gray-500">
													<span className="flex items-center gap-1.5">
														<Calendar className="h-3 w-3" />
														{new Date(flight.created_at).toLocaleDateString()}
													</span>
													{flight.duration_minutes && (
														<span className="flex items-center gap-1.5">
															<Clock className="h-3 w-3" />
															{formatDuration(flight.duration_minutes)}
														</span>
													)}
													{flight.total_distance_nm && (
														<span className="flex items-center gap-1.5">
															<Ruler className="h-3 w-3" />
															{Number(flight.total_distance_nm).toFixed(0)} NM
														</span>
													)}
												</div>
											</div>

											<div className="flex items-center gap-4">
												{flight.landing_score !== null && (
													<div className={`px-5 py-3 ${landingGrade.bg} ${landingGrade.glow} rounded-xl border-2 ${landingGrade.border} backdrop-blur-sm transition-all hover:scale-105`}>
														<div className={`text-xl font-bold ${landingGrade.color} tracking-tight`}>
															{landingGrade.text}
														</div>
														<div className="text-xs text-gray-300 text-center font-semibold mt-1">
															{flight.landing_rate_fpm} fpm
														</div>
													</div>
												)}
												<ChevronRight className="h-5 w-5 text-gray-600 group-hover:text-blue-400 transition-colors" />
											</div>
										</div>
									</div>
								);
							})}

							{hasMore && (
								<button
									onClick={() => setPage((p) => p + 1)}
									className="w-full py-4 bg-blue-600/20 hover:bg-blue-600/30 border-2 border-blue-700/50 hover:border-blue-600 rounded-xl text-blue-300 hover:text-blue-200 font-semibold transition-all"
								>
									Load More Flights
								</button>
							)}
						</div>
					)}
				</div>

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
									Admin Debug Tools
								</h2>

								{/* Action Buttons */}
								<div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
									<button
										onClick={() => loadDebugData('raw-stats')}
										disabled={debugLoading}
										className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-900/30 border-2 border-blue-700 rounded-lg text-blue-300 hover:bg-blue-900/50 transition-colors disabled:opacity-50"
									>
										<Database className="h-4 w-4" />
										View Raw Stats
									</button>

									<button
										onClick={() => loadDebugData('raw-flights')}
										disabled={debugLoading}
										className="flex items-center justify-center gap-2 px-4 py-3 bg-purple-900/30 border-2 border-purple-700 rounded-lg text-purple-300 hover:bg-purple-900/50 transition-colors disabled:opacity-50"
									>
										<Plane className="h-4 w-4" />
										View All Flights
									</button>

									<button
										onClick={() => loadDebugData('active-tracking')}
										disabled={debugLoading}
										className="flex items-center justify-center gap-2 px-4 py-3 bg-green-900/30 border-2 border-green-700 rounded-lg text-green-300 hover:bg-green-900/50 transition-colors disabled:opacity-50"
									>
										<RefreshCw className="h-4 w-4" />
										Active Tracking
									</button>

									<button
										onClick={() => loadDebugData('database-info')}
										disabled={debugLoading}
										className="flex items-center justify-center gap-2 px-4 py-3 bg-cyan-900/30 border-2 border-cyan-700 rounded-lg text-cyan-300 hover:bg-cyan-900/50 transition-colors disabled:opacity-50"
									>
										<Database className="h-4 w-4" />
										Database Info
									</button>

									<button
										onClick={resetStats}
										disabled={debugLoading}
										className="flex items-center justify-center gap-2 px-4 py-3 bg-yellow-900/30 border-2 border-yellow-700 rounded-lg text-yellow-300 hover:bg-yellow-900/50 transition-colors disabled:opacity-50"
									>
										<RotateCw className="h-4 w-4" />
										Reset Stats Cache
									</button>

									<button
										onClick={exportData}
										disabled={debugLoading}
										className="flex items-center justify-center gap-2 px-4 py-3 bg-pink-900/30 border-2 border-pink-700 rounded-lg text-pink-300 hover:bg-pink-900/50 transition-colors disabled:opacity-50"
									>
										<Download className="h-4 w-4" />
										Export Data
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

								{/* Quick Stats Info */}
								<div className="mt-6 p-4 bg-gray-800/50 rounded-lg border-2 border-gray-700">
									<h3 className="text-sm font-semibold text-gray-400 mb-2">Quick Info</h3>
									<div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
										<div>
											<p className="text-gray-500">User ID</p>
											<p className="text-gray-300 font-mono">{user.userId}</p>
										</div>
										<div>
											<p className="text-gray-500">Total Flights</p>
											<p className="text-gray-300 font-mono">{stats?.total_flights || 0}</p>
										</div>
										<div>
											<p className="text-gray-500">Active Flights</p>
											<p className="text-gray-300 font-mono">{activeFlights.length}</p>
										</div>
										<div>
											<p className="text-gray-500">Page</p>
											<p className="text-gray-300 font-mono">{page}</p>
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
