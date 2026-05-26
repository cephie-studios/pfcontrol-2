import { useEffect, useMemo, useState } from "react";
import { MdVpnKey, MdSave, MdShield } from "react-icons/md";
import AdminModal from "./AdminModal";
import AdminTable from "./AdminTable";
import AdminSectionTitle from "./AdminSectionTitle";
import {
  adminDownsizeButtonSize,
  adminSectionClass,
  ADMIN_TABLE_HEAD,
  ADMIN_TH,
  ADMIN_TD,
  statusBadgeClass,
} from "./adminConstants";
import Button from "../common/Button";
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
  const [ceiling, setCeiling] = useState<Set<string>>(
    () => new Set(developer.approvedScopes)
  );
  const [ceilingBusy, setCeilingBusy] = useState(false);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [approveKey, setApproveKey] = useState<AdminDeveloperKeyRow | null>(
    null
  );
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
    [catalog]
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
      const rpm =
        approveRpm.trim() === ""
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
    setEditRpm(
      k.rateLimitPerMinute != null ? String(k.rateLimitPerMinute) : ""
    );
  };

  const saveEdit = async () => {
    if (!editKey || editScopes.size === 0) return;
    setRowBusy(editKey.id);
    try {
      const rpm =
        editRpm.trim() === "" ? null : Math.max(0, parseInt(editRpm, 10) || 0);
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
    <div className="space-y-0">
      <div className={adminSectionClass("!mt-0 !pt-0 !border-t-0")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-zinc-200 min-w-0">
            <MdShield className="w-5 h-5 text-cyan-400 shrink-0" />
            <div>
              <AdminSectionTitle className="!mb-0">
                Scope ceiling & keys
              </AdminSectionTitle>
              <p className="text-xs text-zinc-500 mt-0.5">
                {developer.username} · {developer.keysActive} usable ·{" "}
                {developer.keysPending} pending · {developer.keysTotal} total
              </p>
            </div>
          </div>
          {(onProfileSuspend || onProfileReactivate) && (
            <div className="flex shrink-0 gap-2">
              {developer.status === "active" && onProfileSuspend && (
                <Button
                  type="button"
                  variant="outline"
                  size={adminDownsizeButtonSize("xs")}
                  disabled={profileActionBusy}
                  onClick={() => onProfileSuspend()}
                  className="!border-amber-800/60 !text-amber-200"
                >
                  Suspend
                </Button>
              )}
              {developer.status !== "active" && onProfileReactivate && (
                <Button
                  type="button"
                  variant="outline"
                  size={adminDownsizeButtonSize("xs")}
                  disabled={profileActionBusy}
                  onClick={() => onProfileReactivate()}
                  className="!border-emerald-800/50 !text-emerald-200"
                >
                  Reactivate
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className={adminSectionClass()}>
        <AdminSectionTitle>
          Allowed scopes (max per developer)
        </AdminSectionTitle>
        <div className="max-h-56 overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-950/50 p-3 space-y-3 shadow-inner ring-1 ring-zinc-800/40">
          {scopeGroups.map(([group, entries]) => (
            <div key={group}>
              <p className="text-[11px] font-semibold text-zinc-500 mb-1.5 capitalize">
                {group}
              </p>
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
                      className="mt-0.5 accent-blue-600 rounded border-zinc-600"
                    />
                    <span>
                      <span className="text-xs font-medium text-zinc-200 block">
                        {s.label}
                      </span>
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
        <Button
          type="button"
          size={adminDownsizeButtonSize("sm")}
          disabled={ceilingBusy || ceiling.size === 0}
          onClick={() => void saveCeiling()}
          className="mt-3 inline-flex items-center gap-2"
        >
          <MdSave className="w-4 h-4" />
          Save ceiling
        </Button>
      </div>

      <div className={adminSectionClass()}>
        <div className="flex items-center gap-2 mb-3">
          <MdVpnKey className="w-4 h-4 text-zinc-400" />
          <AdminSectionTitle className="!mb-0">API keys</AdminSectionTitle>
        </div>
        {keysLoading ? (
          <p className="text-sm text-zinc-500 py-6">Loading keys…</p>
        ) : (
          <AdminTable minWidth="640px">
            <thead className={ADMIN_TABLE_HEAD}>
              <tr>
                <th className={ADMIN_TH}>Name</th>
                <th className={ADMIN_TH}>Status</th>
                <th className={ADMIN_TH}>Scopes</th>
                <th className={ADMIN_TH}>RPM</th>
                <th className={ADMIN_TH}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80">
              {keys.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className={`${ADMIN_TD} py-6 text-center text-zinc-500`}
                  >
                    No keys.
                  </td>
                </tr>
              ) : (
                keys.map((k) => (
                  <tr key={k.id} className="hover:bg-zinc-800/20">
                    <td className={ADMIN_TD}>
                      <div className="font-medium">{k.name}</div>
                      <code className="text-[10px] text-zinc-500">
                        {k.prefix}
                      </code>
                    </td>
                    <td className={ADMIN_TD}>
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-md ${statusBadgeClass(k.status ?? "active")}`}
                      >
                        {k.status}
                      </span>
                    </td>
                    <td
                      className={`${ADMIN_TD} text-xs text-zinc-400 max-w-[200px]`}
                    >
                      {(k.status === "pending" ? k.requestedScopes : k.scopes)
                        .slice(0, 4)
                        .join(", ")}
                      {(k.status === "pending" ? k.requestedScopes : k.scopes)
                        .length > 4
                        ? "…"
                        : ""}
                    </td>
                    <td className={`${ADMIN_TD} text-xs text-zinc-400`}>
                      {k.rateLimitPerMinute ?? "—"}
                    </td>
                    <td className={`${ADMIN_TD} whitespace-nowrap`}>
                      {k.revokedAt ? (
                        <span className="text-xs text-zinc-600">Revoked</span>
                      ) : k.status === "pending" ? (
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            variant="primary"
                            size={adminDownsizeButtonSize("xs")}
                            disabled={rowBusy === k.id}
                            onClick={() => openApprove(k)}
                            className="!bg-emerald-800/80 hover:!bg-emerald-700"
                          >
                            Approve
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size={adminDownsizeButtonSize("xs")}
                            disabled={rowBusy === k.id}
                            onClick={() => void submitRejectKey(k)}
                          >
                            Reject
                          </Button>
                        </div>
                      ) : k.status === "active" ? (
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size={adminDownsizeButtonSize("xs")}
                            disabled={rowBusy === k.id}
                            onClick={() => openEdit(k)}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            size={adminDownsizeButtonSize("xs")}
                            disabled={rowBusy === k.id}
                            onClick={() => void doRevoke(k)}
                          >
                            Revoke
                          </Button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </AdminTable>
        )}
      </div>

      <AdminModal
        open={!!approveKey}
        onClose={() => setApproveKey(null)}
        title="Approve key request"
        size="md"
        footer={
          <>
            <Button
              type="button"
              variant="ghost"
              size={adminDownsizeButtonSize("sm")}
              onClick={() => setApproveKey(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size={adminDownsizeButtonSize("sm")}
              disabled={approveScopes.size === 0 || rowBusy != null}
              onClick={() => void submitApprove()}
              className="!bg-emerald-600 hover:!bg-emerald-500"
            >
              Approve & issue secret
            </Button>
          </>
        }
      >
        {approveKey && (
          <>
            <p className="text-xs text-zinc-500 mb-4">{approveKey.name}</p>
            <p className="text-xs text-zinc-400 mb-2">
              Select allowed scopes (subset of requested)
            </p>
            <div className="space-y-1 max-h-48 overflow-y-auto mb-4">
              {approveKey.requestedScopes.map((id) => {
                const label = catalog.find((c) => c.id === id)?.label ?? id;
                return (
                  <label
                    key={id}
                    className="flex items-center gap-2 text-sm text-zinc-200"
                  >
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
          </>
        )}
      </AdminModal>

      <AdminModal
        open={!!revealedSecret}
        onClose={() => setRevealedSecret(null)}
        title="Key secret (copy now)"
        size="md"
        footer={
          <Button
            type="button"
            variant="outline"
            size={adminDownsizeButtonSize("sm")}
            onClick={() => setRevealedSecret(null)}
            className="w-full"
          >
            Done
          </Button>
        }
      >
        <pre className="text-xs text-emerald-200 break-all bg-black/40 rounded-xl p-3">
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
              variant="ghost"
              size={adminDownsizeButtonSize("sm")}
              onClick={() => setEditKey(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size={adminDownsizeButtonSize("sm")}
              disabled={editScopes.size === 0 || rowBusy != null}
              onClick={() => void saveEdit()}
            >
              Save
            </Button>
          </>
        }
      >
        {editKey && (
          <>
            <p className="text-xs text-zinc-500 mb-3">
              Scopes must stay within the profile ceiling.
            </p>
            <div className="space-y-1 max-h-52 overflow-y-auto mb-4">
              {catalogSorted
                .filter((c) => ceiling.has(c.id))
                .map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-2 text-sm text-zinc-200"
                  >
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
            <label className="text-xs text-zinc-500">
              RPM override (empty = default)
            </label>
            <input
              value={editRpm}
              onChange={(e) => setEditRpm(e.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 mb-4"
            />
          </>
        )}
      </AdminModal>
    </div>
  );
}