import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import {
  Loader2,
  Copy,
  Trash2,
  Check,
  KeyRound,
  RefreshCw,
  Plus,
  X,
  ChevronDown,
  ChevronRight,
  Terminal,
  Gauge,
} from 'lucide-react';
import ScopeTagSelector from '../../components/developers/ScopeTagSelector';
import { API_EXT_BASE, cardClass, statusBadgeClass } from './constants';
import { useDeveloperPortal } from './developerPortalContext';

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
    approvedScopes,
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

  const allowedCatalog = useMemo(
    () => catalog.filter((c) => approvedScopes.includes(c.id)),
    [catalog, approvedScopes]
  );

  const activeKeys = useMemo(() => keys.filter((k) => !k.revokedAt), [keys]);
  const revokedKeys = useMemo(() => keys.filter((k) => k.revokedAt), [keys]);
  const visibleKeys = showRevoked ? keys : activeKeys;

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (!profileActive) {
    return (
      <div className={cardClass()}>
        <h2 className="text-lg font-semibold text-zinc-100 mb-2">API keys</h2>
        <p className="text-sm text-zinc-400 mb-4">
          Scoped keys are available after your developer application is
          approved.
        </p>
        <Link
          to="/developers"
          className="inline-flex text-sm font-medium text-blue-400 hover:text-blue-300"
        >
          Back to overview
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {infoMessage && (
        <div
          className={`${cardClass()} border-sky-800/50 bg-sky-950/25 flex items-start justify-between gap-3`}
        >
          <p className="text-sm text-sky-100/95 leading-relaxed">
            {infoMessage}
          </p>
          <button
            type="button"
            onClick={() => setInfoMessage(null)}
            className="shrink-0 p-1 rounded-lg text-sky-400 hover:text-white hover:bg-sky-900/50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {createdSecret && (
        <div className={`${cardClass()} border-blue-900/40 bg-blue-950/20`}>
          <div className="flex items-center justify-between gap-3 mb-3">
            <p className="text-sm font-semibold text-blue-200">
              Copy your API key now
            </p>
            <button
              type="button"
              onClick={() => setCreatedSecret(null)}
              className="p-1 rounded-lg text-blue-400/70 hover:text-white hover:bg-blue-900/50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-zinc-400 mb-3 leading-relaxed">
            After you close this message, you cannot open this page again to
            copy the same secret. Copy it now and store it in a password manager
            or other safe place.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
            <code className="flex min-h-10 w-full items-center overflow-x-auto text-xs sm:text-sm break-all rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-zinc-200 ring-1 ring-zinc-700/40 sm:flex-1 sm:min-w-0 sm:whitespace-nowrap sm:break-normal sm:py-0">
              {createdSecret}
            </code>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-stretch">
              <button
                type="button"
                onClick={() => void copySecret()}
                className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 text-sm font-medium text-white transition-colors hover:bg-blue-500 sm:h-auto sm:flex-none sm:min-w-22"
              >
                {secretCopied ? (
                  <Check className="w-4 h-4 shrink-0" />
                ) : (
                  <Copy className="w-4 h-4 shrink-0" />
                )}
                Copy key
              </button>
              <button
                type="button"
                disabled={!curlSample}
                onClick={() => void copyCurlExample()}
                title={curlSample?.command}
                className="inline-flex min-h-10 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl border border-zinc-700 px-2 py-1.5 text-zinc-200 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 sm:h-auto sm:flex-none sm:min-w-22 sm:px-3"
              >
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  {curlCopied ? (
                    <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                  ) : (
                    <Terminal className="h-4 w-4 shrink-0" />
                  )}
                  {curlCopied ? 'Copied' : 'Sample curl'}
                </span>
                {curlSample ? (
                  <span className="max-w-full truncate text-center text-[10px] leading-tight text-zinc-500">
                    {curlSample.label}
                  </span>
                ) : null}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={cardClass()}>
        <div className="flex items-center justify-between gap-3 mb-1">
          <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-zinc-400" />
            API keys
            <span className="text-xs font-normal text-zinc-500 tabular-nums">
              ({activeKeys.length} active)
            </span>
          </h2>
          <button
            type="button"
            onClick={() => setCreateOpen((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-100 text-zinc-950 hover:bg-white text-xs font-semibold transition-colors"
          >
            {createOpen ? (
              <X className="w-3.5 h-3.5" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
            {createOpen ? 'Cancel' : 'New key'}
          </button>
        </div>
        <p className="text-[11px] text-zinc-400 mb-5 flex items-center gap-1.5">
          <Gauge className="w-3.5 h-3.5 shrink-0 text-zinc-500" aria-hidden />
          Each key lists its max requests per minute (sliding window; 429 when
          exceeded).
        </p>

        {createOpen && (
          <div className="mb-6 rounded-xl border border-zinc-700 bg-zinc-950/60 p-4 space-y-4 ring-1 ring-zinc-800/50">
            <p className="text-sm font-medium text-zinc-300">
              Create a new API key
            </p>
            <div>
              <label className="block text-xs text-zinc-500 mb-1.5">
                Key label
              </label>
              <input
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="e.g. Production bot"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800/50 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 ring-1 ring-zinc-700/40"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-2.5">
                Scopes
                {newKeyScopes.size > 0 && (
                  <span className="ml-2 text-blue-400">
                    {newKeyScopes.size} selected
                  </span>
                )}
              </label>
              <ScopeTagSelector
                catalog={allowedCatalog}
                selected={newKeyScopes}
                onChange={setNewKeyScopes}
              />
            </div>
            <p className="text-[11px] text-zinc-600">
              Keys using only your approved scopes are issued immediately. Extra
              scopes require admin approval.
            </p>
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                disabled={
                  keyBusy || !newKeyName.trim() || newKeyScopes.size === 0
                }
                onClick={() =>
                  void handleCreateKey().then(() => setCreateOpen(false))
                }
                className="px-4 py-2 rounded-xl bg-zinc-100 text-zinc-950 hover:bg-white disabled:opacity-50 text-sm font-semibold transition-colors"
              >
                {keyBusy ? 'Creating…' : 'Generate key'}
              </button>
              <p className="text-[11px] text-zinc-600">
                Base URL: <code className="text-zinc-400">{API_EXT_BASE}</code>
              </p>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {visibleKeys.length === 0 && !createOpen && (
            <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/20 px-4 py-10 text-center">
              <KeyRound className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
              <p className="text-sm text-zinc-500">No keys yet.</p>
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="mt-3 inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300"
              >
                <Plus className="w-3.5 h-3.5" />
                Create your first key
              </button>
            </div>
          )}

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
            const rpmEffective =
              k.rateLimitPerMinute != null &&
              Number.isFinite(k.rateLimitPerMinute) &&
              k.rateLimitPerMinute > 0
                ? Math.floor(k.rateLimitPerMinute)
                : keyDefaultRateLimitPerMinute;
            const rpmIsCustom =
              k.rateLimitPerMinute != null &&
              Number.isFinite(k.rateLimitPerMinute) &&
              k.rateLimitPerMinute > 0;

            return (
              <div
                key={k.id}
                className={`overflow-hidden rounded-xl border transition-colors ${
                  isRevoked
                    ? 'border-zinc-800/60 bg-zinc-900/20 opacity-60'
                    : 'border-zinc-800 bg-zinc-800/30'
                }`}
              >
                <div className="flex min-h-13 items-stretch">
                  <button
                    type="button"
                    aria-expanded={expanded}
                    aria-label={
                      expanded ? 'Collapse key details' : 'Expand key details'
                    }
                    onClick={() => toggleKeyExpand(k.id)}
                    title={expanded ? 'Collapse' : 'Show scopes'}
                    className={`flex min-w-0 flex-1 items-center gap-2 py-2.5 pl-2 pr-2 text-left transition-colors sm:gap-3 sm:pl-3 sm:pr-2 ${
                      isRevoked
                        ? 'text-zinc-600 hover:bg-zinc-900/40'
                        : 'text-zinc-100 hover:bg-zinc-800/40'
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        isRevoked ? 'text-zinc-600' : 'text-zinc-400'
                      }`}
                      aria-hidden
                    >
                      {expanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-1.5 min-[520px]:flex-row min-[520px]:items-center min-[520px]:justify-between min-[520px]:gap-4">
                        <div className="min-w-0 flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p className="min-w-0 max-w-full truncate text-sm font-medium text-zinc-100">
                            {k.name}
                          </p>
                          <span
                            className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md ${statusBadgeClass(st)}`}
                          >
                            {st}
                          </span>
                        </div>
                        <div className="flex min-w-0 items-baseline justify-between gap-3 min-[520px]:contents">
                          <p className="min-w-0 flex-1 truncate text-xs font-mono text-zinc-500 min-[520px]:max-w-[min(100%,14rem)] min-[520px]:flex-none">
                            {k.prefix}…
                          </p>
                          <div className="shrink-0 text-right text-[11px] tabular-nums min-[520px]:flex min-[520px]:min-w-30 min-[520px]:flex-col min-[520px]:items-end min-[520px]:gap-0.5 mr-2">
                            <p className="text-blue-400/95">
                              <span className="text-zinc-500">Rate limit</span>{' '}
                              <span className="text-zinc-300">
                                {rpmEffective.toLocaleString()}/min
                              </span>
                              {rpmIsCustom ? (
                                <span className="text-zinc-600"> · custom</span>
                              ) : null}
                            </p>
                            {isRevoked && k.revokedAt && (
                              <p className="mt-0.5 text-zinc-600 min-[520px]:mt-0">
                                Revoked{' '}
                                {new Date(k.revokedAt).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>

                  <div className="flex shrink-0 items-center gap-0.5 self-stretch border-l border-zinc-800/80 bg-zinc-900/20 py-1 pr-1.5 pl-1 sm:pr-2">
                    {!isRevoked && st === 'active' && (
                      <button
                        type="button"
                        disabled={keyBusy}
                        onClick={() => void handleRotateKey(k.id)}
                        className="p-2 rounded-lg text-zinc-500 hover:bg-zinc-800 hover:text-amber-300 transition-colors"
                        title="Rotate key — old secret stops working immediately"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    )}
                    {!isRevoked && (
                      <button
                        type="button"
                        disabled={keyBusy}
                        onClick={() => void handleRevoke(k.id)}
                        className="p-2 rounded-lg text-zinc-500 hover:bg-red-950/40 hover:text-red-400 transition-colors"
                        title="Revoke key"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    {isRevoked && (
                      <button
                        type="button"
                        disabled={keyBusy}
                        onClick={() => void handleDeleteKey(k.id)}
                        className="p-2 rounded-lg text-zinc-600 hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
                        title="Permanently delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {expanded && (
                  <div className="border-t border-zinc-800/90 bg-zinc-950/40 px-3 pb-3 pt-2 pl-13 sm:pl-15">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">
                      {st === 'pending'
                        ? 'Requested scopes'
                        : 'Scopes this key can use'}
                    </p>
                    {keyScopeCatalog.length === 0 ? (
                      <p className="text-xs text-zinc-600">
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
                )}
              </div>
            );
          })}
        </div>

        {revokedKeys.length > 0 && (
          <button
            type="button"
            onClick={() => setShowRevoked((v) => !v)}
            className="mt-3 flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform ${showRevoked ? 'rotate-180' : ''}`}
            />
            {showRevoked
              ? 'Hide revoked keys'
              : `Show ${revokedKeys.length} revoked key${revokedKeys.length !== 1 ? 's' : ''}`}
          </button>
        )}
      </div>
    </div>
  );
}
