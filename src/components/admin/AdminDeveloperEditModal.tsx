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
import { toast } from 'sonner';
import ScopeTagSelector from '../developers/ScopeTagSelector';
import AdminScopePermissions from './AdminScopePermissions';
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

type Tab = 'permissions' | 'keys';

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
  const { confirm, confirmDialog } = useAdminConfirm();
  const [tab, setTab] = useState<Tab>('permissions');
  const [catalog, setCatalog] = useState<AdminScopeCatalogEntry[]>([]);
  const [keys, setKeys] = useState<AdminDeveloperKeyRow[]>([]);
  const [keysLoading, setKeysLoading] = useState(true);
  const savedAllowed = useMemo(
    () => new Set(developer.approvedScopes),
    [developer.approvedScopes]
  );
  const savedAllKeys = useMemo(
    () => new Set(developer.allKeysScopes ?? []),
    [developer.allKeysScopes]
  );
  const [allowed, setAllowed] = useState<Set<string>>(savedAllowed);
  const [allKeys, setAllKeys] = useState<Set<string>>(savedAllKeys);
  const savedAppName = developer.appName ?? '';
  const [appName, setAppName] = useState(savedAppName);
  const [permissionsBusy, setPermissionsBusy] = useState(false);
  const [permissionsSaved, setPermissionsSaved] = useState(false);
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
    setAllowed(new Set(savedAllowed));
    setAllKeys(new Set(savedAllKeys));
    setAppName(savedAppName);
  }, [developer.userId, savedAllowed, savedAllKeys, savedAppName]);

  const permissionsDirty = useMemo(() => {
    const same = (a: Set<string>, b: Set<string>) =>
      a.size === b.size && [...a].every((x) => b.has(x));
    return (
      !same(allowed, savedAllowed) ||
      !same(allKeys, savedAllKeys) ||
      appName.trim() !== savedAppName
    );
  }, [allowed, allKeys, savedAllowed, savedAllKeys, appName, savedAppName]);

  const appNameScopes = useMemo(
    () => catalog.filter((c) => c.requiresAppName && allowed.has(c.id)),
    [catalog, allowed]
  );
  const appNameMissing = appNameScopes.length > 0 && !appName.trim();

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

  const savePermissions = async () => {
    setPermissionsBusy(true);
    try {
      const { strippedKeys } = await patchAdminDeveloperProfileScopes(
        developer.userId,
        [...allowed],
        [...allKeys],
        appName.trim() || null
      );
      setPermissionsSaved(true);
      setTimeout(() => setPermissionsSaved(false), 2000);
      if (strippedKeys.length > 0) {
        toast.success(
          `Removed scopes from ${strippedKeys.length} key${strippedKeys.length === 1 ? '' : 's'}`
        );
      }
      await Promise.all([onReload(), reloadKeys()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setPermissionsBusy(false);
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
      toast.error(e instanceof Error ? e.message : 'Approve failed');
    } finally {
      setRowBusy(null);
    }
  };

  const submitRejectKey = async (k: AdminDeveloperKeyRow) => {
    await confirm({
      title: 'Reject this key request?',
      description: `The request for "${k.name}" will be rejected.`,
      confirmText: 'Reject',
      destructive: true,
      action: async () => {
        setRowBusy(k.id);
        try {
          await rejectAdminDeveloperKey(developer.userId, k.id);
          await reloadKeys();
          await onReload();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'Reject failed');
          throw e;
        } finally {
          setRowBusy(null);
        }
      },
    });
  };

  const openEdit = (k: AdminDeveloperKeyRow) => {
    setEditKey(k);
    setEditScopes(new Set(k.scopes.filter((s) => !savedAllKeys.has(s))));
    setEditRpm(
      k.rateLimitPerMinute != null ? String(k.rateLimitPerMinute) : ''
    );
  };

  const saveEdit = async () => {
    if (!editKey || editScopes.size + savedAllKeys.size === 0) return;
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
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setRowBusy(null);
    }
  };

  const doRevoke = async (k: AdminDeveloperKeyRow) => {
    await confirm({
      title: `Revoke key "${k.name}"?`,
      description:
        'Requests using this key will fail immediately. This cannot be undone.',
      confirmText: 'Revoke',
      destructive: true,
      action: async () => {
        setRowBusy(k.id);
        try {
          await revokeAdminDeveloperKey(developer.userId, k.id);
          await reloadKeys();
          await onReload();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'Revoke failed');
          throw e;
        } finally {
          setRowBusy(null);
        }
      },
    });
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
    () => catalogSorted.filter((c) => savedAllowed.has(c.id)),
    [catalogSorted, savedAllowed]
  );

  const effectiveScopeCount = (k: AdminDeveloperKeyRow) =>
    new Set([...k.scopes, ...savedAllKeys].filter((s) => savedAllowed.has(s)))
      .size;

  return (
    <>
      <AdminModal
        open
        onClose={onClose}
        title={developer.username}
        size="full"
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
            {tab === 'permissions' && (
              <Button
                type="button"
                disabled={
                  permissionsBusy ||
                  !permissionsDirty ||
                  allowed.size === 0 ||
                  appNameMissing
                }
                onClick={() => void savePermissions()}
              >
                {permissionsSaved ? (
                  <>
                    <Check /> Saved
                  </>
                ) : (
                  <>
                    {permissionsBusy ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Save />
                    )}
                    {permissionsBusy ? 'Saving…' : 'Save permissions'}
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
            <TabsTrigger value="permissions">
              Permissions
              {permissionsDirty && (
                <span
                  className="size-1.5 rounded-full bg-amber-500"
                  aria-label="Unsaved changes"
                />
              )}
            </TabsTrigger>
            <TabsTrigger value="keys">
              Keys
              {developer.keysPending > 0 && (
                <span className="text-muted-foreground tabular-nums">
                  {developer.keysPending}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="permissions">
            {catalog.length === 0 ? (
              <AdminLoading label="Loading scopes…" className="py-12" />
            ) : (
              <div className="flex flex-col gap-5">
                {appNameScopes.length > 0 || savedAppName ? (
                  <div className="grid gap-2">
                    <Label htmlFor="developer-app-name">
                      App name
                      {appNameScopes.length > 0 ? (
                        <span className="text-red-500">*</span>
                      ) : null}
                    </Label>
                    <Input
                      id="developer-app-name"
                      value={appName}
                      maxLength={80}
                      placeholder="e.g. Veyra Scope"
                      disabled={permissionsBusy}
                      onChange={(e) => setAppName(e.target.value)}
                      className="sm:max-w-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Shown to controllers when this developer asks to claim
                      their session. Required for{' '}
                      {appNameScopes.length > 0
                        ? appNameScopes.map((c) => c.label).join(', ')
                        : 'admin-only claim scopes'}
                      . Only admins can change it.
                    </p>
                  </div>
                ) : null}
                <AdminScopePermissions
                  catalog={catalog}
                  allowed={allowed}
                  allKeys={allKeys}
                  savedAllowed={savedAllowed}
                  savedAllKeys={savedAllKeys}
                  keys={keys}
                  disabled={permissionsBusy}
                  onChange={(a, all) => {
                    setAllowed(a);
                    setAllKeys(all);
                  }}
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="keys" className="flex flex-col gap-4">
            {permissionsDirty ? (
              <p className="rounded-xl border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                You have unsaved permission changes. Keys use the saved
                permissions until you save them on the Permissions tab.
              </p>
            ) : null}
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
                    <TableHead>Scopes</TableHead>
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
                        <TableCell className="text-muted-foreground tabular-nums">
                          {k.status === 'active' && !k.revokedAt
                            ? effectiveScopeCount(k)
                            : '–'}
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
              <Label>Requested scopes to approve</Label>
              <ScopeTagSelector
                catalog={approveKeyFromCatalog}
                selected={approveScopes}
                onChange={setApproveScopes}
              />
              {savedAllKeys.size > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Plus {savedAllKeys.size} scope
                  {savedAllKeys.size === 1 ? '' : 's'} set to "All keys" on the
                  Permissions tab, added automatically.
                </p>
              ) : null}
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
        variant="success"
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
              disabled={
                editScopes.size + savedAllKeys.size === 0 || rowBusy != null
              }
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
              <p className="text-xs text-muted-foreground">
                Only scopes set to "Allowed" or "All keys" on the Permissions
                tab are listed. "All keys" scopes can't be removed per key.
              </p>
              <ScopeTagSelector
                catalog={editKeyFromCatalog}
                selected={editScopes}
                onChange={setEditScopes}
                locked={savedAllKeys}
                lockedLabel="All keys"
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
