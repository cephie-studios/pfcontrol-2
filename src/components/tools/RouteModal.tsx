import React, { useState, useRef, useCallback, useEffect } from "react";
import { X, GripHorizontal, Wand2, Loader2, Check } from "lucide-react";
import type { Flight } from "../../types/flight";
import RouteMap from "../map/RouteMap";
import { fetchRoute } from "../../utils/fetch/data";

interface RouteModalProps {
  isOpen: boolean;
  onClose: () => void;
  flight: Flight | null;
  activeRunway?: string | null;
  onFlightChange?: (
    flightId: string | number,
    updates: Partial<Flight>
  ) => void;
}

/**
 * Given a route string and the departure/arrival ICAOs, attempt to extract
 * the SID (first token after departure) and STAR (last token before arrival).
 * Returns undefined for each if the route is too short to infer them.
 */
function parseSidStar(
  route: string,
  departure?: string,
  arrival?: string
): { sid?: string; star?: string } {
  const tokens = route.trim().split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return {};

  let start = 0;
  let end = tokens.length - 1;

  if (departure && tokens[0].toUpperCase() === departure.toUpperCase())
    start = 1;
  if (arrival && tokens[end].toUpperCase() === arrival.toUpperCase()) end -= 1;

  const relevant = tokens.slice(start, end + 1);
  if (relevant.length === 0) return {};

  const looksLikeProcedure = (s: string) => /^[A-Z]{2,5}\d[A-Z]?$/i.test(s);

  const sid =
    relevant.length > 0 && looksLikeProcedure(relevant[0])
      ? relevant[0].toUpperCase()
      : undefined;
  const last = relevant[relevant.length - 1];
  const star =
    relevant.length > 1 &&
    looksLikeProcedure(last) &&
    last.toUpperCase() !== sid
      ? last.toUpperCase()
      : undefined;

  return { sid, star };
}

export default function RouteModal({
  isOpen,
  onClose,
  flight,
  activeRunway,
  onFlightChange,
}: RouteModalProps) {
  const [editedRoute, setEditedRoute] = useState(flight?.route || "");
  const [displaySid, setDisplaySid] = useState<string | undefined>(flight?.sid);
  const [displayStar, setDisplayStar] = useState<string | undefined>(
    flight?.star
  );
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [mapRoute, setMapRoute] = useState(flight?.route || "");
  const modalRef = useRef<HTMLDivElement>(null);
  const mapDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setEditedRoute(flight?.route || "");
    setMapRoute(flight?.route || "");
    setDisplaySid(flight?.sid);
    setDisplayStar(flight?.star);
    setGenerateError(null);
  }, [flight?.id, flight?.route, flight?.sid, flight?.star]);

  const isDirty =
    editedRoute !== (flight?.route || "") ||
    (displaySid || "") !== (flight?.sid || "") ||
    (displayStar || "") !== (flight?.star || "");

  const handleAmend = () => {
    if (!flight || !onFlightChange) return;
    onFlightChange(flight.id, {
      route: editedRoute,
      sid: displaySid,
      star: displayStar,
    });
  };

  const handleRouteChange = (value: string) => {
    setEditedRoute(value);

    const { sid, star } = parseSidStar(
      value,
      flight?.departure,
      flight?.arrival
    );
    setDisplaySid(sid);
    setDisplayStar(star);

    if (mapDebounceRef.current) clearTimeout(mapDebounceRef.current);
    mapDebounceRef.current = setTimeout(() => setMapRoute(value), 600);
  };

  const handleGripMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
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
    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragStart]);

  const handleGenerate = async () => {
    if (!flight?.departure || !flight?.arrival) return;
    setGenerating(true);
    setGenerateError(null);
    try {
      const result = await fetchRoute(
        flight.departure,
        flight.arrival,
        activeRunway ?? undefined
      );
      if (result.success && result.route) {
        setEditedRoute(result.route);
        setMapRoute(result.route);
        setDisplaySid(result.sid);
        setDisplayStar(result.star);
      } else {
        setGenerateError("Failed to generate route");
      }
    } catch {
      setGenerateError("Failed to generate route");
    } finally {
      setGenerating(false);
    }
  };

  if (!isOpen || !flight) return null;

  const showMap = mapRoute.trim().length > 0;

  return (
    <div
      ref={modalRef}
      className="fixed bg-zinc-900 border-2 border-blue-600 rounded-xl z-60 animate-fade-in select-none"
      style={{
        left: 100,
        top: 100,
        width: 560,
        transform: `translate(${translate.x}px, ${translate.y}px)`,
      }}
    >
      {/* Header — only this area is draggable */}
      <div
        className="flex justify-between items-center px-5 pt-4 pb-3 border-b border-zinc-700"
        style={{ cursor: isDragging ? "grabbing" : "grab" }}
        onMouseDown={handleGripMouseDown}
      >
        <div className="flex items-center gap-3">
          <GripHorizontal className="h-5 w-5 text-zinc-400" />
          <h3 className="text-lg font-semibold text-white">
            {flight.callsign || "Unknown"} &mdash; {flight.aircraft || "N/A"}
          </h3>
        </div>
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={onClose}
          className="p-1 rounded-full hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Body — not draggable, text is selectable */}
      <div className="px-5 pt-4 pb-5 select-text">
        {/* Dep / Arr / SID / STAR */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div>
            <div className="text-xs font-medium text-green-400 mb-0.5">
              Departure
            </div>
            <div className="text-white font-mono text-sm">
              {flight.departure || "—"}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-red-400 mb-0.5">
              Arrival
            </div>
            <div className="text-white font-mono text-sm">
              {flight.arrival || "—"}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-blue-400 mb-0.5">SID</div>
            <div className="text-white font-mono text-sm">
              {displaySid || "—"}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-purple-400 mb-0.5">
              STAR
            </div>
            <div className="text-white font-mono text-sm">
              {displayStar || "—"}
            </div>
          </div>
        </div>

        {/* Route label + buttons */}
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-zinc-300">Route</label>
          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerate}
              disabled={generating || !flight.departure || !flight.arrival}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full bg-zinc-700 hover:bg-zinc-600 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {generating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Wand2 className="w-3.5 h-3.5" />
              )}
              {generating ? "Generating…" : "Generate"}
            </button>
            <button
              onClick={handleAmend}
              disabled={!isDirty || !onFlightChange}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Check className="w-3.5 h-3.5" />
              Amend
            </button>
          </div>
        </div>
        {generateError && (
          <div className="text-xs text-red-400 mb-2">{generateError}</div>
        )}

        <textarea
          value={editedRoute}
          onChange={(e) => handleRouteChange(e.target.value)}
          className="w-full bg-zinc-800 border border-zinc-600 rounded-lg p-3 text-white font-mono text-sm leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
          placeholder="Enter route…"
          rows={4}
        />

        {/* Route Map preview */}
        {showMap && (
          <div
            className="mt-3 rounded-lg overflow-hidden border border-zinc-700"
            style={{ height: 220 }}
          >
            <RouteMap
              route={mapRoute}
              departure={flight.departure}
              arrival={flight.arrival}
              sid={displaySid}
              star={displayStar}
              className="w-full h-full"
            />
          </div>
        )}

        {/* Alternate */}
        {flight.alternate && (
          <div className="mt-3">
            <div className="text-xs font-medium text-zinc-400 mb-0.5">
              Alternate
            </div>
            <div className="text-white font-mono text-sm">
              {flight.alternate}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
