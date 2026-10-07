import { describe, expect, it } from 'vite-plus/test';
import { findPath, type NavPoint } from '../../../server/utils/findRoute.js';

describe('findPath', () => {
  it('returns failure when start airport is missing', () => {
    const points: NavPoint[] = [
      { name: 'END', x: 100, y: 100, type: 'AIRPORT' },
    ];

    const result = findPath('START', 'END', points);

    expect(result.success).toBe(false);
    expect(result.path).toEqual([]);
  });

  it('finds a path when intermediate waypoints exist', () => {
    const points: NavPoint[] = [
      { name: 'A', x: 0, y: 0, type: 'AIRPORT' },
      { name: 'W1', x: 20, y: 0, type: 'WAYPOINT' },
      { name: 'W2', x: 40, y: 0, type: 'WAYPOINT' },
      { name: 'B', x: 60, y: 0, type: 'AIRPORT' },
    ];

    const result = findPath('A', 'B', points);

    expect(result.success).toBe(true);
    expect(result.path.length).toBeGreaterThanOrEqual(2);
    expect(result.distance).toBeGreaterThan(0);
  });
});
