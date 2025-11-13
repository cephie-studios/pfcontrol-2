import React, { useState, useRef, useCallback, useEffect } from 'react';
import { X, GripHorizontal } from 'lucide-react';
import type { Flight } from '../../types/flight';

interface RouteModalProps {
  isOpen: boolean;
  onClose: () => void;
  flight: Flight | null;
  onFlightChange?: (
    flightId: string | number,
    updates: Partial<Flight>
  ) => void;
}

export default function RouteModal({
  isOpen,
  onClose,
  flight,
  onFlightChange,
}: RouteModalProps) {
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const modalRef = useRef<HTMLDivElement>(null);
  const [editedRoute, setEditedRoute] = useState(flight?.route || '');

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

  useEffect(() => {
    if (flight?.route !== undefined) {
      setEditedRoute(flight.route || '');
    }
  }, [flight?.route]);

  // Autosave with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (flight && onFlightChange) {
        onFlightChange(flight.id, { route: editedRoute });
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [editedRoute, flight, onFlightChange]);

  if (!isOpen || !flight) return null;

  return (
    <>
      {/* Modal */}
      <div
        ref={modalRef}
        className="fixed z-60 bg-zinc-900 border-2 border-blue-600 rounded-xl min-w-96 w-md"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          cursor: 'default',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-4 py-3 border-b border-zinc-700 bg-zinc-800 rounded-t-lg cursor-pointer"
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
        <div className="p-5">
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-green-500">
                  Departure
                </label>
                <div className="text-white font-mono text-lg">
                  {flight.departure || '-'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-red-500">
                  Arrival
                </label>
                <div className="text-white font-mono text-lg">
                  {flight.arrival || '-'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-500">
                  SID
                </label>
                <div className="text-white font-mono text-lg">
                  {flight.sid || '-'}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Route
              </label>
              <textarea
                value={editedRoute}
                onChange={(e) => setEditedRoute(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-600 rounded-lg p-4 text-white font-mono text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                placeholder="Enter route..."
                rows={4}
              />
            </div>

            {flight.alternate && (
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1">
                  Alternate
                </label>
                <div className="text-white font-mono">{flight.alternate}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
