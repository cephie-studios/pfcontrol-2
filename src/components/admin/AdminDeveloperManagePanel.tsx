import { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  Lock,
  Pencil,
  RotateCcw,
  Save,
  X,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import AdminModal from './AdminModal';
import AdminSection from './AdminSection';
import AdminStatusBadge from './AdminStatusBadge';
import AdminTable from './AdminTable';
import { AdminLoading } from './AdminStates';
import { useAdminConfirm } from './useAdminConfirm';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToast } from '../../hooks/useToast';
import {
  approveAdminDeveloperKey,
  fetchAdminDeveloperCatalog,
  fetchAdminDeveloperKeys,
  patchAdminDeveloperKey,
  patchAdminDeveloperProfileScopes,
  rejectAdminDeveloperKey,
  revokeAdminDeveloperKey,
  type AdminDeveloperKeyRow,
  type AdminDeveloperSummary,
  type AdminScopeCatalogEntry,
} from '../../utils/fetch/adminDevelopers';

type Props = {
  developer: AdminDeveloperSummary;
  onReload: () => Promise<void>;
  onProfileSuspend?: () => void;
  onProfileReactivate?: () => void;
  profileActionBusy?: boolean;
};

function isAdminOnlyScope(entry: AdminScopeCatalogEntry): boolean {
  return Boolean(
    (entry as AdminScopeCatalogEntry & { hidden?: boolean }).hidden
  );
}

const STATUS_ICON: Record<string, LucideIcon> = {
  active: CheckCircle2,
  pending: Clock,
  rejected: XCircle,
  revoked: Ban,
};

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const SCOPE_PREVIEW_MAX = 4;

function KeyRowAction({
  label,
  icon: Icon,
  onClick,
  disabled,
  destructive,
}: {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
          className={
            destructive ? 'text-destructive hover:text-destructive' : undefined
          }
        >
          <Icon />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function ScopeCheckbox({
  id,
  label,
  checked,
  onToggle,
}: {
  id: string;
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  const inputId = `admin-dev-scope-${id}`;
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={inputId} checked={checked} onCheckedChange={onToggle} />
      <Label htmlFor={inputId} className="font-normal">
        {label}
      </Label>
    </div>
  );
}

export default function AdminDeveloperManagePanel({
  developer,
  onReload,
  onProfileSuspend,
  onProfileReactivate,
  profileActionBusy,
}: Props) {
  const { showError } = useToast();
  const { confirm, confirmDialog } = useAdminConfirm();
  const [catalog, setCatalog] = useState<AdminScopeCatalogEntry[]>([]);
  const [keys, setKeys] = useState<AdminDeveloperKeyRow[]>([]);
  const [keysLoading, setKeysLoading] = useState(true);
  const [ceiling, setCeiling] = useState<Set<string>>(
    () => new Set(developer.approvedScopes)
  );
  const [ceilingBusy, setCeilingBusy] = useState(false);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [approveKey, setApproveKey] = useState<AdminDeveloperKeyRow | null>(
    null
  );
  const [approveScopes, setApproveScopes] = useState<Set<string>>(new Set());
  const [approveRpm, setApproveRpm] = useState('');
  const [approveNote, setApproveNote] = useState('');
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [editKey, setEditKey] = useState<AdminDeveloperKeyRow | null>(null);
  const [editScopes, setEditScopes] = useState<Set<string>>(new Set());
  const [editRpm, setEditRpm] = useState('');

  useEffect(() => {
    setCeiling(new Set(developer.approvedScopes));
  }, [developer.userId, developer.approvedScopes]);

  useEffect(() => {
    let cancelled = false;
    fetchAdminDeveloperCatalog()
      .then((sc) => {
        if (!cancelled) setCatalog(sc);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setKeysLoading(true);
    fetchAdminDeveloperKeys(developer.userId)
      .then((r) => {
        if (!cancelled) setKeys(r.keys);
      })
      .catch(() => {
        if (!cancelled) setKeys([]);
      })
      .finally(() => {
        if (!cancelled) setKeysLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [developer.userId]);

  const catalogSorted = useMemo(
    () => [...catalog].sort((a, b) => a.id.localeCompare(b.id)),
    [catalog]
  );

  const scopeGroups = useMemo(() => {
    const m = new Map<string, AdminScopeCatalogEntry[]>();
    for (const c of catalogSorted) {
      const prefix = c.id.split('.')[0] ?? 'other';
      const arr = m.get(prefix) ?? [];
      arr.push(c);
      m.set(prefix, arr);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [catalogSorted]);

  const saveCeiling = async () => {
    if (ceiling.size === 0) return;
    setCeilingBusy(true);
    try {
      await patchAdminDeveloperProfileScopes(developer.userId, [...ceiling]);
      await onReload();
    } finally {
      setCeilingBusy(false);
    }
  };

  const toggleCeiling = (id: string) => {
    setCeiling((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const openApprove = (k: AdminDeveloperKeyRow) => {
    setApproveKey(k);
    setApproveScopes(new Set(k.requestedScopes));
    setApproveRpm('');
    setApproveNote('');
    setRevealedSecret(null);
  };

  const submitApprove = async () => {
    if (!approveKey || approveScopes.size === 0) return;
    setRowBusy(approveKey.id);
    try {
      const rpm =
        approveRpm.trim() === ''
          ? null
          : Math.max(0, parseInt(approveRpm, 10) || 0);
      const res = await approveAdminDeveloperKey(
        developer.userId,
        approveKey.id,
        {
          approvedScopes: [...approveScopes],
          rateLimitPerMinute: rpm,
          note: approveNote || undefined,
        }
      );
      setRevealedSecret(res.secret);
      setApproveKey(null);
      const kr = await fetchAdminDeveloperKeys(developer.userId);
      setKeys(kr.keys);
      await onReload();
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Approve failed');
    } finally {
      setRowBusy(null);
    }
  };

  const submitRejectKey = async (k: AdminDeveloperKeyRow) => {
    if (
      !(await confirm({
        title: 'Reject this key request?',
        description: `The request for "${k.name}" will be rejected.`,
        confirmText: 'Reject',
        destructive: true,
      }))
    )
      return;
    setRowBusy(k.id);
    try {
      await rejectAdminDeveloperKey(developer.userId, k.id);
      const kr = await fetchAdminDeveloperKeys(developer.userId);
      setKeys(kr.keys);
      await onReload();
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Reject failed');
    } finally {
      setRowBusy(null);
    }
  };

  const openEdit = (k: AdminDeveloperKeyRow) => {
    setEditKey(k);
    setEditScopes(new Set(k.scopes));
    setEditRpm(
      k.rateLimitPerMinute != null ? String(k.rateLimitPerMinute) : ''
    );
  };

  const saveEdit = async () => {
    if (!editKey || editScopes.size === 0) return;
    setRowBusy(editKey.id);
    try {
      const rpm =
        editRpm.trim() === '' ? null : Math.max(0, parseInt(editRpm, 10) || 0);
      await patchAdminDeveloperKey(developer.userId, editKey.id, {
        scopes: [...editScopes],
        rateLimitPerMinute: rpm,
      });
      setEditKey(null);
      const kr = await fetchAdminDeveloperKeys(developer.userId);
      setKeys(kr.keys);
      await onReload();
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setRowBusy(null);
    }
  };

  const doRevoke = async (k: AdminDeveloperKeyRow) => {
    if (
      !(await confirm({
        title: `Revoke key “${k.name}”?`,
        description:
          'Requests using this key will fail immediately. This cannot be undone.',
        confirmText: 'Revoke',
        destructive: true,
      }))
    )
      return;
    setRowBusy(k.id);
    try {
      await revokeAdminDeveloperKey(developer.userId, k.id);
      const kr = await fetchAdminDeveloperKeys(developer.userId);
      setKeys(kr.keys);
      await onReload();
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Revoke failed');
    } finally {
      setRowBusy(null);
    }
  };

  const toggleIn =
    (setter: (fn: (prev: Set<string>) => Set<string>) => void, id: string) =>
    () =>
      setter((prev) => {
        const n = new Set(prev);
        if (n.has(id)) n.delete(id);
        else n.add(id);
        return n;
      });

  return (
    <div className="flex flex-col gap-4">
      <AdminSection
        title="Scope ceiling & keys"
        description={`${developer.username} · ${developer.keysActive} usable · ${developer.keysPending} pending · ${developer.keysTotal} total`}
        actions={
          onProfileSuspend || onProfileReactivate ? (
            <>
              {developer.status === 'active' && onProfileSuspend && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={profileActionBusy}
                  onClick={() => onProfileSuspend()}
                >
                  <Ban />
                  Suspend
                </Button>
              )}
              {developer.status !== 'active' && onProfileReactivate && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={profileActionBusy}
                  onClick={() => onProfileReactivate()}
                >
                  <RotateCcw />
                  Reactivate
                </Button>
              )}
            </>
          ) : undefined
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium">Allowed scopes</p>
          <div className="flex max-h-56 flex-col gap-3 overflow-y-auto rounded-2xl border p-3">
            {scopeGroups.map(([group, entries]) => (
              <div key={group} className="grid gap-1.5">
                <p className="text-xs font-medium text-muted-foreground capitalize">
                  {group}
                </p>
                <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
                  {entries.map((s) => {
                    const inputId = `admin-dev-ceiling-${s.id}`;
                    return (
                      <div key={s.id} className="flex items-start gap-2">
                        <Checkbox
                          id={inputId}
                          checked={ceiling.has(s.id)}
                          onCheckedChange={() => toggleCeiling(s.id)}
                          className="mt-0.5"
                        />
                        <Label
                          htmlFor={inputId}
                          className="flex min-w-0 cursor-pointer flex-col items-start gap-0.5"
                        >
                          <span className="flex flex-wrap items-center gap-1.5 text-xs font-medium">
                            {s.label}
                            {isAdminOnlyScope(s) ? (
                              <AdminStatusBadge tone="neutral" icon={Lock}>
                                Admin only
                              </AdminStatusBadge>
                            ) : null}
                          </span>
                          <span className="line-clamp-2 text-xs font-normal text-muted-foreground">
                            {s.description}
                          </span>
                        </Label>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div>
            <Button
              type="button"
              size="sm"
              disabled={ceilingBusy || ceiling.size === 0}
              onClick={() => void saveCeiling()}
            >
              {ceilingBusy ? <Loader2 className="animate-spin" /> : <Save />}
              Save ceiling
            </Button>
          </div>
        </div>
      </AdminSection>

      <AdminSection title="API keys">
        {keysLoading ? (
          <AdminLoading label="Loading keys…" className="py-6" />
        ) : (
          <AdminTable minWidth="640px">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Scopes</TableHead>
                <TableHead>RPM</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-6 text-center text-muted-foreground"
                  >
                    No keys.
                  </TableCell>
                </TableRow>
              ) : (
                keys.map((k) => {
                  const scopeList =
                    k.status === 'pending' ? k.requestedScopes : k.scopes;
                  return (
                    <TableRow key={k.id}>
                      <TableCell>
                        <div className="font-medium">{k.name}</div>
                        <code className="font-mono text-xs text-muted-foreground">
                          {k.prefix}
                        </code>
                      </TableCell>
                      <TableCell>
                        <AdminStatusBadge
                          status={k.status ?? 'active'}
                          icon={STATUS_ICON[k.status ?? 'active']}
                        >
                          {capitalize(k.status ?? 'active')}
                        </AdminStatusBadge>
                      </TableCell>
                      <TableCell className="max-w-[200px] font-mono text-xs whitespace-normal text-muted-foreground">
                        {scopeList.length > SCOPE_PREVIEW_MAX ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span tabIndex={0} className="cursor-default">
                                {scopeList
                                  .slice(0, SCOPE_PREVIEW_MAX)
                                  .join(', ')}
                                …
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <ul className="grid gap-0.5 font-mono">
                                {scopeList.map((s) => (
                                  <li key={s}>{s}</li>
                                ))}
                              </ul>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          scopeList.join(', ')
                        )}
                      </TableCell>
                      <TableCell className="text-xs tabular-nums">
                        {k.rateLimitPerMinute ?? (
                          <span className="text-muted-foreground">Default</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        <div className="tabular-nums">
                          {k.requestCount.toLocaleString()} req
                          {k.requestCount === 1 ? '' : 's'}
                        </div>
                        <div className="text-muted-foreground">
                          {k.lastUsedAt
                            ? new Date(k.lastUsedAt).toLocaleDateString()
                            : 'Never used'}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {k.revokedAt ? (
                          <span className="text-xs text-muted-foreground">
                            Revoked
                          </span>
                        ) : k.status === 'pending' ? (
                          <div className="flex justify-end gap-1">
                            <KeyRowAction
                              label="Approve key request"
                              icon={Check}
                              disabled={rowBusy === k.id}
                              onClick={() => openApprove(k)}
                            />
                            <KeyRowAction
                              label="Reject key request"
                              icon={X}
                              destructive
                              disabled={rowBusy === k.id}
                              onClick={() => void submitRejectKey(k)}
                            />
                          </div>
                        ) : k.status === 'active' ? (
                          <div className="flex justify-end gap-1">
                            <KeyRowAction
                              label="Edit key"
                              icon={Pencil}
                              disabled={rowBusy === k.id}
                              onClick={() => openEdit(k)}
                            />
                            <KeyRowAction
                              label="Revoke key"
                              icon={Ban}
                              destructive
                              disabled={rowBusy === k.id}
                              onClick={() => void doRevoke(k)}
                            />
                          </div>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </AdminTable>
        )}
      </AdminSection>

      <AdminModal
        open={!!approveKey}
        onClose={() => setApproveKey(null)}
        title="Approve key request"
        description={approveKey?.name}
        size="md"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setApproveKey(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={approveScopes.size === 0 || rowBusy != null}
              onClick={() => void submitApprove()}
            >
              Approve & issue secret
            </Button>
          </>
        }
      >
        {approveKey && (
          <div className="grid gap-5">
            <div className="grid gap-2">
              <Label>Allowed scopes</Label>
              <div className="grid max-h-48 gap-2.5 overflow-y-auto">
                {approveKey.requestedScopes.map((id) => (
                  <ScopeCheckbox
                    key={id}
                    id={`approve-${id}`}
                    label={catalog.find((c) => c.id === id)?.label ?? id}
                    checked={approveScopes.has(id)}
                    onToggle={toggleIn(setApproveScopes, id)}
                  />
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="admin-dev-panel-approve-rpm">
                Rate limit / min (empty = default)
              </Label>
              <Input
                id="admin-dev-panel-approve-rpm"
                inputMode="numeric"
                value={approveRpm}
                onChange={(e) => setApproveRpm(e.target.value)}
                placeholder="e.g. 120"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="admin-dev-panel-approve-note">Note</Label>
              <Textarea
                id="admin-dev-panel-approve-note"
                value={approveNote}
                onChange={(e) => setApproveNote(e.target.value)}
                placeholder="Optional note"
                rows={2}
                className="resize-none"
              />
            </div>
          </div>
        )}
      </AdminModal>

      <AdminModal
        open={!!revealedSecret}
        onClose={() => setRevealedSecret(null)}
        title="Key secret (copy now)"
        description="This is shown only once."
        size="md"
        footer={
          <Button
            type="button"
            variant="outline"
            onClick={() => setRevealedSecret(null)}
            className="w-full sm:w-auto"
          >
            Done
          </Button>
        }
      >
        <pre className="max-h-80 overflow-auto rounded-xl bg-muted/50 p-4 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap">
          {revealedSecret}
        </pre>
      </AdminModal>

      <AdminModal
        open={!!editKey}
        onClose={() => setEditKey(null)}
        title="Edit active key"
        size="md"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditKey(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={editScopes.size === 0 || rowBusy != null}
              onClick={() => void saveEdit()}
            >
              Save
            </Button>
          </>
        }
      >
        {editKey && (
          <div className="grid gap-5">
            <div className="grid gap-2">
              <Label>Scopes</Label>
              <div className="grid max-h-52 gap-2.5 overflow-y-auto">
                {catalogSorted
                  .filter((c) => ceiling.has(c.id))
                  .map((c) => (
                    <ScopeCheckbox
                      key={c.id}
                      id={`edit-${c.id}`}
                      label={c.label}
                      checked={editScopes.has(c.id)}
                      onToggle={toggleIn(setEditScopes, c.id)}
                    />
                  ))}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="admin-dev-panel-edit-rpm">
                RPM override (empty = default)
              </Label>
              <Input
                id="admin-dev-panel-edit-rpm"
                inputMode="numeric"
                value={editRpm}
                onChange={(e) => setEditRpm(e.target.value)}
              />
            </div>
          </div>
        )}
      </AdminModal>

      {confirmDialog}
    </div>
  );
}
