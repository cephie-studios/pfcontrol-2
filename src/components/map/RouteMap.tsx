import DeckGL from '@deck.gl/react';
import { OrthographicView, COORDINATE_SYSTEM } from '@deck.gl/core';
import { LineLayer, TextLayer, PolygonLayer } from '@deck.gl/layers';
import { clamp } from '@math.gl/core';
import { useEffect, useMemo, useRef, useState } from 'react';

interface Waypoint {
  name: string;
  x: number;
  y: number;
  type: string;
}

interface AirportEntry {
  icao: string;
  sidWaypoints?: Record<string, string[]>;
  starWaypoints?: Record<string, string[]>;
}

type ViewState = {
  target: [number, number, number];
  zoom: number;
  minZoom: number;
  maxZoom: number;
  zoomX?: number;
  zoomY?: number;
};

type LineSegment = { source: Waypoint; target: Waypoint };

type IslandFeature = { polygon: number[][][] };

export interface RouteMapProps {
  route?: string;
  departure?: string;
  arrival?: string;
  sid?: string;
  star?: string;
  className?: string;
}

const DEFAULT_VIEW_STATE = {
  target: [120, 67.5, 0] as [number, number, number],
  zoom: 1,
  minZoom: -1,
  maxZoom: 20,
};

const MAP_BOUNDS = { minX: -50, maxX: 270, minY: -20, maxY: 185 };

function computeViewState(
  points: Waypoint[],
  containerW: number,
  containerH: number
) {
  if (points.length === 0) return DEFAULT_VIEW_STATE;

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const spanX = maxX - minX || 10;
  const spanY = maxY - minY || 10;
  // Fit whichever axis is the limiting dimension, with 15% padding
  const zoomX = Math.log2((containerW * 0.85) / spanX);
  const zoomY = Math.log2((containerH * 0.85) / spanY);

  return {
    target: [centerX, centerY, 0] as [number, number, number],
    zoom: clamp(Math.min(zoomX, zoomY), 1, 12),
    minZoom: -1,
    maxZoom: 20,
  };
}

/**
 * Expand a space-separated route string into resolved Waypoint objects,
 * replacing SID/STAR procedure names with their waypoint sequences.
 */
function buildFullRoute(
  routeStr: string,
  waypoints: Waypoint[],
  departure: string | undefined,
  arrival: string | undefined,
  sidName: string | undefined,
  starName: string | undefined,
  depAirport: AirportEntry | undefined,
  arrAirport: AirportEntry | undefined
): Waypoint[] {
  const find = (name: string) => waypoints.find((w) => w.name === name);

  const sidWps: string[] = sidName
    ? (depAirport?.sidWaypoints?.[sidName] ?? [])
    : [];
  const starWps: string[] = starName
    ? (arrAirport?.starWaypoints?.[starName] ?? [])
    : [];

  // Parse the raw route tokens, skip procedure names (they'll be replaced by sequences)
  const tokens = routeStr.trim().split(/\s+/);
  const midTokens = tokens.filter(
    (t) => t !== departure && t !== arrival && t !== sidName && t !== starName
  );

  // Build ordered name list: dep → SID waypoints → mid route → STAR waypoints → arr
  const names: string[] = [];
  if (departure) names.push(departure);
  names.push(...sidWps);
  names.push(...midTokens);
  names.push(...starWps);
  if (arrival) names.push(arrival);

  // Deduplicate consecutive duplicates (e.g. SID exit fix appearing in mid route too)
  const deduped: string[] = [];
  for (const n of names) {
    if (deduped[deduped.length - 1] !== n) deduped.push(n);
  }

  return deduped.flatMap((name) => {
    const wp = find(name);
    return wp ? [wp] : [];
  });
}

export default function RouteMap({
  route,
  departure,
  arrival,
  sid,
  star,
  className,
}: RouteMapProps) {
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [airports, setAirports] = useState<AirportEntry[]>([]);
  const [islands, setIslands] = useState<IslandFeature[]>([]);
  const [viewState, setViewState] = useState<ViewState>(DEFAULT_VIEW_STATE);
  const [containerSize, setContainerSize] = useState({ w: 600, h: 400 });
  const containerRef = useRef<HTMLDivElement>(null);
  const lastFittedKeyRef = useRef('');

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setContainerSize({ w: width, h: height });
    });
    ro.observe(el);
    const onWheel = (e: WheelEvent) => e.preventDefault();
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      ro.disconnect();
      el.removeEventListener('wheel', onWheel);
    };
  }, []);

  const apiBase = import.meta.env.VITE_SERVER_URL || '';

  useEffect(() => {
    fetch(`${apiBase}/api/data/waypoints`)
      .then((r) => r.json())
      .then(setWaypoints)
      .catch(console.error);
  }, [apiBase]);

  useEffect(() => {
    fetch(`${apiBase}/api/data/airports`)
      .then((r) => r.json())
      .then(setAirports)
      .catch(console.error);
  }, [apiBase]);

  useEffect(() => {
    fetch(`${apiBase}/api/data/islands`)
      .then((r) => r.json())
      .then(setIslands)
      .catch(console.error);
  }, [apiBase]);

  // Parse departure/arrival from the route string itself (first/last AIRPORT token)
  const routeTokens = (route ?? '').trim().split(/\s+/).filter(Boolean);
  const firstToken = routeTokens[0];
  const lastToken = routeTokens[routeTokens.length - 1];
  const firstWp = waypoints.find((w) => w.name === firstToken);
  const lastWp = waypoints.find((w) => w.name === lastToken);
  const effectiveDep =
    (firstWp?.type === 'AIRPORT' ? firstToken : undefined) ?? departure;
  const effectiveArr =
    (lastWp?.type === 'AIRPORT' ? lastToken : undefined) ?? arrival;

  const depAirport = airports.find((a) => a.icao === effectiveDep);
  const arrAirport = airports.find((a) => a.icao === effectiveArr);

  // Auto-detect SID/STAR from route tokens when not provided as props
  const effectiveSid =
    sid ??
    routeTokens.find(
      (t) => depAirport?.sidWaypoints && t in depAirport.sidWaypoints
    );
  const effectiveStar =
    star ??
    routeTokens.find(
      (t) => arrAirport?.starWaypoints && t in arrAirport.starWaypoints
    );

  const resolved = useMemo(
    () =>
      waypoints.length > 0
        ? buildFullRoute(
            route ?? '',
            waypoints,
            effectiveDep,
            effectiveArr,
            effectiveSid,
            effectiveStar,
            depAirport,
            arrAirport
          )
        : [],
    [
      route,
      waypoints,
      effectiveDep,
      effectiveArr,
      effectiveSid,
      effectiveStar,
      depAirport,
      arrAirport,
    ]
  );

  // Re-fit the view whenever the route identity changes or waypoints first load
  useEffect(() => {
    if (resolved.length === 0) return;
    const key = `${route ?? ''}|${sid ?? ''}|${star ?? ''}|${departure ?? ''}|${arrival ?? ''}`;
    if (key === lastFittedKeyRef.current) return;
    lastFittedKeyRef.current = key;
    setViewState(computeViewState(resolved, containerSize.w, containerSize.h));
  }, [resolved, route, sid, star, departure, arrival, containerSize]);

  const islandLayer = new PolygonLayer<IslandFeature>({
    id: 'island',
    data: islands,
    coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
    getPolygon: (d) => d.polygon,
    getFillColor: [24, 24, 27], // zinc-900 — matches modal backgrounds
    getLineColor: [37, 99, 235], // blue-600 — matches border-blue-600
    getLineWidth: 0.1,
    filled: true,
    stroked: true,
    pickable: false,
  });

  // SID/STAR waypoint sets — use effective (auto-detected) values, must be declared before lineSegments
  const sidWpNames = new Set(
    effectiveSid ? (depAirport?.sidWaypoints?.[effectiveSid] ?? []) : []
  );
  const starWpNames = new Set(
    effectiveStar ? (arrAirport?.starWaypoints?.[effectiveStar] ?? []) : []
  );

  const lineSegments = resolved
    .slice(0, -1)
    .map((_, i) => ({
      source: resolved[i],
      target: resolved[i + 1],
    }))
    .filter((seg) => {
      // Don't draw airport → first SID fix (implied radar vectors off runway)
      if (seg.source.type === 'AIRPORT' && sidWpNames.has(seg.target.name))
        return false;
      // Don't draw last STAR fix → airport (implied radar vectors to runway)
      if (starWpNames.has(seg.source.name) && seg.target.type === 'AIRPORT')
        return false;
      return true;
    });

  const aptWaypoints = resolved.filter((w) => w.type === 'AIRPORT');
  const navPoints = resolved.filter((w) => w.type !== 'AIRPORT');

  const sidLineColor = (
    srcName: string,
    tgtName: string
  ): [number, number, number] => {
    if (sidWpNames.has(srcName) && sidWpNames.has(tgtName))
      return [234, 179, 8]; // yellow — both in SID
    if (starWpNames.has(srcName) && starWpNames.has(tgtName))
      return [168, 85, 247]; // purple — both in STAR
    return [59, 130, 246]; // blue — en-route
  };

  const routeLine = new LineLayer<LineSegment>({
    id: 'route-line',
    data: lineSegments,
    coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
    getSourcePosition: (d) => [d.source.x, d.source.y],
    getTargetPosition: (d) => [d.target.x, d.target.y],
    getColor: (d) => sidLineColor(d.source.name, d.target.name),
    getWidth: 2,
    pickable: false,
    updateTriggers: {
      getSourcePosition: resolved,
      getTargetPosition: resolved,
      getColor: [sid, star],
    },
  });

  const WHITE: [number, number, number] = [255, 255, 255];
  const fontFamily = '"Arial Unicode MS", "Segoe UI Symbol", Arial, sans-serif';

  const airportLayer = new TextLayer<Waypoint>({
    id: 'airport-x',
    data: aptWaypoints,
    coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
    getPosition: (d) => [d.x, d.y],
    getText: () => '✕',
    getSize: 16,
    getColor: WHITE,
    getTextAnchor: 'middle',
    getAlignmentBaseline: 'center',
    fontFamily,
    characterSet: ['✕'],
    pickable: false,
  });

  const navSymbolLayer = new TextLayer<Waypoint>({
    id: 'nav-symbol',
    data: navPoints,
    coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
    getPosition: (d) => [d.x, d.y],
    getText: () => '⬡',
    getSize: 18,
    getColor: WHITE,
    getTextAnchor: 'middle',
    getAlignmentBaseline: 'center',
    fontFamily,
    characterSet: ['⬡'],
    pickable: false,
  });

  const labelLayer = new TextLayer<Waypoint>({
    id: 'waypoint-labels',
    data: resolved,
    coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
    getPosition: (d) => [d.x, d.y],
    getPixelOffset: [0, 12],
    getText: (d) => d.name,
    getSize: 11,
    getColor: WHITE,
    getTextAnchor: 'middle',
    getAlignmentBaseline: 'top',
    fontFamily,
    pickable: false,
  });

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        background: '#101012',
      }}
    >
      <DeckGL
        views={new OrthographicView({ id: 'ortho' })}
        viewState={viewState}
        onViewStateChange={({ viewState: vs }) => setViewState(vs as ViewState)}
        controller={{
          doubleClickZoom: true,
          inertia: true,
          maxBounds: [
            [MAP_BOUNDS.minX, MAP_BOUNDS.minY],
            [MAP_BOUNDS.maxX, MAP_BOUNDS.maxY],
          ],
        }}
        layers={[
          islandLayer,
          routeLine,
          airportLayer,
          navSymbolLayer,
          labelLayer,
        ]}
      />
    </div>
  );
}
