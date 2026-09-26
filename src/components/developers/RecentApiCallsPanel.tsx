import { Fragment, useCallback, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDashed,
  CornerUpRight,
  Eye,
  EyeOff,
  History,
  Inbox,
  Plug,
  SearchX,
  Unplug,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import SettingsSection from '../Settings/SettingsSection';
import SettingsGroup from '../Settings/SettingsGroup';
import SettingsRow from '../Settings/SettingsRow';
import AdminSearchInput from '../admin/AdminSearchInput';
import AdminStatusBadge from '../admin/AdminStatusBadge';
import AdminTable from '../admin/AdminTable';
import { AdminLoading } from '../admin/AdminStates';
import {
  ADMIN_TONE_TEXT,
  httpStatusTone,
  type AdminTone,
} from '../admin/adminConstants';
import { Button } from '@/components/ui/button';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface RecentApiCall {
  id: string;
  keyId: string;
  scopeId: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  createdAt: string;
  clientIp?: string | null;
  requestBody?: string | null;
  responseBody?: string | null;
}

type CallsTab = 'all' | 'errors';

const HTTP_TONE_ICON: Record<AdminTone, LucideIcon> = {
  success: CheckCircle2,
  info: CornerUpRight,
  warning: AlertTriangle,
  danger: XCircle,
  purple: CircleDashed,
  orange: AlertTriangle,
  neutral: CircleDashed,
};

function formatMaskedIp(ip: string): string {
  if (ip.includes('.') && !ip.includes(':')) {
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.*.*`;
    }
  }
  if (ip.includes(':')) {
    const first = ip.split(':').find((s) => s.length > 0);
    return first ? `${first}:****` : '****';
  }
  return '••••••••';
}

function prettyBody(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function CallStatus({ call }: { call: RecentApiCall }) {
  if (call.method === 'WS' && call.statusCode === 101) {
    return (
      <AdminStatusBadge tone="purple" icon={Plug} showLabel>
        Open
      </AdminStatusBadge>
    );
  }
  if (call.method === 'WS' && call.statusCode === 0) {
    return (
      <AdminStatusBadge tone="neutral" icon={Unplug} showLabel>
        Close
      </AdminStatusBadge>
    );
  }
  const tone = httpStatusTone(call.statusCode);
  return (
    <AdminStatusBadge
      tone={tone}
      icon={HTTP_TONE_ICON[tone]}
      showLabel
      className="tabular-nums"
    >
      {call.statusCode}
    </AdminStatusBadge>
  );
}

function BodyBlock({ title, body }: { title: string; body: string | null }) {
  return (
    <div className="grid content-start gap-2">
      <h3 className="text-sm font-medium">{title}</h3>
      {body ? (
        <pre className="max-h-80 overflow-auto rounded-xl bg-muted/50 p-4 font-mono text-xs break-all whitespace-pre-wrap">
          {body}
        </pre>
      ) : (
        <p className="text-sm text-muted-foreground">No body</p>
      )}
    </div>
  );
}

export default function RecentApiCallsPanel({
  recent,
  recentErrors,
  loading = false,
  scopeLabelMap,
  keyLabelMap,
}: {
  recent: RecentApiCall[];
  recentErrors: RecentApiCall[];
  loading?: boolean;
  scopeLabelMap: Map<string, string>;
  keyLabelMap: Map<string, string>;
}) {
  const [tab, setTab] = useState<CallsTab>('all');
  const [search, setSearch] = useState('');
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleIn = useCallback(
    (setter: typeof setRevealed, id: string) =>
      setter((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    []
  );

  const activeList = tab === 'errors' ? recentErrors : recent;
  const query = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!query) return activeList;
    return activeList.filter((r) => {
      const hay = [
        r.method,
        r.path,
        r.scopeId,
        scopeLabelMap.get(r.scopeId) ?? r.scopeId,
        keyLabelMap.get(r.keyId) ?? r.keyId,
        String(r.statusCode),
        String(r.durationMs),
        r.clientIp ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(query);
    });
  }, [activeList, query, scopeLabelMap, keyLabelMap]);

  const errorCount = recentErrors.length;

  return (
    <TooltipProvider>
      <SettingsSection
        title="Latest API calls"
        icon={History}
        actions={
          <>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={tab}
              onValueChange={(v) => {
                if (v) setTab(v as CallsTab);
              }}
              aria-label="Call list filter"
            >
              <ToggleGroupItem value="all" className="px-3">
                Latest calls
              </ToggleGroupItem>
              <ToggleGroupItem value="errors" className="gap-1.5 px-3">
                Latest errors
                {errorCount > 0 ? (
                  <span className="text-muted-foreground tabular-nums">
                    {errorCount}
                  </span>
                ) : null}
              </ToggleGroupItem>
            </ToggleGroup>
            <AdminSearchInput
              value={search}
              onChange={setSearch}
              grow={false}
              placeholder="Filter calls…"
              aria-label="Filter latest API calls by path, method, scope, key, status or IP"
            />
          </>
        }
      >
        {loading && activeList.length === 0 ? (
          <SettingsGroup>
            <AdminLoading label="Loading calls…" />
          </SettingsGroup>
        ) : activeList.length === 0 ? (
          <SettingsGroup>
            <SettingsRow
              icon={<Inbox className="text-muted-foreground" />}
              label={
                tab === 'errors' ? 'No errors on record' : 'No calls logged'
              }
            />
          </SettingsGroup>
        ) : filtered.length === 0 ? (
          <SettingsGroup>
            <SettingsRow
              icon={<SearchX className="text-muted-foreground" />}
              label="No calls match your search"
            >
              <Button variant="outline" size="sm" onClick={() => setSearch('')}>
                Clear filter
              </Button>
            </SettingsRow>
          </SettingsGroup>
        ) : (
          <AdminTable minWidth="760px">
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <span className="sr-only">Expand</span>
                </TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Request</TableHead>
                <TableHead>Key</TableHead>
                <TableHead className="text-right">Duration</TableHead>
                <TableHead className="text-right">Client IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const isOpen = expanded.has(r.id);
                const isRevealed = revealed.has(r.id);
                const ip = r.clientIp ?? null;
                const keyLabel = keyLabelMap.get(r.keyId) ?? 'Deleted key';
                const scopeLabel = scopeLabelMap.get(r.scopeId) ?? r.scopeId;
                const toggleExpand = () => toggleIn(setExpanded, r.id);
                const toggleIp = () => toggleIn(setRevealed, r.id);
                const ipText = ip ? (isRevealed ? ip : formatMaskedIp(ip)) : '';

                return (
                  <Fragment key={r.id}>
                    <TableRow
                      className="cursor-pointer"
                      data-state={isOpen ? 'selected' : undefined}
                      onClick={toggleExpand}
                    >
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-expanded={isOpen}
                          aria-label={isOpen ? 'Collapse call' : 'Expand call'}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand();
                          }}
                        >
                          {isOpen ? <ChevronDown /> : <ChevronRight />}
                        </Button>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
                        <time dateTime={r.createdAt}>
                          {new Date(r.createdAt).toLocaleString(undefined, {
                            month: 'numeric',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </time>
                      </TableCell>
                      <TableCell>
                        <CallStatus call={r} />
                      </TableCell>
                      <TableCell className="max-w-[320px]">
                        <p className="truncate font-mono text-xs">
                          <span
                            className={
                              r.method === 'WS'
                                ? ADMIN_TONE_TEXT.purple
                                : 'text-muted-foreground'
                            }
                          >
                            {r.method}
                          </span>{' '}
                          {r.path}
                        </p>
                      </TableCell>
                      <TableCell className="max-w-[160px] truncate text-sm">
                        {keyLabel}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground tabular-nums">
                        {r.durationMs}ms
                      </TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {!ip ? (
                          <span className="text-xs text-muted-foreground">
                            N/A
                          </span>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <span
                              className={cn(
                                'max-w-28 truncate font-mono text-xs text-muted-foreground',
                                !isRevealed && 'blur-sm select-none'
                              )}
                              title={isRevealed ? ip : undefined}
                            >
                              {ipText}
                            </span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={
                                    isRevealed
                                      ? 'Hide IP address'
                                      : 'Show IP address'
                                  }
                                  onClick={toggleIp}
                                >
                                  {isRevealed ? <EyeOff /> : <Eye />}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {isRevealed ? 'Hide IP' : 'Show IP'}
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                    {isOpen ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={7} className="whitespace-normal">
                          <div className="flex flex-col gap-5 py-2">
                            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3">
                              <div className="grid gap-1">
                                <dt className="text-xs text-muted-foreground">
                                  Key
                                </dt>
                                <dd className="text-sm">{keyLabel}</dd>
                              </div>
                              <div className="grid gap-1">
                                <dt className="text-xs text-muted-foreground">
                                  Scope
                                </dt>
                                <dd className="text-sm">{scopeLabel}</dd>
                              </div>
                              <div className="grid gap-1">
                                <dt className="text-xs text-muted-foreground">
                                  Time
                                </dt>
                                <dd className="text-sm tabular-nums">
                                  {new Date(r.createdAt).toLocaleString()}
                                </dd>
                              </div>
                              <div className="grid gap-1 sm:col-span-2">
                                <dt className="text-xs text-muted-foreground">
                                  Path
                                </dt>
                                <dd className="font-mono text-xs break-all">
                                  {r.method} {r.path}
                                </dd>
                              </div>
                              <div className="grid gap-1">
                                <dt className="text-xs text-muted-foreground">
                                  Duration
                                </dt>
                                <dd className="text-sm tabular-nums">
                                  {r.durationMs} ms
                                  {r.method === 'WS' && r.statusCode === 0
                                    ? ' (connection lifetime)'
                                    : ''}
                                </dd>
                              </div>
                              <div className="grid gap-1">
                                <dt className="text-xs text-muted-foreground">
                                  Client IP
                                </dt>
                                <dd className="font-mono text-xs">
                                  {!ip ? (
                                    <span className="font-sans text-sm text-muted-foreground">
                                      Not captured
                                    </span>
                                  ) : (
                                    <span
                                      className={cn(
                                        'break-all',
                                        !isRevealed && 'blur-sm select-none'
                                      )}
                                    >
                                      {ipText}
                                    </span>
                                  )}
                                </dd>
                              </div>
                            </dl>
                            <div className="grid gap-5 lg:grid-cols-2">
                              <BodyBlock
                                title="Request body"
                                body={prettyBody(r.requestBody)}
                              />
                              <BodyBlock
                                title="Response body"
                                body={prettyBody(r.responseBody)}
                              />
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                );
              })}
            </TableBody>
          </AdminTable>
        )}
      </SettingsSection>
    </TooltipProvider>
  );
}
