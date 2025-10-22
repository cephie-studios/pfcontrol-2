import React, { useState, useEffect } from 'react';
import {
  Wind,
  AlertTriangle,
  Loader2,
  Gauge,
  RefreshCw,
  Plane,
  Clock,
} from 'lucide-react';
import { fetchMetar } from '../../utils/fetch/metar';
import type { MetarData } from '../../types/metar';

interface WindDisplayProps {
  icao: string | null;
  forceHide?: boolean;
  size?: 'normal' | 'small';
}

const WindDisplay: React.FC<WindDisplayProps> = ({
  icao,
  forceHide = false,
  size = 'normal',
}) => {
  const [metarData, setMetarData] = useState<MetarData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAltimeter, setShowAltimeter] = useState(false);

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

    const interval = setInterval(
      () => {
        loadMetarData();
      },
      5 * 60 * 1000
    );

    return () => clearInterval(interval);
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
      };
    }
    if (effectiveWind >= 20) {
      return {
        icon: 'text-yellow-400',
        text: 'text-yellow-300',
      };
    }
    if (effectiveWind >= 10) {
      return {
        icon: 'text-blue-400',
        text: 'text-blue-300',
      };
    }
    return {
      icon: 'text-green-400',
      text: 'text-green-300',
    };
  };

  const formatPressure = (altimeterHpa: number) => {
    if (!altimeterHpa) {
      return {
        value: 'N/A',
        unit: '',
        label: '',
      };
    }

    if (showAltimeter) {
      const inHgValue = altimeterHpa / 33.8639;
      return {
        value: `A${inHgValue.toFixed(2)}`,
        unit: '',
        label: 'Altimeter',
      };
    } else {
      return {
        value: altimeterHpa.toString(),
        unit: ' hPa',
        label: 'QNH',
      };
    }
  };

  const formatReportTime = (reportTime: string) => {
    if (!reportTime) return 'Unknown time';

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
    } else if (diffMinutes == 0) {
      return 'Just now';
    } else {
      return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
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
      <div
        className={`flex items-center text-sm text-gray-400 gap-2 px-3 py-2 bg-gray-800 rounded border border-gray-700 ${
          size === 'small' ? 'text-xs px-2 py-1' : ''
        }`}
      >
        <Plane className={size === 'small' ? 'h-3 w-3' : 'h-4 w-4'} />
        <span>No airport selected</span>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        className={`flex items-center text-sm text-gray-400 gap-2 px-3 py-2 bg-gray-800 rounded border border-gray-700 ${
          size === 'small' ? 'text-xs px-2 py-1' : ''
        }`}
      >
        <Loader2 className={size === 'small' ? 'h-3 w-3' : 'h-4 w-4'} />
        <span>Loading METAR data...</span>
      </div>
    );
  }

  if (error || !metarData) {
    return (
      <div
        className={`flex items-center justify-between text-sm px-3 py-2 bg-gray-800 rounded border border-gray-700 ${
          size === 'small' ? 'text-xs px-2 py-1' : ''
        }`}
      >
        <div className="flex items-center gap-2 text-red-400">
          <AlertTriangle className={size === 'small' ? 'h-3 w-3' : 'h-4 w-4'} />
          <span>{error || 'No data available'}</span>
        </div>
        <button
          onClick={handleManualRefresh}
          className="text-blue-400 hover:text-blue-300 transition-colors ml-2"
          title="Retry"
        >
          <RefreshCw className={size === 'small' ? 'h-3 w-3' : 'h-4 w-4'} />
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

  if (size === 'small') {
    return (
      <div
        id="wind-display"
        className="flex flex-col rounded border border-gray-700 px-2 py-1 bg-gray-800"
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <Wind className={`h-4 w-4 ${windColors.icon}`} />
            <span className={`font-mono font-semibold ${windColors.text}`}>
              {formattedDirection} {windSpeed}
              {gustInfo} kt
            </span>
          </div>

          <div className="h-5 border-l border-gray-700 mx-2" />

          <button
            onClick={togglePressureFormat}
            className={`flex items-center gap-1 font-mono transition-colors ${
              showAltimeter
                ? 'text-blue-400 hover:text-blue-300'
                : 'text-green-400 hover:text-green-300'
            }`}
            title={`Toggle to ${showAltimeter ? 'QNH' : 'altimeter'}`}
          >
            <Gauge
              className={`h-4 w-4 ${
                showAltimeter ? 'text-blue-400' : 'text-green-400'
              }`}
            />
            <span>
              {pressureDisplay.value}
              {pressureDisplay.unit}
            </span>
          </button>
        </div>
        <div className="flex items-center gap-2 mt-1 text-gray-400 text-sm">
          <Clock className="h-4 w-4" />
          <span>{formatReportTime(metarData.reportTime)}</span>
          <button
            onClick={handleManualRefresh}
            className="text-blue-400 hover:text-blue-300 transition-colors ml-2"
            title="Refresh"
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      id="wind-display"
      className="flex flex-col rounded border border-gray-700 px-4 py-2.5 bg-gray-900"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Wind className={`h-5 w-5 ${windColors.icon}`} />
            <span className={`font-mono text-lg font-bold ${windColors.text}`}>
              {formattedDirection} {windSpeed}
              {gustInfo}kt
            </span>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-300">Temp: {metarData.temp}°C</span>
            <span className="text-gray-300">Vis: {metarData.visib}</span>
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
                showAltimeter ? 'text-blue-400' : 'text-green-400'
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
          <span>Updated: {formatReportTime(metarData.reportTime)}</span>
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
