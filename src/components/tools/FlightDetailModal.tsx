import React, { useState, useRef, useCallback, useEffect } from 'react';
import { X, GripHorizontal, RefreshCw } from 'lucide-react';
import type { Flight } from '../../types/flight';
import TextInput from '../common/TextInput';
import AirportDropdown from '../dropdowns/AirportDropdown';
import AircraftDropdown from '../dropdowns/AircraftDropdown';
import SidDropdown from '../dropdowns/SidDropdown';
import StarDropdown from '../dropdowns/StarDropdown';
import AltitudeDropdown from '../dropdowns/AltitudeDropdown';
import StatusDropdown from '../dropdowns/StatusDropdown';
import Checkbox from '../common/Checkbox';

interface FlightDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  flight: Flight | null;
  onFlightChange?: (
    flightId: string | number,
    field: string,
    value: string,
    originalValue: string
  ) => void;
}

export default function FlightDetailsModal({
  isOpen,
  onClose,
  flight,
  onFlightChange,
}: FlightDetailsModalProps) {
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const modalRef = useRef<HTMLDivElement>(null);

  const generateRandomSquawk = useCallback((): string => {
    let squawk = '';
    for (let i = 0; i < 4; i++) {
      squawk += Math.floor(Math.random() * 6) + 1;
    }
    return squawk;
  }, []);

  const handleRegenerateSquawk = useCallback(() => {
    if (flight && onFlightChange) {
      const newSquawk = generateRandomSquawk();
      onFlightChange(flight.id, 'squawk', newSquawk, flight.squawk || '');
    }
  }, [flight, onFlightChange, generateRandomSquawk]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!modalRef.current) return;

    const rect = modalRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;

      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;

      setPosition({
        x: newX,
        y: Math.max(70, newY),
      });
    },
    [isDragging, dragOffset]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.body.style.userSelect = 'auto';
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  if (!isOpen || !flight) return null;

  return (
    <>
      {/* Modal */}
      <div
        ref={modalRef}
        className="fixed z-60 bg-zinc-900 border-2 border-blue-600 rounded-xl min-w-[32rem] w-[40rem] max-h-[90vh] overflow-y-auto"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          cursor: 'default',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-4 py-3 border-b border-zinc-700 bg-zinc-800 rounded-t-lg cursor-pointer sticky top-0 z-10"
          onMouseDown={handleMouseDown}
        >
          <div className="flex items-center gap-2">
            <GripHorizontal className="w-5 h-5 text-zinc-400" />
            <h2 className="text-lg font-bold text-white">
              {flight.callsign || 'Unknown'} - {flight.aircraft || 'N/A'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-6">
          {/* Flight Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Callsign
              </label>
              <TextInput
                value={flight.callsign || ''}
                onChange={(value) =>
                  onFlightChange?.(
                    flight.id,
                    'callsign',
                    value,
                    flight.callsign || ''
                  )
                }
                className="bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-white w-full"
                maxLength={16}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Aircraft
              </label>
              <AircraftDropdown
                value={flight.aircraft || ''}
                onChange={(value) =>
                  onFlightChange?.(
                    flight.id,
                    'aircraft',
                    value,
                    flight.aircraft || ''
                  )
                }
                size="sm"
                showFullName={false}
              />
            </div>
          </div>

          {/* Squawk & Status */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Squawk
              </label>
              <div className="flex items-center gap-2 bg-zinc-800 px-3 py-2 rounded">
                <TextInput
                  value={flight.squawk || ''}
                  onChange={(value) =>
                    onFlightChange?.(
                      flight.id,
                      'squawk',
                      value,
                      flight.squawk || ''
                    )
                  }
                  className="bg-transparent border-none focus:bg-gray-800 px-1 rounded text-white w-full"
                  maxLength={4}
                  pattern="[0-9]*"
                />
                <button
                  onClick={handleRegenerateSquawk}
                  className="text-zinc-400 hover:text-blue-500 transition-colors flex-shrink-0"
                  title="Generate new squawk"
                  type="button"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Status
              </label>
              <StatusDropdown
                value={flight.status || ''}
                onChange={(value) =>
                  onFlightChange?.(
                    flight.id,
                    'status',
                    value,
                    flight.status || ''
                  )
                }
                size="sm"
                controllerType="event"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Cleared
              </label>
              <div className="p-2 flex items-center justify-center">
                <Checkbox
                  checked={
                    flight.clearance === 'true' || flight.clearance === true
                  }
                  onChange={(checked) =>
                    onFlightChange?.(
                      flight.id,
                      'clearance',
                      String(checked),
                      String(flight.clearance || false)
                    )
                  }
                  label={
                    flight.clearance === 'true' || flight.clearance === true
                      ? 'YES'
                      : 'NO'
                  }
                  checkedClass="bg-green-600 border-green-600"
                />
              </div>
            </div>
          </div>

          {/* Route Section */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Airports
            </label>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-green-500 mb-1">
                  Departure
                </label>
                <div className="text-white font-mono text-lg font-bold">
                  {flight.departure || '-'}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-blue-500 mb-1">
                  SID
                </label>
                <SidDropdown
                  airportIcao={flight.departure || ''}
                  value={flight.sid || ''}
                  onChange={(value) =>
                    onFlightChange?.(flight.id, 'sid', value, flight.sid || '')
                  }
                  size="sm"
                  placeholder="-"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-purple-500 mb-1">
                  STAR
                </label>
                <StarDropdown
                  airportIcao={flight.arrival || ''}
                  value={flight.star || ''}
                  onChange={(value) =>
                    onFlightChange?.(
                      flight.id,
                      'star',
                      value,
                      flight.star || ''
                    )
                  }
                  size="sm"
                  placeholder="-"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-red-500 mb-1">
                  Arrival
                </label>
                <AirportDropdown
                  value={flight.arrival || ''}
                  onChange={(value) =>
                    onFlightChange?.(
                      flight.id,
                      'arrival',
                      value,
                      flight.arrival || ''
                    )
                  }
                  size="sm"
                  showFullName={false}
                />
              </div>
            </div>
          </div>

          {/* Route */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Route
            </label>
            <textarea
              value={flight.route || ''}
              onChange={(e) =>
                onFlightChange?.(
                  flight.id,
                  'route',
                  e.target.value,
                  flight.route || ''
                )
              }
              className="w-full bg-zinc-800 border border-zinc-600 rounded-lg p-4 text-white font-mono text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              placeholder="Enter route..."
              rows={4}
            />
          </div>

          {/* PDC Section */}
          {flight.pdc_remarks && (
            <div className="border-t border-zinc-700 pt-4">
              <label className="block text-sm font-medium text-amber-500 mb-2">
                Issued PDC
              </label>
              <div className="bg-zinc-800 border border-amber-600/30 rounded-lg p-4">
                <pre className="text-amber-100 font-mono text-xs whitespace-pre-wrap">
                  {flight.pdc_remarks}
                </pre>
              </div>
            </div>
          )}

          {/* Alternate */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">
              Alternate
            </label>
            <AirportDropdown
              value={flight.alternate || ''}
              onChange={(value) =>
                onFlightChange?.(
                  flight.id,
                  'alternate',
                  value,
                  flight.alternate || ''
                )
              }
              size="sm"
              showFullName={false}
            />
          </div>

          {/* Additional Info */}
          <div className="grid grid-cols-3 gap-4 border-t border-zinc-700 pt-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                RFL
              </label>
              <AltitudeDropdown
                value={flight.cruisingFL || ''}
                onChange={(value) =>
                  onFlightChange?.(
                    flight.id,
                    'cruisingFL',
                    value,
                    flight.cruisingFL || ''
                  )
                }
                size="sm"
                placeholder="-"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Cleared FL
              </label>
              <AltitudeDropdown
                value={flight.clearedFL || ''}
                onChange={(value) =>
                  onFlightChange?.(
                    flight.id,
                    'clearedFL',
                    value,
                    flight.clearedFL || ''
                  )
                }
                size="sm"
                placeholder="-"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Remarks
              </label>
              <TextInput
                value={flight.remark || ''}
                onChange={(value) =>
                  onFlightChange?.(
                    flight.id,
                    'remark',
                    value,
                    flight.remark || ''
                  )
                }
                className="bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-white w-full"
                maxLength={500}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
