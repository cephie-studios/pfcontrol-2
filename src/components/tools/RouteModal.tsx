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
  const [editedRoute, setEditedRoute] = useState(flight?.route || '');
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (flight?.route !== undefined) {
      setEditedRoute(flight.route || '');
    }
  }, [flight?.route]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (flight && onFlightChange) {
        onFlightChange(flight.id, { route: editedRoute });
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [editedRoute, flight, onFlightChange]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!modalRef.current) return;
      setIsDragging(true);
      setDragStart({
        x: e.clientX - translate.x,
        y: e.clientY - translate.y,
      });
    },
    [translate]
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      setTranslate({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart]);

  if (!isOpen || !flight) return null;

  return (
    <div
      ref={modalRef}
      className="fixed bg-zinc-900 border-2 border-blue-600 rounded-lg min-w-96 w-md p-6 pb-0 z-60 animate-fade-in"
      style={{
        left: 100,
        top: 100,
        transform: `translate(${translate.x}px, ${translate.y}px)`,
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center">
          <div className="p-2 bg-blue-900/30 text-blue-400 rounded-full mr-3">
            <GripHorizontal className="h-5 w-5" />
          </div>
          <h3 className="text-xl font-semibold">
            {flight.callsign || 'Unknown'} - {flight.aircraft || 'N/A'}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-full hover:bg-gray-700"
        >
          <X className="h-5 w-5 text-gray-400" />
        </button>
      </div>

      {/* Content */}
      <div className="mb-6">
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
              className="w-full bg-zinc-800 border border-zinc-600 rounded-lg p-4 text-white font-mono text-sm leading-relaxed overflow-y-auto resize-none focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              placeholder="Enter route..."
              rows={6}
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
  );
}
