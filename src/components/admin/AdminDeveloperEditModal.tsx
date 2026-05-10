import { useEffect, useMemo, useState } from "react";
import { X, Save, KeyRound, Shield, Copy, Check, Loader2, Trash2 } from "lucide-react";
import DeveloperDiscordAvatar from "./DeveloperDiscordAvatar";
import ScopeTagSelector from "../developers/ScopeTagSelector";
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
} from "../../utils/fetch/adminDevelopers";

function statusBadge(status: string) {
  const s = status.toLowerCase();
  if (s === "active") return "bg-emerald-950/55 text-emerald-300 ring-1 ring-emerald-800/40";
  if (s === "pending") return "bg-amber-950/50 text-amber-200 ring-1 ring-amber-800/35";
  if (s === "revoked" || s === "rejected" || s === "suspended")
    return "bg-red-950/40 text-red-300 ring-1 ring-red-900/40";
  return "bg-zinc-800 text-zinc-400 ring-1 ring-zinc-700/50";
}

type Tab = "ceiling" | "keys";

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
  const [tab, setTab] = useState<Tab>("ceiling");
  const [catalog, setCatalog] = useState<AdminScopeCatalogEntry[]>([]);
  const [keys, setKeys] = useState<AdminDeveloperKeyRow[]>([]);
  const [keysLoading, setKeysLoading] = useState(true);
  const [ceiling, setCeiling] = useState<Set<string>>(() => new Set(developer.approvedScopes));
  const [ceilingBusy, setCeilingBusy] = useState(false);
  const [ceilingSaved, setCeilingSaved] = useState(false);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [revealedCopied, setRevealedCopied] = useState(false);

  const [approveKey, setApproveKey] = useState<AdminDeveloperKeyRow | null>(null);
  const [approveScopes, setApproveScopes] = useState<Set<string>>(new Set());
  const [approveRpm, setApproveRpm] = useState("");
  const [approveNote, setApproveNote] = useState("");

  const [editKey, setEditKey] = useState<AdminDeveloperKeyRow | null>(null);
  const [editScopes, setEditScopes] = useState<Set<string>>(new Set());
  const [editRpm, setEditRpm] = useState("");

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
    [catalog],
  );

  const saveCeiling = async () => {
    setCeilingBusy(true);
    try {
      await patchAdminDeveloperProfileScopes(developer.userId, [...ceiling]);
      setCeilingSaved(true);
      setTimeout(() => setCeilingSaved(false), 2000);
      await onReload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Save failed");
    } finally {
      setCeilingBusy(false);
    }
  };

  const openApprove = (k: AdminDeveloperKeyRow) => {
    setApproveKey(k);
    setApproveScopes(new Set(k.requestedScopes));
    setApproveRpm("");
    setApproveNote("");
  };

  const submitApprove = async () => {
    if (!approveKey || approveScopes.size === 0) return;
    setRowBusy(approveKey.id);
    try {
      const rpm = approveRpm.trim() === "" ? null : Math.max(0, parseInt(approveRpm, 10) || 0);
      const res = await approveAdminDeveloperKey(developer.userId, approveKey.id, {
        approvedScopes: [...approveScopes],
        rateLimitPerMinute: rpm,
        note: approveNote || undefined,
      });
      setRevealedSecret(res.secret);
      setApproveKey(null);
      await reloadKeys();
      await onReload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Approve failed");
    } finally {
      setRowBusy(null);
    }
  };

  const submitRejectKey = async (k: AdminDeveloperKeyRow) => {
    if (!confirm("Reject this key request?")) return;
    setRowBusy(k.id);
    try {
      await rejectAdminDeveloperKey(developer.userId, k.id);
      await reloadKeys();
      await onReload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Reject failed");
    } finally {
      setRowBusy(null);
    }
  };

  const openEdit = (k: AdminDeveloperKeyRow) => {
    setEditKey(k);
    setEditScopes(new Set(k.scopes));
    setEditRpm(k.rateLimitPerMinute != null ? String(k.rateLimitPerMinute) : "");
  };

  const saveEdit = async () => {
    if (!editKey || editScopes.size === 0) return;
    setRowBusy(editKey.id);
    try {
      const rpm = editRpm.trim() === "" ? null : Math.max(0, parseInt(editRpm, 10) || 0);
      await patchAdminDeveloperKey(developer.userId, editKey.id, {
        scopes: [...editScopes],
        rateLimitPerMinute: rpm,
      });
      setEditKey(null);
      await reloadKeys();
      await onReload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Save failed");
    } finally {
      setRowBusy(null);
    }
  };

  const doRevoke = async (k: AdminDeveloperKeyRow) => {
    if (!confirm(`Revoke key "${k.name}"?`)) return;
    setRowBusy(k.id);
    try {
      await revokeAdminDeveloperKey(developer.userId, k.id);
      await reloadKeys();
      await onReload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Revoke failed");
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

  const activeIndex = tab === "ceiling" ? 0 : 1;

  const approveKeyFromCatalog = useMemo(
    () => (approveKey ? catalog.filter((c) => approveKey.requestedScopes.includes(c.id)) : []),
    [approveKey, catalog],
  );

  const editKeyFromCatalog = useMemo(
    () => catalogSorted.filter((c) => ceiling.has(c.id)),
    [catalogSorted, ceiling],
  );

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col ring-1 ring-zinc-800/50">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-3 min-w-0">
            <DeveloperDiscordAvatar
              userId={developer.userId}
              username={developer.username}
              avatar={developer.avatar}
              className="h-9 w-9"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-zinc-100 truncate">{developer.username}</span>
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md ${statusBadge(developer.status)}`}
                >
                  {developer.status}
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 font-mono truncate">{developer.userId}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {developer.status === "active" && onProfileSuspend && (
              <button
                type="button"
                disabled={profileActionBusy}
                onClick={() => {
                  onProfileSuspend();
                  onClose();
                }}
                className="px-3 py-1.5 rounded-lg border border-amber-800/60 bg-amber-950/40 text-amber-200 text-xs font-medium hover:bg-amber-950/60 disabled:opacity-50 transition-colors"
              >
                Suspend
              </button>
            )}
            {developer.status !== "active" && onProfileReactivate && (
              <button
                type="button"
                disabled={profileActionBusy}
                onClick={() => {
                  onProfileReactivate();
                  onClose();
                }}
                className="px-3 py-1.5 rounded-lg border border-emerald-800/50 bg-emerald-950/35 text-emerald-200 text-xs font-medium hover:bg-emerald-950/55 disabled:opacity-50 transition-colors"
              >
                Reactivate
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="px-5 pt-4 pb-0">
          <nav
            className="relative flex rounded-full bg-zinc-800/95 p-1 shadow-inner ring-1 ring-zinc-700/60 max-w-xs"
            aria-label="Developer edit sections"
          >
            <div
              className="pointer-events-none absolute top-1 bottom-1 rounded-full bg-linear-to-b from-blue-500 to-blue-700 shadow-md transition-[left,width] duration-300 ease-out"
              style={{
                width: "calc(50% - 0.25rem)",
                left: activeIndex === 0 ? "0.25rem" : "calc(50%)",
              }}
              aria-hidden
            />
            <button
              type="button"
              onClick={() => setTab("ceiling")}
              className={`relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition-colors ${tab === "ceiling" ? "text-white" : "text-zinc-400 hover:text-zinc-200"}`}
            >
              <Shield className="w-3.5 h-3.5" />
              Scope ceiling
            </button>
            <button
              type="button"
              onClick={() => setTab("keys")}
              className={`relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition-colors ${tab === "keys" ? "text-white" : "text-zinc-400 hover:text-zinc-200"}`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              Keys
              {developer.keysPending > 0 && (
                <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-500 text-[9px] font-bold text-black">
                  {developer.keysPending}
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
          {tab === "ceiling" && (
            <div className="space-y-4">
              <p className="text-xs text-zinc-500">
                Scopes checked here are the maximum this developer can assign to their keys.
              </p>
              <ScopeTagSelector catalog={catalog} selected={ceiling} onChange={setCeiling} />
              <button
                type="button"
                disabled={ceilingBusy || ceiling.size === 0}
                onClick={() => void saveCeiling()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-700 hover:bg-cyan-600 disabled:opacity-40 text-white text-sm font-medium transition-colors"
              >
                {ceilingSaved ? (
                  <>
                    <Check className="w-4 h-4" /> Saved
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" /> {ceilingBusy ? "Saving…" : "Save ceiling"}
                  </>
                )}
              </button>
            </div>
          )}

          {tab === "keys" && (
            <div>
              {keysLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                </div>
              ) : keys.length === 0 ? (
                <p className="text-sm text-zinc-500 py-8 text-center">No keys yet.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-zinc-700 ring-1 ring-zinc-800/40">
                  <table className="w-full text-sm text-left min-w-[560px]">
                    <thead className="bg-zinc-950/80 text-zinc-400 text-xs">
                      <tr>
                        <th className="px-3 py-2.5 font-medium">Name</th>
                        <th className="px-3 py-2.5 font-medium">Status</th>
                        <th className="px-3 py-2.5 font-medium">RPM</th>
                        <th className="px-3 py-2.5 font-medium">Last used</th>
                        <th className="px-3 py-2.5 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {keys.map((k) => {
                        const st = k.revokedAt ? "revoked" : (k.status ?? "active");
                        return (
                          <tr
                            key={k.id}
                            className="border-t border-zinc-800/80 text-zinc-200 hover:bg-zinc-800/20"
                          >
                            <td className="px-3 py-2.5">
                              <div className="font-medium text-zinc-100 leading-snug">{k.name}</div>
                              <code className="text-[10px] text-zinc-500">{k.prefix}…</code>
                            </td>
                            <td className="px-3 py-2.5">
                              <span
                                className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md ${statusBadge(st)}`}
                              >
                                {st}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-xs text-zinc-400">
                              {k.rateLimitPerMinute ?? "—"}
                            </td>
                            <td className="px-3 py-2.5 text-xs text-zinc-500 whitespace-nowrap">
                              {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : "—"}
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              {k.revokedAt ? (
                                <span className="text-xs text-zinc-600">Revoked</span>
                              ) : k.status === "pending" ? (
                                <div className="flex gap-1">
                                  <button
                                    type="button"
                                    disabled={rowBusy === k.id}
                                    onClick={() => openApprove(k)}
                                    className="px-2 py-1 rounded-lg bg-emerald-800/80 text-white text-xs hover:bg-emerald-700 transition-colors"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    type="button"
                                    disabled={rowBusy === k.id}
                                    onClick={() => void submitRejectKey(k)}
                                    className="px-2 py-1 rounded-lg bg-zinc-800 text-zinc-200 text-xs hover:bg-zinc-700 transition-colors"
                                  >
                                    Reject
                                  </button>
                                </div>
                              ) : k.status === "active" ? (
                                <div className="flex gap-1">
                                  <button
                                    type="button"
                                    disabled={rowBusy === k.id}
                                    onClick={() => openEdit(k)}
                                    className="px-2 py-1 rounded-lg bg-zinc-800 text-zinc-200 text-xs hover:bg-zinc-700 transition-colors"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    disabled={rowBusy === k.id}
                                    onClick={() => void doRevoke(k)}
                                    className="px-2 py-1 rounded-lg bg-red-950/50 text-red-200 text-xs hover:bg-red-900/60 transition-colors"
                                  >
                                    Revoke
                                  </button>
                                </div>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {onDeleteDeveloper && (
          <div className="px-5 py-3 border-t border-zinc-800 bg-zinc-950/40 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] text-zinc-500 max-w-md leading-relaxed">
              Remove this developer entirely: profile ceiling, keys, past applications, and API
              usage history for the external API.
            </p>
            <button
              type="button"
              disabled={deleteDeveloperBusy}
              onClick={() => void onDeleteDeveloper()}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-red-950/60 text-red-200 text-xs font-semibold border border-red-900/50 hover:bg-red-900/50 disabled:opacity-50 transition-colors shrink-0"
            >
              {deleteDeveloperBusy ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
              ) : (
                <Trash2 className="w-3.5 h-3.5" aria-hidden />
              )}
              Delete developer
            </button>
          </div>
        )}
      </div>

      {/* Approve key sub-modal */}
      {approveKey && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-5 max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-2xl ring-1 ring-zinc-800/50">
            <h4 className="text-base font-semibold text-white mb-0.5">Approve key request</h4>
            <p className="text-xs text-zinc-500 mb-4">{approveKey.name}</p>
            <p className="text-xs text-zinc-400 mb-3">
              Select allowed scopes (subset of what was requested)
            </p>
            <ScopeTagSelector
              catalog={approveKeyFromCatalog}
              selected={approveScopes}
              onChange={setApproveScopes}
            />
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">
                  Rate limit / min (empty = default)
                </label>
                <input
                  value={approveRpm}
                  onChange={(e) => setApproveRpm(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  placeholder="e.g. 120"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Note (optional)</label>
                <textarea
                  value={approveNote}
                  onChange={(e) => setApproveNote(e.target.value)}
                  placeholder="Visible to developer"
                  rows={2}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setApproveKey(null)}
                className="px-3 py-2 rounded-xl text-zinc-400 hover:bg-zinc-800 text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={approveScopes.size === 0 || rowBusy != null}
                onClick={() => void submitApprove()}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium disabled:opacity-40 transition-colors"
              >
                Approve & issue secret
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revealed secret sub-modal */}
      {revealedSecret && (
        <div className="fixed inset-0 z-80 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-emerald-800/50 rounded-2xl p-5 max-w-lg w-full shadow-2xl">
            <h4 className="text-white font-semibold mb-1">Key approved — copy secret now</h4>
            <p className="text-xs text-zinc-500 mb-3">This is shown only once.</p>
            <pre className="text-xs text-emerald-200 break-all bg-black/40 rounded-xl p-3 mb-4 font-mono leading-relaxed">
              {revealedSecret}
            </pre>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void copyRevealed()}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium transition-colors"
              >
                {revealedCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {revealedCopied ? "Copied" : "Copy secret"}
              </button>
              <button
                type="button"
                onClick={() => setRevealedSecret(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-200 text-sm hover:bg-zinc-700 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit key sub-modal */}
      {editKey && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-5 max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-2xl ring-1 ring-zinc-800/50">
            <h4 className="text-base font-semibold text-white mb-0.5">Edit key — {editKey.name}</h4>
            <p className="text-xs text-zinc-500 mb-4">
              Scopes must stay within the profile ceiling.
            </p>
            <ScopeTagSelector
              catalog={editKeyFromCatalog}
              selected={editScopes}
              onChange={setEditScopes}
            />
            <div className="mt-4">
              <label className="block text-xs text-zinc-500 mb-1">
                RPM override (empty = default)
              </label>
              <input
                value={editRpm}
                onChange={(e) => setEditRpm(e.target.value)}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                placeholder="e.g. 60"
              />
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setEditKey(null)}
                className="px-3 py-2 rounded-xl text-zinc-400 hover:bg-zinc-800 text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={editScopes.size === 0 || rowBusy != null}
                onClick={() => void saveEdit()}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium disabled:opacity-40 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}