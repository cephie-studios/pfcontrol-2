import { useEffect, useMemo, useState } from "react";
import {
  MdSave,
  MdVpnKey,
  MdShield,
  MdCheck,
  MdContentCopy,
  MdRefresh,
  MdDelete,
} from "react-icons/md";
import AdminModal from "./AdminModal";
import AdminTable from "./AdminTable";
import DeveloperDiscordAvatar from "./DeveloperDiscordAvatar";
import {
  statusBadgeClass,
  adminDownsizeButtonSize,
  ADMIN_TABLE_HEAD,
  ADMIN_TH,
  ADMIN_TD,
} from "./adminConstants";
import Button from "../common/Button";
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
    [catalog]
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
          onDeleteDeveloper ? (
            <div className="flex flex-wrap items-center justify-between gap-3 w-full mr-auto">
              <p className="text-[11px] text-zinc-500 max-w-md leading-relaxed text-left">
                Remove developer profile, keys, applications, and API usage
                history.
              </p>
              <button
                type="button"
                disabled={deleteDeveloperBusy}
                onClick={() => void onDeleteDeveloper()}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-red-950/60 text-red-200 text-xs font-semibold border border-red-900/50 hover:bg-red-900/50 disabled:opacity-50 transition-colors shrink-0"
              >
                {deleteDeveloperBusy ? (
                  <MdRefresh className="w-3.5 h-3.5 animate-spin" aria-hidden />
                ) : (
                  <MdDelete className="w-3.5 h-3.5" aria-hidden />
                )}
                Delete developer
              </button>
            </div>
          ) : undefined
        }
      >
        <div className="flex items-center justify-between gap-3 mb-4 -mt-1">
          <div className="flex items-center gap-3 min-w-0">
            <DeveloperDiscordAvatar
              userId={developer.userId}
              username={developer.username}
              avatar={developer.avatar}
              className="h-9 w-9"
            />
            <div className="min-w-0">
              <span
                className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md ${statusBadgeClass(developer.status)}`}
              >
                {developer.status}
              </span>
              <p className="text-[11px] text-zinc-500 font-mono truncate mt-1">
                {developer.userId}
              </p>
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
          </div>
        </div>

        <nav
          className="relative flex rounded-full bg-zinc-800/95 p-1 shadow-inner ring-1 ring-zinc-700/60 max-w-xs mb-4"
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
            <MdShield className="w-3.5 h-3.5" />
            Scope ceiling
          </button>
          <button
            type="button"
            onClick={() => setTab("keys")}
            className={`relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition-colors ${tab === "keys" ? "text-white" : "text-zinc-400 hover:text-zinc-200"}`}
          >
            <MdVpnKey className="w-3.5 h-3.5" />
            Keys
            {developer.keysPending > 0 && (
              <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-500 text-[9px] font-bold text-black">
                {developer.keysPending}
              </span>
            )}
          </button>
        </nav>

        {tab === "ceiling" && (
          <div className="space-y-4">
            <p className="text-xs text-zinc-500">
              Scopes checked here are the maximum this developer can assign to
              their keys.
            </p>
            <ScopeTagSelector
              catalog={catalog}
              selected={ceiling}
              onChange={setCeiling}
            />
            <button
              type="button"
              disabled={ceilingBusy || ceiling.size === 0}
              onClick={() => void saveCeiling()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-700 hover:bg-cyan-600 disabled:opacity-40 text-white text-sm font-medium transition-colors"
            >
              {ceilingSaved ? (
                <>
                  <MdCheck className="w-4 h-4" /> Saved
                </>
              ) : (
                <>
                  <MdSave className="w-4 h-4" />{" "}
                  {ceilingBusy ? "Saving…" : "Save ceiling"}
                </>
              )}
            </button>
          </div>
        )}

        {tab === "keys" && (
          <div>
            {keysLoading ? (
              <div className="flex justify-center py-12">
                <MdRefresh className="w-6 h-6 text-blue-400 animate-spin" />
              </div>
            ) : keys.length === 0 ? (
              <p className="text-sm text-zinc-500 py-8 text-center">
                No keys yet.
              </p>
            ) : (
              <AdminTable minWidth="560px">
                <thead className={ADMIN_TABLE_HEAD}>
                  <tr>
                    <th className={ADMIN_TH}>Name</th>
                    <th className={ADMIN_TH}>Status</th>
                    <th className={ADMIN_TH}>RPM</th>
                    <th className={ADMIN_TH}>Last used</th>
                    <th className={ADMIN_TH}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80">
                  {keys.map((k) => {
                    const st = k.revokedAt ? "revoked" : (k.status ?? "active");
                    return (
                      <tr key={k.id} className="hover:bg-zinc-800/20">
                        <td className={ADMIN_TD}>
                          <div className="font-medium text-zinc-100 leading-snug">
                            {k.name}
                          </div>
                          <code className="text-[10px] text-zinc-500">
                            {k.prefix}…
                          </code>
                        </td>
                        <td className={ADMIN_TD}>
                          <span
                            className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md ${statusBadgeClass(st)}`}
                          >
                            {st}
                          </span>
                        </td>
                        <td className={ADMIN_TD}>
                          {k.rateLimitPerMinute ?? "—"}
                        </td>
                        <td className={`${ADMIN_TD} whitespace-nowrap`}>
                          {k.lastUsedAt
                            ? new Date(k.lastUsedAt).toLocaleDateString()
                            : "—"}
                        </td>
                        <td className={`${ADMIN_TD} whitespace-nowrap`}>
                          {k.revokedAt ? (
                            <span className="text-xs text-zinc-600">
                              Revoked
                            </span>
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
                    );
                  })}
                </tbody>
              </AdminTable>
            )}
          </div>
        )}
      </AdminModal>

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
            <p className="text-sm text-zinc-400 mb-4">{approveKey.name}</p>
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
                <label className="block text-xs text-zinc-500 mb-1">
                  Note (optional)
                </label>
                <textarea
                  value={approveNote}
                  onChange={(e) => setApproveNote(e.target.value)}
                  placeholder="Visible to developer"
                  rows={2}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none"
                />
              </div>
            </div>
          </>
        )}
      </AdminModal>

      <AdminModal
        open={!!revealedSecret}
        onClose={() => setRevealedSecret(null)}
        title="Key approved — copy secret now"
        size="md"
        footer={
          <>
            <Button
              type="button"
              variant="primary"
              size={adminDownsizeButtonSize("sm")}
              onClick={() => void copyRevealed()}
              className="flex-1 !bg-emerald-700 hover:!bg-emerald-600"
            >
              {revealedCopied ? (
                <MdCheck className="w-4 h-4 inline mr-1" />
              ) : (
                <MdContentCopy className="w-4 h-4 inline mr-1" />
              )}
              {revealedCopied ? "Copied" : "Copy secret"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size={adminDownsizeButtonSize("sm")}
              onClick={() => setRevealedSecret(null)}
            >
              Done
            </Button>
          </>
        }
      >
        <p className="text-xs text-zinc-500 mb-3">This is shown only once.</p>
        <pre className="text-xs text-emerald-200 break-all bg-black/40 rounded-xl p-3 font-mono leading-relaxed">
          {revealedSecret}
        </pre>
      </AdminModal>

      <AdminModal
        open={!!editKey}
        onClose={() => setEditKey(null)}
        title={editKey ? `Edit key — ${editKey.name}` : "Edit key"}
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
          </>
        )}
      </AdminModal>
    </>
  );
}
