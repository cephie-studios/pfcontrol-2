import {
  Bell,
  Boxes,
  Database,
  Plane,
  Radar,
  ScrollText,
  Star,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import type {
  DeveloperApiDocEndpoint,
  DeveloperApiDocWebsocket,
} from '../../../types/developerApiSpec';

const GROUP_LABELS: Record<string, string> = {
  self: 'Account',
  data: 'Data',
  sessions: 'Sessions',
  flights: 'Flights',
  ratings: 'Ratings',
  notifications: 'Notifications',
  flight_logs: 'Flight logs',
};

const GROUP_ICONS: Record<string, LucideIcon> = {
  self: UserRound,
  data: Database,
  sessions: Radar,
  flights: Plane,
  ratings: Star,
  notifications: Bell,
  flight_logs: ScrollText,
};

const GROUP_ORDER = [
  'self',
  'data',
  'sessions',
  'flights',
  'ratings',
  'notifications',
  'flight_logs',
];

export interface EndpointGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  items: DeveloperApiDocEndpoint[];
}

function groupIdFor(scopeId: string): string {
  return scopeId.split('.')[0] ?? 'other';
}

function groupLabelFor(groupId: string): string {
  return (
    GROUP_LABELS[groupId] ??
    groupId.charAt(0).toUpperCase() + groupId.slice(1).replace(/_/g, ' ')
  );
}

export function groupEndpoints(
  endpoints: DeveloperApiDocEndpoint[]
): EndpointGroup[] {
  const m = new Map<string, DeveloperApiDocEndpoint[]>();
  for (const e of endpoints) {
    const g = groupIdFor(e.scopeId);
    const arr = m.get(g) ?? [];
    arr.push(e);
    m.set(g, arr);
  }
  const ids = [...m.keys()].sort((a, b) => {
    const ia = GROUP_ORDER.indexOf(a);
    const ib = GROUP_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
  return ids.map((id) => ({
    id,
    label: groupLabelFor(id),
    icon: GROUP_ICONS[id] ?? Boxes,
    items: m.get(id)!,
  }));
}

function slugify(path: string): string {
  return path
    .replace(/[{}]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function endpointAnchorId(e: DeveloperApiDocEndpoint): string {
  return `ep-${e.method.toLowerCase()}-${slugify(e.pathTemplate)}`;
}

export function websocketAnchorId(ws: DeveloperApiDocWebsocket): string {
  return `ws-${slugify(ws.path)}`;
}

export function endpointMatchesQuery(
  e: DeveloperApiDocEndpoint,
  q: string
): boolean {
  if (!q) return true;
  const n = q.toLowerCase();
  const chunks: string[] = [
    e.method,
    e.pathTemplate,
    e.scopeId,
    e.endpointKey,
    e.title,
    e.summary,
    e.fullUrlExample,
    e.responseSummary,
    e.responseContentType,
    e.requestBodySummary ?? '',
    e.requestBodyExampleJson ?? '',
  ];
  for (const p of e.pathParams ?? []) {
    chunks.push(p.name, p.description, p.example ?? '');
  }
  for (const qe of e.queryParams ?? []) {
    chunks.push(qe.name, qe.description, qe.example ?? '');
  }
  for (const h of e.requestHeaders) {
    chunks.push(h.name, h.description);
  }
  return chunks.some((c) => c.toLowerCase().includes(n));
}

export function methodTextClass(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET':
      return 'text-blue-400';
    case 'POST':
      return 'text-emerald-400';
    case 'PUT':
    case 'PATCH':
      return 'text-amber-400';
    case 'DELETE':
      return 'text-red-400';
    case 'WS':
      return 'text-purple-400';
    default:
      return 'text-muted-foreground';
  }
}
