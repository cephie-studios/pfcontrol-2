import { Link } from 'react-router';
import { Fragment, useMemo, useState, type ReactNode } from 'react';
import {
  Ban,
  Check,
  ChevronDown,
  Copy,
  Gauge,
  Info,
  KeyRound,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  ShieldCheck,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import ScopeTagSelector from '../../components/developers/ScopeTagSelector';
import SettingsSection from '../../components/Settings/SettingsSection';
import SettingsGroup from '../../components/Settings/SettingsGroup';
import SettingsRow from '../../components/Settings/SettingsRow';
import AdminModal from '@/components/admin/AdminModal';
import AdminStatusBadge from '@/components/admin/AdminStatusBadge';
import { AdminLoading } from '@/components/admin/AdminStates';
import { useAdminConfirm } from '@/components/admin/useAdminConfirm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { API_EXT_BASE } from './constants';
import { useDeveloperPortal } from './developerPortalContext';

function IconAction({
  label,
  onClick,
  disabled,
  destructive,
  expanded,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  expanded?: boolean;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          aria-expanded={expanded}
          disabled={disabled}
          onClick={onClick}
          className={
            destructive ? 'text-destructive hover:text-destructive' : undefined
          }
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  pending: 'Pending approval',
  revoked: 'Revoked',
};

export default function DeveloperKeys() {
  const {
    loading,
    profileActive,
    catalog,
    keys,
    keyDefaultRateLimitPerMinute,
    keyBusy,
    newKeyName,
    setNewKeyName,
    newKeyScopes,
    setNewKeyScopes,
    createdSecret,
    setCreatedSecret,
    secretCopied,
    curlCopied,
    handleCreateKey,
    handleRevoke,
    handleDeleteKey,
    handleRotateKey,
    copySecret,
    copyCurlExample,
    curlSample,
    infoMessage,
    setInfoMessage,
  } = useDeveloperPortal();

  const { confirm, confirmDialog } = useAdminConfirm();
  const [showRevoked, setShowRevoked] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [expandedKeyIds, setExpandedKeyIds] = useState<Set<string>>(new Set());

  const toggleKeyExpand = (id: string) => {
    setExpandedKeyIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const activeKeys = useMemo(() => keys.filter((k) => !k.revokedAt), [keys]);
  const revokedKeys = useMemo(() => keys.filter((k) => k.revokedAt), [keys]);
  const visibleKeys = showRevoked ? keys : activeKeys;
  const showKeyList = visibleKeys.length > 0 || revokedKeys.length > 0;

  const confirmRotate = async (id: string, name: string) => {
    const ok = await confirm({
      title: 'Rotate API key?',
      description: `The current secret for "${name}" stops working immediately. Copy the new secret when it appears.`,
      confirmText: 'Rotate',
      destructive: true,
    });
    if (ok) void handleRotateKey(id);
  };

  const confirmRevoke = async (id: string, name: string) => {
    const ok = await confirm({
      title: 'Revoke API key?',
      description: `Clients using "${name}" will stop working immediately.`,
      confirmText: 'Revoke',
      destructive: true,
    });
    if (ok) void handleRevoke(id);
  };

  const confirmDelete = async (id: string, name: string) => {
    const ok = await confirm({
      title: 'Delete revoked key?',
      description: `"${name}" will be permanently deleted. This cannot be undone.`,
      confirmText: 'Delete',
      destructive: true,
    });
    if (ok) void handleDeleteKey(id);
  };

  if (loading) {
    return (
      <div className="shadcn-scope">
        <AdminLoading className="py-24" />
      </div>
    );
  }

  if (!profileActive) {
    return (
      <div className="shadcn-scope text-foreground">
        <SettingsSection title="API keys" icon={KeyRound}>
          <SettingsGroup>
            <SettingsRow
              icon={<Lock className="text-muted-foreground" />}
              label="Not available yet"
              description="Scoped keys are available after your developer application is approved."
            >
              <Button asChild variant="outline">
                <Link to="/developers">Back to overview</Link>
              </Button>
            </SettingsRow>
          </SettingsGroup>
        </SettingsSection>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="shadcn-scope flex flex-col gap-8 text-foreground">
        {infoMessage && (
          <SettingsGroup>
            <SettingsRow
              icon={<Info className="text-blue-400" />}
              label="Key request submitted"
              description={infoMessage}
            >
              <IconAction label="Dismiss" onClick={() => setInfoMessage(null)}>
                <X />
              </IconAction>
            </SettingsRow>
          </SettingsGroup>
        )}

        <AdminModal
          open={!!createdSecret}
          onClose={() => setCreatedSecret(null)}
          title="Copy your API key"
          description="You can't view this secret again after closing this dialog. Store it in a password manager or another safe place."
          variant="success"
          size="lg"
          className="shadcn-scope"
          footer={
            <Button type="button" onClick={() => setCreatedSecret(null)}>
              Done
            </Button>
          }
        >
          <div className="grid gap-2">
            <Label htmlFor="developer-created-secret">API key</Label>
            <div className="flex gap-2">
              <Input
                id="developer-created-secret"
                readOnly
                value={createdSecret ?? ''}
                onFocus={(e) => e.currentTarget.select()}
                className="font-mono text-xs md:text-xs"
              />
              <IconAction
                label={secretCopied ? 'Copied' : 'Copy key'}
                onClick={() => void copySecret()}
              >
                {secretCopied ? (
                  <Check className="text-emerald-400" />
                ) : (
                  <Copy />
                )}
              </IconAction>
            </div>
          </div>
          {curlSample ? (
            <div className="grid gap-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="min-w-0 truncate text-sm font-medium">
                  Sample request{' '}
                  <span className="font-mono text-xs font-normal text-muted-foreground">
                    {curlSample.label}
                  </span>
                </h3>
                <IconAction
                  label={curlCopied ? 'Copied' : 'Copy curl command'}
                  onClick={() => void copyCurlExample()}
                >
                  {curlCopied ? (
                    <Check className="text-emerald-400" />
                  ) : (
                    <Copy />
                  )}
                </IconAction>
              </div>
              <pre className="max-h-80 overflow-auto rounded-xl bg-muted/50 p-4 font-mono text-xs break-all whitespace-pre-wrap">
                {curlSample.command}
              </pre>
            </div>
          ) : null}
        </AdminModal>

        <SettingsSection
          title="API keys"
          icon={KeyRound}
          actions={
            <Button
              type="button"
              variant={createOpen ? 'outline' : 'default'}
              onClick={() => setCreateOpen((v) => !v)}
            >
              {createOpen ? <X /> : <Plus />}
              {createOpen ? 'Cancel' : 'New key'}
            </Button>
          }
        >
          {createOpen && (
            <SettingsGroup title="New key">
              <SettingsRow
                icon={<Tag className="text-blue-400" />}
                label="Key label"
                htmlFor="developer-new-key-name"
              >
                <Input
                  id="developer-new-key-name"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="e.g. Production bot"
                  className="sm:w-72"
                />
              </SettingsRow>
              <SettingsRow
                stacked
                icon={<ShieldCheck className="text-blue-400" />}
                label={
                  <>
                    Scopes
                    {newKeyScopes.size > 0 && (
                      <span className="ml-2 font-normal text-muted-foreground tabular-nums">
                        {newKeyScopes.size} selected
                      </span>
                    )}
                  </>
                }
                description="Scopes beyond your approved ones need admin approval."
              >
                <ScopeTagSelector
                  catalog={catalog}
                  selected={newKeyScopes}
                  onChange={setNewKeyScopes}
                  className="w-full"
                />
              </SettingsRow>
              <SettingsRow
                icon={<Gauge className="text-blue-400" />}
                label={`${keyDefaultRateLimitPerMinute.toLocaleString()} requests per minute`}
                description="Per key, sliding window. Requests over the limit get a 429."
              />
              <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="min-w-0 truncate text-sm text-muted-foreground">
                  Base URL{' '}
                  <code className="font-mono text-foreground">
                    {API_EXT_BASE}
                  </code>
                </p>
                <Button
                  type="button"
                  className="sm:shrink-0"
                  disabled={
                    keyBusy || !newKeyName.trim() || newKeyScopes.size === 0
                  }
                  onClick={() =>
                    void handleCreateKey().then(() => setCreateOpen(false))
                  }
                >
                  {keyBusy ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <KeyRound />
                  )}
                  {keyBusy ? 'Creating…' : 'Generate key'}
                </Button>
              </div>
            </SettingsGroup>
          )}

          {keys.length === 0 && !createOpen && (
            <p className="text-sm text-muted-foreground">
              You don&apos;t have any API keys yet.
            </p>
          )}

          {showKeyList && (
            <SettingsGroup
              title={`${activeKeys.length} active key${activeKeys.length !== 1 ? 's' : ''}`}
            >
              {visibleKeys.map((k) => {
                const st = k.revokedAt ? 'revoked' : (k.status ?? 'active');
                const isRevoked = !!k.revokedAt;
                const expanded = expandedKeyIds.has(k.id);
                const scopeIdsForKey =
                  st === 'pending' && k.requestedScopes?.length
                    ? k.requestedScopes
                    : (k.scopes ?? []);
                const keyScopeCatalog = catalog.filter((c) =>
                  scopeIdsForKey.includes(c.id)
                );
                const rpmIsCustom =
                  k.rateLimitPerMinute != null &&
                  Number.isFinite(k.rateLimitPerMinute) &&
                  k.rateLimitPerMinute > 0;
                const rpmEffective = rpmIsCustom
                  ? Math.floor(k.rateLimitPerMinute as number)
                  : keyDefaultRateLimitPerMinute;
                const statusLabel = STATUS_LABEL[st] ?? st;

                return (
                  <Fragment key={k.id}>
                    <SettingsRow
                      className={cn(isRevoked && 'opacity-60')}
                      icon={
                        <AdminStatusBadge
                          status={st}
                          icon={
                            st === 'revoked'
                              ? Ban
                              : st === 'active'
                                ? KeyRound
                                : undefined
                          }
                        >
                          {statusLabel}
                        </AdminStatusBadge>
                      }
                      label={
                        <span className="block truncate">
                          {k.name}
                          <span className="sr-only">, {statusLabel}</span>
                        </span>
                      }
                      description={
                        <span className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                          <span className="font-mono text-xs">{k.prefix}…</span>
                          <span className="tabular-nums">
                            {rpmEffective.toLocaleString()}/min
                            {rpmIsCustom ? ' custom' : null}
                          </span>
                          {isRevoked && k.revokedAt && (
                            <span>
                              Revoked{' '}
                              {new Date(k.revokedAt).toLocaleDateString()}
                            </span>
                          )}
                        </span>
                      }
                    >
                      {!isRevoked && st === 'active' && (
                        <IconAction
                          label="Rotate key"
                          disabled={keyBusy}
                          onClick={() => void confirmRotate(k.id, k.name)}
                        >
                          <RefreshCw />
                        </IconAction>
                      )}
                      {!isRevoked && (
                        <IconAction
                          label="Revoke key"
                          destructive
                          disabled={keyBusy}
                          onClick={() => void confirmRevoke(k.id, k.name)}
                        >
                          <Ban />
                        </IconAction>
                      )}
                      {isRevoked && (
                        <IconAction
                          label="Delete permanently"
                          destructive
                          disabled={keyBusy}
                          onClick={() => void confirmDelete(k.id, k.name)}
                        >
                          <Trash2 />
                        </IconAction>
                      )}
                      <IconAction
                        label={expanded ? 'Hide details' : 'Show details'}
                        expanded={expanded}
                        onClick={() => toggleKeyExpand(k.id)}
                      >
                        <ChevronDown
                          className={cn(
                            'transition-transform',
                            expanded && 'rotate-180'
                          )}
                        />
                      </IconAction>
                    </SettingsRow>

                    {expanded && (
                      <div
                        className={cn(
                          'grid gap-4 bg-muted/20 px-5 py-4 sm:pl-[4.125rem]',
                          isRevoked && 'opacity-60'
                        )}
                      >
                        <div className="grid gap-2">
                          <p className="text-sm text-muted-foreground">
                            {st === 'pending'
                              ? 'Requested scopes'
                              : 'Scopes this key can use'}
                          </p>
                          {keyScopeCatalog.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              {st === 'pending'
                                ? 'No scope list yet.'
                                : 'No scopes assigned (key may still be provisioning).'}
                            </p>
                          ) : (
                            <ScopeTagSelector
                              catalog={keyScopeCatalog}
                              selected={new Set(scopeIdsForKey)}
                              onChange={() => {}}
                              readOnly
                            />
                          )}
                        </div>
                        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3">
                          <div className="grid gap-1">
                            <dt className="text-sm text-muted-foreground">
                              Requests
                            </dt>
                            <dd className="text-sm tabular-nums">
                              {k.requestCount.toLocaleString()}
                            </dd>
                          </div>
                          <div className="grid gap-1">
                            <dt className="text-sm text-muted-foreground">
                              Last used
                            </dt>
                            <dd className="text-sm">
                              {k.lastUsedAt
                                ? new Date(k.lastUsedAt).toLocaleString()
                                : 'Never'}
                            </dd>
                          </div>
                          <div className="grid gap-1">
                            <dt className="text-sm text-muted-foreground">
                              Created
                            </dt>
                            <dd className="text-sm">
                              {new Date(k.createdAt).toLocaleDateString()}
                            </dd>
                          </div>
                        </dl>
                      </div>
                    )}
                  </Fragment>
                );
              })}

              {revokedKeys.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowRevoked((v) => !v)}
                  className="flex w-full items-center gap-2 px-5 py-3 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                >
                  <ChevronDown
                    className={cn(
                      'size-4 transition-transform',
                      showRevoked && 'rotate-180'
                    )}
                  />
                  {showRevoked
                    ? 'Hide revoked keys'
                    : `Show ${revokedKeys.length} revoked key${revokedKeys.length !== 1 ? 's' : ''}`}
                </button>
              )}
            </SettingsGroup>
          )}
        </SettingsSection>
        {confirmDialog}
      </div>
    </TooltipProvider>
  );
}
