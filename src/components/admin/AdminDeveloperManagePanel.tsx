import { useEffect, useMemo, useState } from "react";
import { KeyRound, Save, Shield } from "lucide-react";
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

type Props = {
  developer: AdminDeveloperSummary;
  onReload: () => Promise<void>;
  onProfileSuspend?: () => void;
  onProfileReactivate?: () => void;
  profileActionBusy?: boolean;
};

export default function AdminDeveloperManagePanel({
  developer,
  onReload,
  onProfileSuspend,
  onProfileReactivate,
  profileActionBusy,
}: Props) {
  const [catalog, setCatalog] = useState<AdminScopeCatalogEntry[]>([]);
  const [keys, setKeys] = useState<AdminDeveloperKeyRow[]>([]);
  const [keysLoading, setKeysLoading] = useState(true);
  const [ceiling, setCeiling] = useState<Set<string>>(() => new Set(developer.approvedScopes));
  const [ceilingBusy, setCeilingBusy] = useState(false);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [approveKey, setApproveKey] = useState<AdminDeveloperKeyRow | null>(null);
  const [approveScopes, setApproveScopes] = useState<Set<string>>(new Set());
  const [approveRpm, setApproveRpm] = useState("");
  const [approveNote, setApproveNote] = useState("");
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
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
    [catalog],
  );

  const scopeGroups = useMemo(() => {
    const m = new Map<string, AdminScopeCatalogEntry[]>();
    for (const c of catalogSorted) {
      const prefix = c.id.split(".")[0] ?? "other";
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
    setApproveRpm("");
    setApproveNote("");
    setRevealedSecret(null);
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
      const kr = await fetchAdminDeveloperKeys(developer.userId);
      setKeys(kr.keys);
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
      const kr = await fetchAdminDeveloperKeys(developer.userId);
      setKeys(kr.keys);
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
      const kr = await fetchAdminDeveloperKeys(developer.userId);
      setKeys(kr.keys);
      await onReload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Save failed");
    } finally {
      setRowBusy(null);
    }
  };

  const doRevoke = async (k: AdminDeveloperKeyRow) => {
    if (!confirm(`Revoke key “${k.name}”?`)) return;
    setRowBusy(k.id);
    try {
      await revokeAdminDeveloperKey(developer.userId, k.id);
      const kr = await fetchAdminDeveloperKeys(developer.userId);
      setKeys(kr.keys);
      await onReload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Revoke failed");
    } finally {
      setRowBusy(null);
    }
  };

  return (
    <div className="space-y-6 rounded-2xl border border-zinc-700 bg-zinc-900/50 p-5 shadow-inner ring-1 ring-zinc-800/45">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-zinc-200 min-w-0">
          <Shield className="w-5 h-5 text-cyan-400 shrink-0" />
          <div>
            <h3 className="font-semibold text-zinc-50">Scope ceiling & keys</h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              {developer.username} · {developer.keysActive} usable · {developer.keysPending} pending
              · {developer.keysTotal} total
            </p>
          </div>
        </div>
        {(onProfileSuspend || onProfileReactivate) && (
          <div className="flex shrink-0 gap-2">
            {developer.status === "active" && onProfileSuspend && (
              <button
                type="button"
                disabled={profileActionBusy}
                onClick={() => onProfileSuspend()}
                className="px-3 py-1.5 rounded-xl border border-amber-800/60 bg-amber-950/40 text-amber-200 text-xs font-medium hover:bg-amber-950/60 disabled:opacity-50"
              >
                Suspend
              </button>
            )}
            {developer.status !== "active" && onProfileReactivate && (
              <button
                type="button"
                disabled={profileActionBusy}
                onClick={() => onProfileReactivate()}
                className="px-3 py-1.5 rounded-xl border border-emerald-800/50 bg-emerald-950/35 text-emerald-200 text-xs font-medium hover:bg-emerald-950/55 disabled:opacity-50"
              >
                Reactivate
              </button>
            )}
          </div>
        )}
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 mb-3">
          Allowed scopes (max per developer)
        </p>
        <div className="max-h-56 overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-950/50 p-3 space-y-3 shadow-inner ring-1 ring-zinc-800/40">
          {scopeGroups.map(([group, entries]) => (
            <div key={group}>
              <p className="text-[11px] font-semibold text-zinc-500 mb-1.5 capitalize">{group}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {entries.map((s) => (
                  <label
                    key={s.id}
                    className="flex items-start gap-2 rounded-lg border border-zinc-800/80 bg-zinc-900/60 px-2 py-1.5 cursor-pointer hover:border-zinc-600"
                  >
                    <input
                      type="checkbox"
                      checked={ceiling.has(s.id)}
                      onChange={() => toggleCeiling(s.id)}
                      className="mt-0.5 rounded border-zinc-600"
                    />
                    <span>
                      <span className="text-xs font-medium text-zinc-200 block">{s.label}</span>
                      <span className="text-[10px] text-zinc-500 leading-snug line-clamp-2">
                        {s.description}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          disabled={ceilingBusy || ceiling.size === 0}
          onClick={() => void saveCeiling()}
          className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-700 hover:bg-cyan-600 disabled:opacity-40 text-white text-sm font-medium"
        >
          <Save className="w-4 h-4" />
          Save ceiling
        </button>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <KeyRound className="w-4 h-4 text-zinc-400" />
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">API keys</p>
        </div>
        {keysLoading ? (
          <p className="text-sm text-zinc-500 py-6">Loading keys…</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-700 shadow-inner ring-1 ring-zinc-800/40">
            <table className="w-full text-sm text-left min-w-[640px]">
              <thead className="bg-zinc-950 text-zinc-400 text-xs">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Scopes</th>
                  <th className="px-3 py-2">RPM</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id} className="border-t border-zinc-800/90 text-zinc-200">
                    <td className="px-3 py-2">
                      <div className="font-medium">{k.name}</div>
                      <code className="text-[10px] text-zinc-500">{k.prefix}</code>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-md ${
                          k.status === "active"
                            ? "bg-emerald-950/60 text-emerald-300"
                            : k.status === "pending"
                              ? "bg-amber-950/60 text-amber-200"
                              : "bg-zinc-800 text-zinc-400"
                        }`}
                      >
                        {k.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-zinc-400 max-w-[200px]">
                      {(k.status === "pending" ? k.requestedScopes : k.scopes)
                        .slice(0, 4)
                        .join(", ")}
                      {(k.status === "pending" ? k.requestedScopes : k.scopes).length > 4
                        ? "…"
                        : ""}
                    </td>
                    <td className="px-3 py-2 text-xs text-zinc-400">
                      {k.rateLimitPerMinute ?? "—"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {k.revokedAt ? (
                        <span className="text-xs text-zinc-600">Revoked</span>
                      ) : k.status === "pending" ? (
                        <div className="flex gap-1">
                          <button
                            type="button"
                            disabled={rowBusy === k.id}
                            onClick={() => openApprove(k)}
                            className="px-2 py-1 rounded-lg bg-emerald-800/80 text-white text-xs hover:bg-emerald-700"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={rowBusy === k.id}
                            onClick={() => void submitRejectKey(k)}
                            className="px-2 py-1 rounded-lg bg-zinc-800 text-zinc-200 text-xs hover:bg-zinc-700"
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
                            className="px-2 py-1 rounded-lg bg-zinc-800 text-zinc-200 text-xs hover:bg-zinc-700"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={rowBusy === k.id}
                            onClick={() => void doRevoke(k)}
                            className="px-2 py-1 rounded-lg bg-red-950/50 text-red-200 text-xs hover:bg-red-900/60"
                          >
                            Revoke
                          </button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {keys.length === 0 && (
              <p className="text-sm text-zinc-500 px-3 py-6 text-center">No keys.</p>
            )}
          </div>
        )}
      </div>

      {approveKey && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-5 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <h4 className="text-lg font-semibold text-white mb-1">Approve key request</h4>
            <p className="text-xs text-zinc-500 mb-4">{approveKey.name}</p>
            <p className="text-xs text-zinc-400 mb-2">
              Select allowed scopes (subset of requested)
            </p>
            <div className="space-y-1 max-h-48 overflow-y-auto mb-4">
              {approveKey.requestedScopes.map((id) => {
                const label = catalog.find((c) => c.id === id)?.label ?? id;
                return (
                  <label key={id} className="flex items-center gap-2 text-sm text-zinc-200">
                    <input
                      type="checkbox"
                      checked={approveScopes.has(id)}
                      onChange={() =>
                        setApproveScopes((prev) => {
                          const n = new Set(prev);
                          if (n.has(id)) n.delete(id);
                          else n.add(id);
                          return n;
                        })
                      }
                    />
                    {label}
                  </label>
                );
              })}
            </div>
            <label className="block text-xs text-zinc-500 mb-1">
              Rate limit / min (empty = default)
            </label>
            <input
              value={approveRpm}
              onChange={(e) => setApproveRpm(e.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 mb-3"
              placeholder="e.g. 120"
            />
            <textarea
              value={approveNote}
              onChange={(e) => setApproveNote(e.target.value)}
              placeholder="Optional note"
              rows={2}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setApproveKey(null)}
                className="px-3 py-2 rounded-xl text-zinc-400 hover:bg-zinc-800 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={approveScopes.size === 0 || rowBusy != null}
                onClick={() => void submitApprove()}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium disabled:opacity-40"
              >
                Approve & issue secret
              </button>
            </div>
          </div>
        </div>
      )}

      {revealedSecret && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4">
          <div className="bg-zinc-900 border border-emerald-800/50 rounded-2xl p-5 max-w-lg w-full">
            <h4 className="text-white font-semibold mb-2">Key secret (copy now)</h4>
            <pre className="text-xs text-emerald-200 break-all bg-black/40 rounded-xl p-3 mb-4">
              {revealedSecret}
            </pre>
            <button
              type="button"
              onClick={() => setRevealedSecret(null)}
              className="w-full py-2 rounded-xl bg-zinc-800 text-zinc-200 text-sm"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {editKey && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-5 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h4 className="text-lg font-semibold text-white mb-3">Edit active key</h4>
            <p className="text-xs text-zinc-500 mb-3">
              Scopes must stay within the profile ceiling.
            </p>
            <div className="space-y-1 max-h-52 overflow-y-auto mb-4">
              {catalogSorted
                .filter((c) => ceiling.has(c.id))
                .map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm text-zinc-200">
                    <input
                      type="checkbox"
                      checked={editScopes.has(c.id)}
                      onChange={() =>
                        setEditScopes((prev) => {
                          const n = new Set(prev);
                          if (n.has(c.id)) n.delete(c.id);
                          else n.add(c.id);
                          return n;
                        })
                      }
                    />
                    {c.label}
                  </label>
                ))}
            </div>
            <label className="text-xs text-zinc-500">RPM override (empty = default)</label>
            <input
              value={editRpm}
              onChange={(e) => setEditRpm(e.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditKey(null)}
                className="px-3 py-2 rounded-xl text-zinc-400 hover:bg-zinc-800 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={editScopes.size === 0 || rowBusy != null}
                onClick={() => void saveEdit()}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium"
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