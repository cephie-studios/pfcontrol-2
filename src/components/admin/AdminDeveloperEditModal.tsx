import { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  KeyRound,
  Loader2,
  Pencil,
  RotateCcw,
  Save,
  Trash2,
  X,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import AdminModal from './AdminModal';
import AdminStatusBadge from './AdminStatusBadge';
import AdminTable from './AdminTable';
import { AdminEmptyState, AdminLoading } from './AdminStates';
import DeveloperDiscordAvatar from './DeveloperDiscordAvatar';
import { useAdminConfirm } from './useAdminConfirm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToast } from '../../hooks/useToast';
import ScopeTagSelector from '../developers/ScopeTagSelector';
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

type Tab = 'ceiling' | 'keys';

type Props = {
  developer: AdminDeveloperSummary;
  onReload: () => Promise<void>;
  onClose: () => void;
  onProfileSuspend?: () => void;
  onProfileReactivate?: () => void;
  profileActionBusy?: boolean;
  onDeleteDeveloper?: () => void | Promise<void>;
  deleteDeveloperBusy?: boolean;
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
  suspended: Ban,
};

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

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

export default function AdminDeveloperEditModal({
  developer,
  onReload,
  onClose,
  onProfileSuspend,
  onProfileReactivate,
  profileActionBusy,
  onDeleteDeveloper,
  deleteDeveloperBusy,
}: Props) {
  const { showError } = useToast();
  const { confirm, confirmDialog } = useAdminConfirm();
  const [tab, setTab] = useState<Tab>('ceiling');
  const [catalog, setCatalog] = useState<AdminScopeCatalogEntry[]>([]);
  const [keys, setKeys] = useState<AdminDeveloperKeyRow[]>([]);
  const [keysLoading, setKeysLoading] = useState(true);
  const [ceiling, setCeiling] = useState<Set<string>>(
    () => new Set(developer.approvedScopes)
  );
  const [ceilingBusy, setCeilingBusy] = useState(false);
  const [ceilingSaved, setCeilingSaved] = useState(false);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [revealedCopied, setRevealedCopied] = useState(false);

  const [approveKey, setApproveKey] = useState<AdminDeveloperKeyRow | null>(
    null
  );
  const [approveScopes, setApproveScopes] = useState<Set<string>>(new Set());
  const [approveRpm, setApproveRpm] = useState('');
  const [approveNote, setApproveNote] = useState('');

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

  const reloadKeys = async () => {
    setKeysLoading(true);
    try {
      const r = await fetchAdminDeveloperKeys(developer.userId);
      setKeys(r.keys);
    } catch {
      setKeys([]);
    } finally {
      setKeysLoading(false);
    }
  };

  useEffect(() => {
    void reloadKeys();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [developer.userId]);

  const catalogSorted = useMemo(
    () => [...catalog].sort((a, b) => a.id.localeCompare(b.id)),
    [catalog]
  );

  const adminOnlyScopes = useMemo(
    () => catalogSorted.filter(isAdminOnlyScope),
    [catalogSorted]
  );

  const saveCeiling = async () => {
    setCeilingBusy(true);
    try {
      await patchAdminDeveloperProfileScopes(developer.userId, [...ceiling]);
      setCeilingSaved(true);
      setTimeout(() => setCeilingSaved(false), 2000);
      await onReload();
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setCeilingBusy(false);
    }
  };

  const openApprove = (k: AdminDeveloperKeyRow) => {
    setApproveKey(k);
    setApproveScopes(new Set(k.requestedScopes));
    setApproveRpm('');
    setApproveNote('');
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
      await reloadKeys();
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
      await reloadKeys();
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
      await reloadKeys();
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
        title: `Revoke key "${k.name}"?`,
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
      await reloadKeys();
      await onReload();
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Revoke failed');
    } finally {
      setRowBusy(null);
    }
  };

  const copyRevealed = async () => {
    if (!revealedSecret) return;
    await navigator.clipboard.writeText(revealedSecret);
    setRevealedCopied(true);
    setTimeout(() => setRevealedCopied(false), 2000);
  };

  const approveKeyFromCatalog = useMemo(
    () =>
      approveKey
        ? catalog.filter((c) => approveKey.requestedScopes.includes(c.id))
        : [],
    [approveKey, catalog]
  );

  const editKeyFromCatalog = useMemo(
    () => catalogSorted.filter((c) => ceiling.has(c.id)),
    [catalogSorted, ceiling]
  );

  return (
    <>
      <AdminModal
        open
        onClose={onClose}
        title={developer.username}
        size="lg"
        footer={
          <>
            {onDeleteDeveloper ? (
              <Button
                type="button"
                variant="destructive"
                className="sm:mr-auto"
                disabled={deleteDeveloperBusy}
                onClick={() => void onDeleteDeveloper()}
              >
                {deleteDeveloperBusy ? (
                  <Loader2 className="animate-spin" aria-hidden />
                ) : (
                  <Trash2 aria-hidden />
                )}
                Delete developer
              </Button>
            ) : null}
            {developer.status === 'active' && onProfileSuspend && (
              <Button
                type="button"
                variant="outline"
                disabled={profileActionBusy}
                onClick={() => {
                  onProfileSuspend();
                  onClose();
                }}
              >
                <Ban />
                Suspend
              </Button>
            )}
            {developer.status !== 'active' && onProfileReactivate && (
              <Button
                type="button"
                variant="outline"
                disabled={profileActionBusy}
                onClick={() => {
                  onProfileReactivate();
                  onClose();
                }}
              >
                <RotateCcw />
                Reactivate
              </Button>
            )}
            {tab === 'ceiling' && (
              <Button
                type="button"
                disabled={ceilingBusy || ceiling.size === 0}
                onClick={() => void saveCeiling()}
              >
                {ceilingSaved ? (
                  <>
                    <Check /> Saved
                  </>
                ) : (
                  <>
                    {ceilingBusy ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Save />
                    )}
                    {ceilingBusy ? 'Saving…' : 'Save ceiling'}
                  </>
                )}
              </Button>
            )}
          </>
        }
      >
        <div className="flex min-w-0 items-center gap-3">
          <DeveloperDiscordAvatar
            userId={developer.userId}
            username={developer.username}
            avatar={developer.avatar}
            className="size-9"
          />
          <AdminStatusBadge
            status={developer.status}
            icon={STATUS_ICON[developer.status]}
            showLabel
          >
            {capitalize(developer.status)}
          </AdminStatusBadge>
          <p className="truncate font-mono text-xs text-muted-foreground">
            {developer.userId}
          </p>
        </div>

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as Tab)}
          className="gap-5"
        >
          <TabsList
            className="w-full sm:w-auto"
            aria-label="Developer edit sections"
          >
            <TabsTrigger value="ceiling">Scope ceiling</TabsTrigger>
            <TabsTrigger value="keys">
              Keys
              {developer.keysPending > 0 && (
                <span className="text-muted-foreground tabular-nums">
                  {developer.keysPending}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ceiling" className="flex flex-col gap-5">
            <ScopeTagSelector
              catalog={catalog}
              selected={ceiling}
              onChange={setCeiling}
            />
            {adminOnlyScopes.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                Admin-only, granted here only:{' '}
                {adminOnlyScopes.map((s, i) => (
                  <span key={s.id}>
                    {i > 0 ? ', ' : null}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span tabIndex={0} className="cursor-default font-mono">
                          {s.id}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>{s.label}</TooltipContent>
                    </Tooltip>
                  </span>
                ))}
              </p>
            ) : null}
          </TabsContent>

          <TabsContent value="keys">
            {keysLoading ? (
              <AdminLoading label="Loading keys…" className="py-12" />
            ) : keys.length === 0 ? (
              <AdminEmptyState icon={KeyRound} title="No keys yet" />
            ) : (
              <AdminTable minWidth="560px">
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>RPM</TableHead>
                    <TableHead>Last used</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keys.map((k) => {
                    const st = k.revokedAt ? 'revoked' : (k.status ?? 'active');
                    return (
                      <TableRow key={k.id}>
                        <TableCell>
                          <div className="leading-snug font-medium">
                            {k.name}
                          </div>
                          <code className="font-mono text-xs text-muted-foreground">
                            {k.prefix}…
                          </code>
                        </TableCell>
                        <TableCell>
                          <AdminStatusBadge status={st} icon={STATUS_ICON[st]}>
                            {capitalize(st)}
                          </AdminStatusBadge>
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {k.rateLimitPerMinute ?? (
                            <span className="text-muted-foreground">
                              Default
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground tabular-nums">
                          {k.lastUsedAt
                            ? new Date(k.lastUsedAt).toLocaleDateString()
                            : 'Never'}
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
                  })}
                </TableBody>
              </AdminTable>
            )}
          </TabsContent>
        </Tabs>
      </AdminModal>

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
              {rowBusy != null && approveKey && rowBusy === approveKey.id ? (
                <Loader2 className="animate-spin" />
              ) : null}
              Approve & issue secret
            </Button>
          </>
        }
      >
        {approveKey && (
          <div className="grid gap-5">
            <div className="grid gap-2">
              <Label>Allowed scopes</Label>
              <ScopeTagSelector
                catalog={approveKeyFromCatalog}
                selected={approveScopes}
                onChange={setApproveScopes}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="admin-dev-approve-rpm">
                Rate limit / min (empty = default)
              </Label>
              <Input
                id="admin-dev-approve-rpm"
                inputMode="numeric"
                value={approveRpm}
                onChange={(e) => setApproveRpm(e.target.value)}
                placeholder="e.g. 120"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="admin-dev-approve-note">Note (optional)</Label>
              <Textarea
                id="admin-dev-approve-note"
                value={approveNote}
                onChange={(e) => setApproveNote(e.target.value)}
                placeholder="Visible to developer"
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
        title="Key approved: copy the secret now"
        description="This is shown only once."
        size="md"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRevealedSecret(null)}
            >
              Done
            </Button>
            <Button type="button" onClick={() => void copyRevealed()}>
              {revealedCopied ? <Check /> : <Copy />}
              {revealedCopied ? 'Copied' : 'Copy secret'}
            </Button>
          </>
        }
      >
        <pre className="max-h-80 overflow-auto rounded-xl bg-muted/50 p-4 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap">
          {revealedSecret}
        </pre>
      </AdminModal>

      <AdminModal
        open={!!editKey}
        onClose={() => setEditKey(null)}
        title={editKey ? `Edit key: ${editKey.name}` : 'Edit key'}
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
              {rowBusy != null && editKey && rowBusy === editKey.id ? (
                <Loader2 className="animate-spin" />
              ) : null}
              Save
            </Button>
          </>
        }
      >
        {editKey && (
          <div className="grid gap-5">
            <div className="grid gap-2">
              <Label>Scopes</Label>
              <ScopeTagSelector
                catalog={editKeyFromCatalog}
                selected={editScopes}
                onChange={setEditScopes}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="admin-dev-edit-rpm">
                RPM override (empty = default)
              </Label>
              <Input
                id="admin-dev-edit-rpm"
                inputMode="numeric"
                value={editRpm}
                onChange={(e) => setEditRpm(e.target.value)}
                placeholder="e.g. 60"
              />
            </div>
          </div>
        )}
      </AdminModal>

      {confirmDialog}
    </>
  );
}
