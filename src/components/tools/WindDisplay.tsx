import React, { useState, useEffect } from 'react';
import {
	Wind,
	AlertTriangle,
	Loader2,
	Gauge,
	RefreshCw,
	Plane
} from 'lucide-react';
import { fetchMetar } from '../../utils/fetch/metar';
import type { MetarData } from '../../types/metar';

interface WindDisplayProps {
	icao: string | null;
	forceHide?: boolean;
}

const WindDisplay: React.FC<WindDisplayProps> = ({
	icao,
	forceHide = false
}) => {
	const [metarData, setMetarData] = useState<MetarData | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [showAltimeter, setShowAltimeter] = useState(false);
	const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

	useEffect(() => {
		const handleResize = () => {
			setIsMobile(window.innerWidth < 768);
		};

		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	}, []);

	const loadMetarData = React.useCallback(async () => {
		if (!icao) return;

		setIsLoading(true);
		setError(null);

		try {
			const data = await fetchMetar(icao);
			if (data) {
				setMetarData(data);
			} else {
				setError('No METAR data available');
			}
		} catch (err) {
			setError('Failed to load METAR data');
			console.error('Error loading METAR data:', err);
		} finally {
			setIsLoading(false);
		}
	}, [icao]);

	useEffect(() => {
		if (!icao || forceHide) {
			setMetarData(null);
			setError(null);
			return;
		}

		loadMetarData();
	}, [icao, forceHide, loadMetarData]);

	const handleManualRefresh = () => {
		loadMetarData();
	};

	const togglePressureFormat = () => {
		setShowAltimeter(!showAltimeter);
	};

	const getWindSeverityColor = (windSpeed: number, gust?: number) => {
		const effectiveWind = gust || windSpeed;

		if (effectiveWind >= 35) {
			return {
				icon: 'text-red-500',
				text: 'text-red-400',
				bg: 'bg-red-300/10'
			};
		}
		if (effectiveWind >= 20) {
			return {
				icon: 'text-yellow-400',
				text: 'text-yellow-300',
				bg: 'bg-yellow-300/10'
			};
		}
		if (effectiveWind >= 10) {
			return {
				icon: 'text-blue-400',
				text: 'text-blue-300',
				bg: 'bg-blue-300/10'
			};
		}
		return {
			icon: 'text-green-400',
			text: 'text-green-300',
			bg: 'bg-green-300/10'
		};
	};

	const formatPressure = (altimeterHpa: number) => {
		if (showAltimeter) {
			const inHgValue = altimeterHpa / 33.8639;
			return {
				value: `A${inHgValue.toFixed(2)}`,
				unit: '',
				label: 'Altimeter'
			};
		} else {
			return {
				value: altimeterHpa.toString(),
				unit: ' hPa',
				label: 'QNH'
			};
		}
	};

	const formatReportTime = (reportTime: string) => {
		const date = new Date(reportTime);
		const now = new Date();
		const diffMinutes = Math.floor(
			(now.getTime() - date.getTime()) / (1000 * 60)
		);

		if (diffMinutes < 60) {
			return `${diffMinutes}m ago`;
		} else if (diffMinutes < 1440) {
			const hours = Math.floor(diffMinutes / 60);
			return `${hours}h ago`;
		} else {
			return date.toLocaleTimeString([], {
				hour: '2-digit',
				minute: '2-digit'
			});
		}
	};

	const getFlightCategoryColor = (category: string) => {
		switch (category) {
			case 'VFR':
				return 'text-green-400';
			case 'MVFR':
				return 'text-yellow-400';
			case 'IFR':
				return 'text-orange-400';
			case 'LIFR':
				return 'text-red-400';
			default:
				return 'text-gray-400';
		}
	};

	if (forceHide) {
		return null;
	}

	if (!icao) {
		return (
			<div className="flex items-center text-sm text-gray-400 gap-2 px-3 py-2 bg-gray-800 rounded border border-gray-700">
				<Plane className="h-4 w-4" />
				<span>No airport selected</span>
			</div>
		);
	}

	if (isLoading) {
		return (
			<div className="flex items-center text-sm text-gray-400 gap-2 px-3 py-2 bg-gray-800 rounded border border-gray-700">
				<Loader2 className="h-4 w-4 animate-spin" />
				<span>Loading METAR data...</span>
			</div>
		);
	}

	if (error || !metarData) {
		return (
			<div className="flex items-center justify-between text-sm px-3 py-2 bg-gray-800 rounded border border-gray-700">
				<div className="flex items-center gap-2 text-red-400">
					<AlertTriangle className="h-4 w-4" />
					<span>{error || 'No data available'}</span>
				</div>
				<button
					onClick={handleManualRefresh}
					className="text-blue-400 hover:text-blue-300 transition-colors"
					title="Retry"
				>
					<RefreshCw className="h-4 w-4" />
				</button>
			</div>
		);
	}

	const windDirection = metarData.wdir;
	const windSpeed = metarData.wspd;
	const windGust = metarData.wgst;
	const formattedDirection = windDirection.toString().padStart(3, '0') + '°';
	const gustInfo = windGust ? `G${windGust}` : '';
	const windColors = getWindSeverityColor(windSpeed, windGust);
	const pressureDisplay = formatPressure(metarData.altim);

	if (isMobile) {
		return (
			<div
				className={`flex flex-col rounded border border-gray-700 px-3 py-2 ${windColors.bg} bg-gray-800`}
			>
				<div className="flex items-center justify-between gap-2">
					<div className="flex items-center gap-2">
						<Wind className={`h-4 w-4 ${windColors.icon}`} />
						<span
							className={`font-mono text-sm font-semibold ${windColors.text}`}
						>
							{formattedDirection} {windSpeed}
							{gustInfo}kt
						</span>
					</div>
					<span
						className={`text-xs font-medium ${getFlightCategoryColor(
							metarData.fltCat
						)}`}
					>
						{metarData.fltCat}
					</span>
				</div>

				<div className="flex items-center justify-between mt-1.5 text-xs">
					<div className="flex items-center gap-3">
						<button
							onClick={togglePressureFormat}
							className={`font-mono transition-colors ${
								showAltimeter
									? 'text-blue-400 hover:text-blue-300'
									: 'text-green-400 hover:text-green-300'
							}`}
							title={`Toggle to ${
								showAltimeter ? 'QNH' : 'altimeter'
							}`}
						>
							{pressureDisplay.value}
							{pressureDisplay.unit}
						</button>
					</div>
					<div className="flex items-center gap-2">
						<span className="text-gray-400">
							{formatReportTime(metarData.reportTime)}
						</span>
						<button
							onClick={handleManualRefresh}
							className="text-blue-400 hover:text-blue-300 transition-colors"
							title="Refresh"
						>
							<RefreshCw className="h-3 w-3" />
						</button>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div
			className={`flex flex-col rounded border border-gray-700 px-4 py-2.5 ${windColors.bg} bg-gray-800`}
		>
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-4">
					<div className="flex items-center gap-2">
						<Wind className={`h-5 w-5 ${windColors.icon}`} />
						<span
							className={`font-mono text-lg font-bold ${windColors.text}`}
						>
							{formattedDirection} {windSpeed}
							{gustInfo}kt
						</span>
					</div>

					<div className="flex items-center gap-3 text-sm">
						<span className="text-gray-300">
							Temp: {metarData.temp}°C
						</span>
						<span className="text-gray-300">
							Vis: {metarData.visib}
						</span>
					</div>
				</div>

				<div className="flex items-center gap-3">
					<button
						onClick={togglePressureFormat}
						className="flex items-center gap-1.5 transition-colors"
						title={`Click to toggle to ${
							showAltimeter ? 'QNH' : 'altimeter setting'
						}`}
					>
						<Gauge
							className={`h-4 w-4 ${
								showAltimeter
									? 'text-blue-400'
									: 'text-green-400'
							}`}
						/>
						<span
							className={`font-mono font-semibold ${
								showAltimeter
									? 'text-blue-400 hover:text-blue-300'
									: 'text-green-400 hover:text-green-300'
							}`}
						>
							{pressureDisplay.value}
							{pressureDisplay.unit}
						</span>
					</button>

					<span
						className={`text-sm font-bold px-2 py-1 rounded ${getFlightCategoryColor(
							metarData.fltCat
						)}`}
					>
						{metarData.fltCat}
					</span>
				</div>
			</div>

			<div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-700">
				<div className="flex items-center gap-4 text-xs text-gray-400">
					<span>{metarData.name}</span>
					<span>
						Updated: {formatReportTime(metarData.reportTime)}
					</span>
				</div>

				<button
					onClick={handleManualRefresh}
					className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
					title="Refresh METAR data"
				>
					<RefreshCw className="h-3 w-3" />
					Refresh
				</button>
			</div>
		</div>
	);
};

export default WindDisplay;
