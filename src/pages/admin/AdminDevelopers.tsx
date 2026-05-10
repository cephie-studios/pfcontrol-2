import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  Menu,
  RefreshCw,
  Users,
  Inbox,
  KeyRound,
  Clock,
  Pencil,
  Trash2,
} from "lucide-react";

const REFRESH_ICON_MIN_SPIN_MS = 500;
import Navbar from "../../components/Navbar";
import AdminSidebar from "../../components/admin/AdminSidebar";
import AdminDeveloperEditModal from "../../components/admin/AdminDeveloperEditModal";
import AdminDeveloperApplicationReviewModal from "../../components/admin/AdminDeveloperApplicationReviewModal";
import DeveloperDiscordAvatar from "../../components/admin/DeveloperDiscordAvatar";
import Loader from "../../components/common/Loader";
import {
  fetchAdminDeveloperApplications,
  fetchAdminDevelopers,
  approveDeveloperApplication,
  rejectDeveloperApplication,
  suspendDeveloperProfile,
  reactivateDeveloperProfile,
  deleteAdminDeveloperAccount,
  type AdminDeveloperApplication,
  type AdminDeveloperSummary,
} from "../../utils/fetch/adminDevelopers";

type Tab = "applications" | "developers";

const APP_FILTERS = ["pending", "approved", "rejected", "all"] as const;
type AppFilter = (typeof APP_FILTERS)[number];

const APP_FILTER_LABEL: Record<AppFilter, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  all: "All",
};

function statusBadgeClass(status: string) {
  const s = status.toLowerCase();
  if (s === "active" || s === "approved")
    return "bg-emerald-950/55 text-emerald-300 ring-2 ring-emerald-800/40";
  if (s === "pending") return "bg-amber-950/50 text-amber-200 ring-1 ring-amber-800/35";
  if (s === "rejected" || s === "suspended")
    return "bg-red-950/40 text-red-300 ring-1 ring-red-900/40";
  return "bg-zinc-800 text-zinc-400 ring-1 ring-zinc-700/50";
}

function FilterPills({ value, onChange }: { value: AppFilter; onChange: (v: AppFilter) => void }) {
  const activeIndex = APP_FILTERS.indexOf(value);
  const idx = activeIndex >= 0 ? activeIndex : 0;
  const n = APP_FILTERS.length;
  return (
    <div
      className="relative flex w-full max-w-sm rounded-full bg-zinc-800/95 p-1 shadow-inner ring-1 ring-zinc-700/60"
      role="tablist"
      aria-label="Application status"
    >
      <div
        className="pointer-events-none absolute top-1 bottom-1 rounded-full bg-linear-to-b from-blue-500 to-blue-700 shadow-md transition-[left,width] duration-300 ease-out"
        style={{
          width: `calc((100% - 0.5rem) / ${n})`,
          left: `calc(0.25rem + ${idx} * ((100% - 0.5rem) / ${n}))`,
        }}
        aria-hidden
      />
      {APP_FILTERS.map((f) => (
        <button
          key={f}
          type="button"
          role="tab"
          aria-selected={value === f}
          onClick={() => onChange(f)}
          className={`relative z-10 flex-1 min-w-0 px-1.5 py-2 rounded-full text-xs font-semibold transition-colors sm:text-sm sm:px-2 ${
            value === f ? "text-white" : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          {APP_FILTER_LABEL[f]}
        </button>
      ))}
    </div>
  );
}

export default function AdminDevelopers() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("applications");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applications, setApplications] = useState<AdminDeveloperApplication[]>([]);
  const [appTotal, setAppTotal] = useState(0);
  const [appFilter, setAppFilter] = useState<AppFilter>("pending");
  const [developers, setDevelopers] = useState<AdminDeveloperSummary[]>([]);
  const [rejectNote, setRejectNote] = useState("");
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | string | null>(null);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [reviewApp, setReviewApp] = useState<AdminDeveloperApplication | null>(null);
  const [refreshIconBusy, setRefreshIconBusy] = useState(false);
  const loadSeqRef = useRef(0);
  const refreshIconClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (opts?: { headerRefresh?: boolean }) => {
      const showHeaderRefresh = opts?.headerRefresh === true;
      let seq = 0;
      let spinStartedAt = 0;
      if (showHeaderRefresh) {
        if (refreshIconClearTimerRef.current) {
          clearTimeout(refreshIconClearTimerRef.current);
          refreshIconClearTimerRef.current = null;
        }
        seq = ++loadSeqRef.current;
        spinStartedAt = Date.now();
        setRefreshIconBusy(true);
      }
      setLoading(true);
      setError(null);
      try {
        const [appRes, devRes] = await Promise.all([
          fetchAdminDeveloperApplications({
            status: appFilter === "all" ? undefined : appFilter,
            page: 1,
            limit: 50,
          }),
          fetchAdminDevelopers(),
        ]);
        setApplications(appRes.applications);
        setAppTotal(appRes.total);
        setDevelopers(devRes.developers);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
        if (showHeaderRefresh) {
          const wait = Math.max(0, REFRESH_ICON_MIN_SPIN_MS - (Date.now() - spinStartedAt));
          refreshIconClearTimerRef.current = setTimeout(() => {
            refreshIconClearTimerRef.current = null;
            if (loadSeqRef.current === seq) {
              setRefreshIconBusy(false);
            }
          }, wait);
        }
      }
    },
    [appFilter],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(
    () => () => {
      if (refreshIconClearTimerRef.current) {
        clearTimeout(refreshIconClearTimerRef.current);
        refreshIconClearTimerRef.current = null;
      }
    },
    [],
  );

  const editDeveloper = useMemo(
    () => developers.find((d) => d.userId === editUserId) ?? null,
    [developers, editUserId],
  );

  const handleApproveFromReview = async (
    appId: number,
    body: {
      approvedScopes: string[];
      rateLimitPerMinute?: number | null;
      note?: string;
    },
  ) => {
    setBusyId(appId);
    try {
      await approveDeveloperApplication(appId, body);
      setReviewApp(null);
      await load();
    } catch (e) {
      throw e instanceof Error ? e : new Error("Approve failed");
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async () => {
    if (rejectId == null) return;
    setBusyId(rejectId);
    try {
      await rejectDeveloperApplication(rejectId, rejectNote);
      setRejectId(null);
      setRejectNote("");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Reject failed");
    } finally {
      setBusyId(null);
    }
  };

  const handleSuspend = async (userId: string) => {
    if (!confirm("Suspend this developer? Their API keys will stop working.")) return;
    setBusyId(userId);
    try {
      await suspendDeveloperProfile(userId);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Suspend failed");
    } finally {
      setBusyId(null);
    }
  };

  const handleReactivate = async (userId: string) => {
    setBusyId(userId);
    try {
      await reactivateDeveloperProfile(userId);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Reactivate failed");
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteDeveloper = async (userId: string) => {
    if (
      !confirm(
        "Permanently delete this developer? This removes their developer profile, all API keys, application history, and developer API usage logs. The user account itself is not deleted.",
      )
    )
      return;
    setBusyId(userId);
    try {
      await deleteAdminDeveloperAccount(userId);
      setEditUserId((cur) => (cur === userId ? null : cur));
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusyId(null);
    }
  };

  const tabActiveIndex = tab === "applications" ? 0 : 1;

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      <Navbar />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <AdminSidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        <main className="flex-1 min-h-0 overflow-y-scroll overflow-x-hidden pt-24 [scrollbar-gutter:stable]">
          <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/80">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="p-2 rounded-lg text-zinc-300 hover:bg-zinc-800"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-sm font-medium text-zinc-200">Developers</span>
            <span className="w-9" />
          </div>
          {mobileSidebarOpen && (
            <div className="lg:hidden fixed inset-0 z-50 flex">
              <button
                type="button"
                className="flex-1 bg-black/60"
                aria-label="Close menu"
                onClick={() => setMobileSidebarOpen(false)}
              />
              <div className="w-64 bg-black border-l border-zinc-800">
                <AdminSidebar />
              </div>
            </div>
          )}

          <div className="p-6 max-w-6xl mx-auto pb-16">
            {/* Page header */}
            <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
              <div>
                <h1 className="text-3xl font-bold text-white tracking-tight">
                  Developers Management
                </h1>
                <p className="text-sm text-zinc-500 mt-1 max-w-xl">
                  Review applications, set scope ceilings, and manage API keys per developer.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void load({ headerRefresh: true })}
                aria-busy={refreshIconBusy}
                className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-700 bg-zinc-900/60 text-zinc-200 hover:bg-zinc-800 text-sm ring-1 ring-zinc-800/50 transition-colors disabled:opacity-60 disabled:pointer-events-none"
                disabled={refreshIconBusy}
              >
                {refreshIconBusy ? (
                  <Loader2 className="w-4 h-4 shrink-0 animate-spin text-blue-400" aria-hidden />
                ) : (
                  <RefreshCw className="w-4 h-4 shrink-0" aria-hidden />
                )}
                Refresh
              </button>
            </div>

            {/* Main tab switcher */}
            <div className="mb-7 max-w-xs">
              <nav
                className="relative flex rounded-full bg-zinc-800/95 p-1 shadow-inner ring-1 ring-zinc-700/60"
                aria-label="Developer admin sections"
              >
                <div
                  className="pointer-events-none absolute top-1 bottom-1 rounded-full bg-linear-to-b from-blue-500 to-blue-700 shadow-md transition-[left,width] duration-300 ease-out"
                  style={{
                    width: "calc(50% - 0.25rem)",
                    left: tabActiveIndex === 0 ? "0.25rem" : "calc(50%)",
                  }}
                  aria-hidden
                />
                <button
                  type="button"
                  onClick={() => setTab("applications")}
                  className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-sm font-semibold transition-colors ${
                    tab === "applications" ? "text-white" : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <Inbox className="w-4 h-4 opacity-90" />
                  Applications
                </button>
                <button
                  type="button"
                  onClick={() => setTab("developers")}
                  className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-sm font-semibold transition-colors ${
                    tab === "developers" ? "text-white" : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <Users className="w-4 h-4 opacity-90" />
                  Developers
                </button>
              </nav>
            </div>

            {error && (
              <div className="mb-6 rounded-2xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-red-200 text-sm ring-1 ring-red-900/30">
                {error}
              </div>
            )}

            {loading ? (
              <div className="flex justify-center py-24">
                <Loader />
              </div>
            ) : tab === "applications" ? (
              /* ── Applications tab ── */
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <FilterPills value={appFilter} onChange={setAppFilter} />
                  <p className="text-sm text-zinc-500 shrink-0">
                    <span className="text-zinc-300 font-medium tabular-nums">{appTotal}</span>{" "}
                    matching
                  </p>
                </div>

                {applications.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/30 px-6 py-16 text-center ring-1 ring-zinc-800/40">
                    <Inbox className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
                    <p className="text-zinc-400 font-medium">No applications</p>
                    <p className="text-sm text-zinc-600 mt-1">Try another status filter.</p>
                  </div>
                ) : (
                  <ul className="grid gap-4 sm:grid-cols-1 xl:grid-cols-2">
                    {applications.map((a) => (
                      <li
                        key={a.id}
                        className="rounded-2xl border border-zinc-700/80 bg-zinc-900/40 p-5 ring-1 ring-zinc-800/45 flex flex-col"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-zinc-100 truncate">{a.username}</p>
                            <p className="text-[11px] text-zinc-500 font-mono truncate mt-0.5">
                              {a.userId}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-lg ${statusBadgeClass(a.status)}`}
                          >
                            {a.status}
                          </span>
                        </div>
                        <div className="mt-4 space-y-3">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mb-1">
                              Who
                            </p>
                            <p className="text-sm text-zinc-300 leading-relaxed line-clamp-3">
                              {a.whoText}
                            </p>
                          </div>
                          {a.whyText?.trim() && (
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mb-1">
                                Why
                              </p>
                              <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2">
                                {a.whyText}
                              </p>
                            </div>
                          )}
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mb-2">
                              Requested scopes
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {a.requestedScopes.map((s) => (
                                <span
                                  key={s}
                                  className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-950/80 text-zinc-400 border border-zinc-800"
                                >
                                  {s}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                        {a.status === "pending" && (
                          <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-zinc-800/90">
                            <button
                              type="button"
                              disabled={busyId === a.id}
                              onClick={() => setReviewApp(a)}
                              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium disabled:opacity-50 transition-colors"
                            >
                              Review &amp; approve
                            </button>
                            <button
                              type="button"
                              disabled={busyId === a.id}
                              onClick={() => setRejectId(a.id)}
                              className="px-4 py-2 rounded-xl border border-zinc-600 bg-zinc-800/80 text-zinc-200 text-sm font-medium hover:bg-zinc-800 disabled:opacity-50 transition-colors"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              /* ── Developers tab ── */
              <div>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs text-zinc-500 uppercase tracking-wide font-semibold">
                    {developers.length} developer
                    {developers.length !== 1 ? "s" : ""}
                  </p>
                </div>

                {developers.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/30 px-4 py-16 text-center ring-1 ring-zinc-800/40">
                    <Users className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
                    <p className="text-zinc-400 font-medium">No developer profiles yet.</p>
                  </div>
                ) : (
                  <>
                    {/* Desktop table */}
                    <div className="hidden md:block rounded-2xl border border-zinc-700/50 bg-zinc-900 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[700px] text-sm">
                          <thead className="bg-zinc-800/80 text-zinc-400 text-xs">
                            <tr>
                              <th className="px-5 py-3.5 text-left font-medium">Developer</th>
                              <th className="px-4 py-3.5 text-left font-medium">Status</th>
                              <th className="px-4 py-3.5 text-left font-medium">Keys</th>
                              <th className="px-4 py-3.5 text-left font-medium">Last activity</th>
                              <th className="px-4 py-3.5 text-right font-medium">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {developers.map((d) => (
                              <tr
                                key={d.userId}
                                className="border-t border-zinc-700/50 hover:bg-zinc-800/40 transition-colors"
                              >
                                <td className="px-5 py-3.5">
                                  <div className="flex items-center gap-3">
                                    <DeveloperDiscordAvatar
                                      userId={d.userId}
                                      username={d.username}
                                      avatar={d.avatar}
                                    />
                                    <div className="min-w-0">
                                      <p className="font-medium text-zinc-100 truncate">
                                        {d.username}
                                      </p>
                                      <p className="text-[11px] text-zinc-500 font-mono truncate">
                                        {d.userId}
                                      </p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3.5">
                                  <span
                                    className={`text-[10px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-lg ${statusBadgeClass(d.status)}`}
                                  >
                                    {d.status}
                                  </span>
                                </td>
                                <td className="px-4 py-3.5">
                                  <div className="flex items-center gap-2 text-xs">
                                    <span className="flex items-center gap-1 text-emerald-400/90">
                                      <KeyRound className="w-3 h-3" />
                                      {d.keysActive}
                                    </span>
                                    {d.keysPending > 0 && (
                                      <span className="text-amber-400/90 flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                        {d.keysPending} pending
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3.5">
                                  <span className="flex items-center gap-1 text-xs text-zinc-500">
                                    <Clock className="w-3 h-3" />
                                    {d.lastApiActivity
                                      ? new Date(d.lastApiActivity).toLocaleDateString()
                                      : "—"}
                                  </span>
                                </td>
                                <td className="px-4 py-3.5 text-right">
                                  <div className="flex flex-wrap justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setEditUserId(d.userId)}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-200 text-xs hover:bg-zinc-700 transition-colors border border-zinc-700"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      disabled={busyId === d.userId}
                                      onClick={() => void handleDeleteDeveloper(d.userId)}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-950/50 text-red-200 text-xs hover:bg-red-900/55 transition-colors border border-red-900/50 disabled:opacity-50"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      Delete
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Mobile cards */}
                    <ul className="md:hidden space-y-3">
                      {developers.map((d) => (
                        <li
                          key={d.userId}
                          className="rounded-2xl border border-zinc-700/50 bg-zinc-900 p-4"
                        >
                          <div className="flex items-center gap-3 mb-3">
                            <DeveloperDiscordAvatar
                              userId={d.userId}
                              username={d.username}
                              avatar={d.avatar}
                              className="h-9 w-9"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-zinc-100 truncate">{d.username}</p>
                              <p className="text-[11px] text-zinc-500 font-mono truncate">
                                {d.userId}
                              </p>
                            </div>
                            <span
                              className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md ${statusBadgeClass(d.status)}`}
                            >
                              {d.status}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 text-xs text-zinc-500">
                              <span className="flex items-center gap-1 text-emerald-400/90">
                                <KeyRound className="w-3 h-3" />
                                {d.keysActive} active
                              </span>
                              {d.keysPending > 0 && (
                                <span className="text-amber-400/90">{d.keysPending} pending</span>
                              )}
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => setEditUserId(d.userId)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-200 text-xs hover:bg-zinc-700 transition-colors border border-zinc-700"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                Edit
                              </button>
                              <button
                                type="button"
                                disabled={busyId === d.userId}
                                onClick={() => void handleDeleteDeveloper(d.userId)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-950/50 text-red-200 text-xs hover:bg-red-900/55 transition-colors border border-red-900/50 disabled:opacity-50"
                                aria-label="Delete developer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {reviewApp && (
        <AdminDeveloperApplicationReviewModal
          application={reviewApp}
          busy={busyId === reviewApp.id}
          onClose={() => setReviewApp(null)}
          onApprove={(body) => handleApproveFromReview(reviewApp.id, body)}
          onRequestReject={() => {
            setRejectId(reviewApp.id);
            setReviewApp(null);
          }}
        />
      )}

      {/* Reject application modal */}
      {rejectId != null && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-md w-full shadow-2xl ring-1 ring-zinc-800/60">
            <h3 className="text-base font-semibold text-white mb-1">Reject application</h3>
            <p className="text-xs text-zinc-500 mb-4">
              Optional note is stored for the applicant and audit trail.
            </p>
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="Optional note to the applicant"
              rows={3}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 mb-5 focus:outline-none focus:ring-2 focus:ring-zinc-600/40 resize-none"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setRejectId(null);
                  setRejectNote("");
                }}
                className="px-4 py-2 rounded-xl text-zinc-400 hover:bg-zinc-800 text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleReject()}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Developer edit modal */}
      {editUserId && editDeveloper && (
        <AdminDeveloperEditModal
          developer={editDeveloper}
          onReload={load}
          onClose={() => setEditUserId(null)}
          onProfileSuspend={() => void handleSuspend(editDeveloper.userId)}
          onProfileReactivate={() => void handleReactivate(editDeveloper.userId)}
          profileActionBusy={busyId === editDeveloper.userId}
          onDeleteDeveloper={() => void handleDeleteDeveloper(editDeveloper.userId)}
          deleteDeveloperBusy={busyId === editDeveloper.userId}
        />
      )}
    </div>
  );
}