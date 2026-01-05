import { getWaypointData } from "./getData";

interface NavPoint {
  name: string;
  x: number;
  y: number;
  type: 'AIRPORT' | 'WAYPOINT' | 'VOR-DME' | 'NDB';
}

interface Node {
  point: NavPoint;
  cost: number;
  parent: Node | null;
}

function getDist(p1: NavPoint, p2: NavPoint): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function sameSpot(p1: NavPoint, p2: NavPoint): boolean {
  return p1.x === p2.x && p1.y === p2.y;
}

function getNearby(
  current: NavPoint,
  goal: NavPoint,
  allPoints: NavPoint[],
  maxDist: number,
  minDist: number = 8
): NavPoint[] {
  const nearby: NavPoint[] = [];

  for (const p of allPoints) {
    if (p.name === current.name) continue;

    if (p.type === 'AIRPORT' && p.name !== goal.name) continue;

    if (p.name !== goal.name) {
      const atAirport = allPoints.some(
        airport => airport.type === 'AIRPORT' && sameSpot(p, airport)
      );
      if (atAirport) continue;
    }

    const dist = getDist(current, p);
    if (dist >= minDist && dist <= maxDist) {
      nearby.push(p);
    }
  }

  return nearby;
}

function buildPath(node: Node): NavPoint[] {
  const path: NavPoint[] = [];
  let current: Node | null = node;

  while (current) {
    path.unshift(current.point);
    current = current.parent;
  }

  return path.filter((p, i) => {
    const isStartOrEnd = i === 0 || i === path.length - 1;
    return isStartOrEnd || p.type !== 'AIRPORT';
  });
}

function getRealisticCost(
  from: NavPoint,
  to: NavPoint,
  parent: Node | null,
  turnPenalty: number = 2
): number {
  const directDist = getDist(from, to);

  // If we have a previous direction, penalize sharp turns
  if (parent && parent.parent) {
    const prevPoint = parent.parent.point;
    const currentPoint = parent.point;

    const dx1 = currentPoint.x - prevPoint.x;
    const dy1 = currentPoint.y - prevPoint.y;
    const dx2 = to.x - currentPoint.x;
    const dy2 = to.y - currentPoint.y;

    const dot = dx1 * dx2 + dy1 * dy2;
    const mag1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    const mag2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

    if (mag1 > 0 && mag2 > 0) {
      const cosAngle = dot / (mag1 * mag2);
      const turnCost = (1 - cosAngle) * turnPenalty;
      return directDist + turnCost;
    }
  }

  return directDist;
}

function findPath(
  startName: string,
  endName: string,
  allPoints: NavPoint[],
  maxDist: number = 25,
  minDist: number = 8,
  turnPenalty: number = 2
) {
  const start = allPoints.find(p => p.name === startName && p.type === 'AIRPORT');
  const end = allPoints.find(p => p.name === endName && p.type === 'AIRPORT');

  if (!start || !end) {
    return { path: [], distance: 0, success: false };
  }

  const toCheck: Node[] = [{ point: start, cost: 0, parent: null }];
  const checked = new Set<string>();

  while (toCheck.length > 0) {
    toCheck.sort((a, b) => {
      const aCost = a.cost + getDist(a.point, end);
      const bCost = b.cost + getDist(b.point, end);
      return aCost - bCost;
    });

    const current = toCheck.shift()!;

    if (current.point.name === end.name) {
      const path = buildPath(current);

      const waypointCount = path.filter(p => p.type !== 'AIRPORT').length;
      if (waypointCount < 2) {
        continue;
      }

      let totalDist = 0;
      for (let i = 0; i < path.length - 1; i++) {
        totalDist += getDist(path[i], path[i + 1]);
      }
      return { path, distance: totalDist, success: true };
    }

    checked.add(current.point.name);

    const neighbors = getNearby(current.point, end, allPoints, maxDist, minDist);

    for (const neighbor of neighbors) {
      if (checked.has(neighbor.name)) continue;

      const newCost = current.cost + getRealisticCost(
        current.point,
        neighbor,
        current.parent,
        turnPenalty
      );

      const existing = toCheck.find(n => n.point.name === neighbor.name);

      if (!existing) {
        toCheck.push({
          point: neighbor,
          cost: newCost,
          parent: current
        });
      } else if (newCost < existing.cost) {
        existing.cost = newCost;
        existing.parent = current;
      }
    }
  }

  return { path: [], distance: 0, success: false };
}

export { findPath, type NavPoint };