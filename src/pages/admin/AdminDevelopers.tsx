import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MdVpnKey, MdSchedule, MdEdit, MdDelete, MdCode } from "react-icons/md";

const REFRESH_ICON_MIN_SPIN_MS = 500;
const APPLICATIONS_FETCH_LIMIT = 100;

import AdminRefreshButton from "../../components/admin/AdminRefreshButton";
import AdminLayout from "../../components/admin/AdminLayout";
import AdminModal from "../../components/admin/AdminModal";
import AdminPageHeader from "../../components/admin/AdminPageHeader";
import AdminToolbar from "../../components/admin/AdminToolbar";
import AdminSearchInput from "../../components/admin/AdminSearchInput";
import AdminStatStrip from "../../components/admin/AdminStatStrip";
import AdminTable from "../../components/admin/AdminTable";
import AdminDeveloperEditModal from "../../components/admin/AdminDeveloperEditModal";
import AdminDeveloperApplicationReviewModal from "../../components/admin/AdminDeveloperApplicationReviewModal";
import DeveloperDiscordAvatar from "../../components/admin/DeveloperDiscordAvatar";
import {
  adminDownsizeButtonSize,
  ADMIN_TABLE_HEAD,
  ADMIN_TH,
  ADMIN_TD,
  statusBadgeClass,
} from "../../components/admin/adminConstants";
import Loader from "../../components/common/Loader";
import Button from "../../components/common/Button";
import Dropdown from "../../components/common/Dropdown";
import ErrorScreen from "../../components/common/ErrorScreen";
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

type Section = "applications" | "developers";

const APP_FILTERS = ["pending", "approved", "rejected", "all"] as const;
type AppFilter = (typeof APP_FILTERS)[number];

const sectionOptions = [
  { value: "applications", label: "Applications" },
  { value: "developers", label: "Developers" },
];

const appFilterOptions = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All statuses" },
];

export default function AdminDevelopers() {
  const [section, setSection] = useState<Section>("applications");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applications, setApplications] = useState<AdminDeveloperApplication[]>(
    []
  );
  const [appFilter, setAppFilter] = useState<AppFilter>("pending");
  const [appSearch, setAppSearch] = useState("");
  const [devSearch, setDevSearch] = useState("");
  const [developers, setDevelopers] = useState<AdminDeveloperSummary[]>([]);
  const [rejectNote, setRejectNote] = useState("");
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | string | null>(null);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [reviewApp, setReviewApp] = useState<AdminDeveloperApplication | null>(
    null
  );
  const [refreshIconBusy, setRefreshIconBusy] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);
  const loadSeqRef = useRef(0);
  const refreshIconClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const load = useCallback(
    async (opts?: { headerRefresh?: boolean; initial?: boolean }) => {
      const showPageLoader = opts?.initial === true;
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
      if (showPageLoader) {
        setLoading(true);
      }
      setError(null);

      try {
        const [appRes, devRes] = await Promise.all([
          fetchAdminDeveloperApplications({
            page: 1,
            limit: APPLICATIONS_FETCH_LIMIT,
          }),
          fetchAdminDevelopers(),
        ]);
        setApplications(appRes.applications);
        setDevelopers(devRes.developers);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to load";
        setError(message);
        setToast({ message, type: "error" });
      } finally {
        if (showPageLoader) {
          setLoading(false);
        }
        if (showHeaderRefresh) {
          const wait = Math.max(
            0,
            REFRESH_ICON_MIN_SPIN_MS - (Date.now() - spinStartedAt)
          );
          refreshIconClearTimerRef.current = setTimeout(() => {
            refreshIconClearTimerRef.current = null;
            if (loadSeqRef.current === seq) {
              setRefreshIconBusy(false);
            }
          }, wait);
        }
      }
    },
    []
  );

  useEffect(() => {
    void load({ initial: true });
  }, [load]);

  useEffect(
    () => () => {
      if (refreshIconClearTimerRef.current) {
        clearTimeout(refreshIconClearTimerRef.current);
        refreshIconClearTimerRef.current = null;
      }
    },
    []
  );

  const appCounts = useMemo(() => {
    const pending = applications.filter((a) => a.status === "pending").length;
    const approved = applications.filter((a) => a.status === "approved").length;
    const rejected = applications.filter((a) => a.status === "rejected").length;
    return { pending, approved, rejected, total: applications.length };
  }, [applications]);

  const filteredApplications = useMemo(() => {
    const q = appSearch.trim().toLowerCase();
    return applications.filter((a) => {
      if (appFilter !== "all" && a.status !== appFilter) return false;
      if (!q) return true;
      return (
        a.username.toLowerCase().includes(q) ||
        a.userId.toLowerCase().includes(q) ||
        a.whoText.toLowerCase().includes(q) ||
        (a.whyText?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [applications, appFilter, appSearch]);

  const filteredDevelopers = useMemo(() => {
    const q = devSearch.trim().toLowerCase();
    if (!q) return developers;
    return developers.filter(
      (d) =>
        d.username.toLowerCase().includes(q) ||
        d.userId.toLowerCase().includes(q)
    );
  }, [developers, devSearch]);

  const editDeveloper = useMemo(
    () => developers.find((d) => d.userId === editUserId) ?? null,
    [developers, editUserId]
  );

  const btnSize = adminDownsizeButtonSize("sm");

  const handleApproveFromReview = async (
    appId: number,
    body: {
      approvedScopes: string[];
      rateLimitPerMinute?: number | null;
      note?: string;
    }
  ) => {
    setBusyId(appId);
    try {
      await approveDeveloperApplication(appId, body);
      setReviewApp(null);
      setToast({ message: "Application approved", type: "success" });
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
      setToast({ message: "Application rejected", type: "success" });
      await load();
    } catch (e) {
      setToast({
        message: e instanceof Error ? e.message : "Reject failed",
        type: "error",
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleSuspend = async (userId: string) => {
    if (!confirm("Suspend this developer? Their API keys will stop working."))
      return;
    setBusyId(userId);
    try {
      await suspendDeveloperProfile(userId);
      setToast({ message: "Developer suspended", type: "success" });
      await load();
    } catch (e) {
      setToast({
        message: e instanceof Error ? e.message : "Suspend failed",
        type: "error",
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleReactivate = async (userId: string) => {
    setBusyId(userId);
    try {
      await reactivateDeveloperProfile(userId);
      setToast({ message: "Developer reactivated", type: "success" });
      await load();
    } catch (e) {
      setToast({
        message: e instanceof Error ? e.message : "Reactivate failed",
        type: "error",
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteDeveloper = async (userId: string) => {
    if (
      !confirm(
        "Permanently delete this developer? This removes their developer profile, all API keys, application history, and developer API usage logs. The user account itself is not deleted."
      )
    )
      return;
    setBusyId(userId);
    try {
      await deleteAdminDeveloperAccount(userId);
      setEditUserId((cur) => (cur === userId ? null : cur));
      setToast({ message: "Developer deleted", type: "success" });
      await load();
    } catch (e) {
      setToast({
        message: e instanceof Error ? e.message : "Delete failed",
        type: "error",
      });
    } finally {
      setBusyId(null);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <AdminLayout toast={toast} onToastClose={() => setToast(null)}>
      <AdminPageHeader
        title="Developers"
        icon={MdCode}
        accent="blue"
        actions={
          <AdminRefreshButton
            onClick={() => void load({ headerRefresh: true })}
            loading={refreshIconBusy}
          />
        }
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader />
        </div>
      ) : error ? (
        <ErrorScreen
          title="Error loading developers"
          message={error}
          onRetry={() => void load({ initial: true })}
        />
      ) : (
        <>
          <AdminStatStrip
            columns={4}
            items={[
              { label: "Pending", value: appCounts.pending },
              { label: "Approved", value: appCounts.approved },
              { label: "Rejected", value: appCounts.rejected },
              {
                label: "Active developers",
                value: developers.filter((d) => d.status === "active").length,
                sub: `${developers.length} total profiles`,
              },
            ]}
          />

          <AdminToolbar>
            <Dropdown
              options={sectionOptions}
              value={section}
              onChange={(v) => setSection(v as Section)}
              size="sm"
            />
            {section === "applications" ? (
              <>
                <Dropdown
                  options={appFilterOptions}
                  value={appFilter}
                  onChange={(v) => setAppFilter(v as AppFilter)}
                  size="sm"
                />
                <AdminSearchInput
                  value={appSearch}
                  onChange={setAppSearch}
                  placeholder="Search applications…"
                  grow
                />
              </>
            ) : (
              <AdminSearchInput
                value={devSearch}
                onChange={setDevSearch}
                placeholder="Search developers…"
                grow
              />
            )}
          </AdminToolbar>

          {section === "applications" ? (
            <>
              <div className="hidden lg:block">
                <AdminTable minWidth="960px">
                  <thead className={ADMIN_TABLE_HEAD}>
                    <tr>
                      <th className={ADMIN_TH}>Applicant</th>
                      <th className={ADMIN_TH}>Status</th>
                      <th className={ADMIN_TH}>Who / why</th>
                      <th className={ADMIN_TH}>Requested scopes</th>
                      <th className={ADMIN_TH}>Submitted</th>
                      <th className={`${ADMIN_TH} text-right`}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/80">
                    {filteredApplications.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className={`${ADMIN_TD} text-center text-zinc-500 py-12`}
                        >
                          No applications match this filter.
                        </td>
                      </tr>
                    ) : (
                      filteredApplications.map((a) => (
                        <tr
                          key={a.id}
                          className="hover:bg-zinc-800/30 align-top"
                        >
                          <td className={ADMIN_TD}>
                            <p className="font-medium text-zinc-100 truncate">
                              {a.username}
                            </p>
                            <p className="text-[11px] text-zinc-500 font-mono truncate mt-0.5">
                              {a.userId}
                            </p>
                          </td>
                          <td className={ADMIN_TD}>
                            <span
                              className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md ${statusBadgeClass(a.status)}`}
                            >
                              {a.status}
                            </span>
                          </td>
                          <td className={`${ADMIN_TD} max-w-xs`}>
                            <p className="text-sm text-zinc-300 line-clamp-2">
                              {a.whoText}
                            </p>
                            {a.whyText?.trim() && (
                              <p className="text-xs text-zinc-500 line-clamp-1 mt-1">
                                {a.whyText}
                              </p>
                            )}
                          </td>
                          <td className={ADMIN_TD}>
                            <div className="flex flex-wrap gap-1 max-w-[220px]">
                              {a.requestedScopes.map((s) => (
                                <span
                                  key={s}
                                  className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-950/80 text-zinc-400 border border-zinc-800"
                                >
                                  {s}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td
                            className={`${ADMIN_TD} text-zinc-400 text-sm whitespace-nowrap`}
                          >
                            {formatDate(a.createdAt)}
                          </td>
                          <td className={`${ADMIN_TD} text-right`}>
                            {a.status === "pending" ? (
                              <div className="flex flex-wrap justify-end gap-1.5">
                                <Button
                                  type="button"
                                  variant="success"
                                  size={btnSize}
                                  disabled={busyId === a.id}
                                  onClick={() => setReviewApp(a)}
                                >
                                  Review
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size={btnSize}
                                  disabled={busyId === a.id}
                                  onClick={() => setRejectId(a.id)}
                                >
                                  Reject
                                </Button>
                              </div>
                            ) : (
                              <span className="text-xs text-zinc-600">—</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </AdminTable>
              </div>

              <ul className="lg:hidden space-y-3">
                {filteredApplications.length === 0 ? (
                  <li className="text-center py-10 text-zinc-500 text-sm">
                    No applications match this filter.
                  </li>
                ) : (
                  filteredApplications.map((a) => (
                    <li
                      key={a.id}
                      className="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-4"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <p className="font-medium text-zinc-100 truncate">
                            {a.username}
                          </p>
                          <p className="text-[11px] text-zinc-500 font-mono truncate">
                            {a.userId}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md ${statusBadgeClass(a.status)}`}
                        >
                          {a.status}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-400 line-clamp-2">
                        {a.whoText}
                      </p>
                      <p className="text-xs text-zinc-600 mt-2">
                        {formatDate(a.createdAt)}
                      </p>
                      {a.status === "pending" && (
                        <div className="flex gap-2 mt-3 pt-3 border-t border-zinc-800/80">
                          <Button
                            type="button"
                            variant="success"
                            size={btnSize}
                            disabled={busyId === a.id}
                            onClick={() => setReviewApp(a)}
                            className="flex-1"
                          >
                            Review
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size={btnSize}
                            disabled={busyId === a.id}
                            onClick={() => setRejectId(a.id)}
                            className="flex-1"
                          >
                            Reject
                          </Button>
                        </div>
                      )}
                    </li>
                  ))
                )}
              </ul>
            </>
          ) : (
            <>
              <div className="hidden md:block">
                <AdminTable minWidth="700px">
                  <thead className={ADMIN_TABLE_HEAD}>
                    <tr>
                      <th className={ADMIN_TH}>Developer</th>
                      <th className={ADMIN_TH}>Status</th>
                      <th className={ADMIN_TH}>Keys</th>
                      <th className={ADMIN_TH}>Last activity</th>
                      <th className={`${ADMIN_TH} text-right`}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/80">
                    {filteredDevelopers.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className={`${ADMIN_TD} text-center text-zinc-500 py-12`}
                        >
                          No developer profiles found.
                        </td>
                      </tr>
                    ) : (
                      filteredDevelopers.map((d) => (
                        <tr key={d.userId} className="hover:bg-zinc-800/30">
                          <td className={ADMIN_TD}>
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
                          <td className={ADMIN_TD}>
                            <span
                              className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md ${statusBadgeClass(d.status)}`}
                            >
                              {d.status}
                            </span>
                          </td>
                          <td className={ADMIN_TD}>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="flex items-center gap-1 text-emerald-400/90">
                                <MdVpnKey className="w-3 h-3" />
                                {d.keysActive}
                              </span>
                              {d.keysPending > 0 && (
                                <span className="text-amber-400/90">
                                  {d.keysPending} pending
                                </span>
                              )}
                            </div>
                          </td>
                          <td className={ADMIN_TD}>
                            <span className="flex items-center gap-1 text-xs text-zinc-500">
                              <MdSchedule className="w-3 h-3" />
                              {d.lastApiActivity
                                ? new Date(
                                    d.lastApiActivity
                                  ).toLocaleDateString()
                                : "—"}
                            </span>
                          </td>
                          <td className={`${ADMIN_TD} text-right`}>
                            <div className="flex flex-wrap justify-end gap-1.5">
                              <Button
                                type="button"
                                variant="outline"
                                size={btnSize}
                                onClick={() => setEditUserId(d.userId)}
                              >
                                <MdEdit className="w-3.5 h-3.5 inline mr-1" />
                                Edit
                              </Button>
                              <Button
                                type="button"
                                variant="danger"
                                size={btnSize}
                                disabled={busyId === d.userId}
                                onClick={() =>
                                  void handleDeleteDeveloper(d.userId)
                                }
                              >
                                <MdDelete className="w-3.5 h-3.5 inline mr-1" />
                                Delete
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </AdminTable>
              </div>

              <ul className="md:hidden space-y-3">
                {filteredDevelopers.length === 0 ? (
                  <li className="text-center py-10 text-zinc-500 text-sm">
                    No developer profiles found.
                  </li>
                ) : (
                  filteredDevelopers.map((d) => (
                    <li
                      key={d.userId}
                      className="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-4"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <DeveloperDiscordAvatar
                          userId={d.userId}
                          username={d.username}
                          avatar={d.avatar}
                          className="h-9 w-9"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-zinc-100 truncate">
                            {d.username}
                          </p>
                          <p className="text-[11px] text-zinc-500 font-mono truncate">
                            {d.userId}
                          </p>
                        </div>
                        <span
                          className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md ${statusBadgeClass(d.status)}`}
                        >
                          {d.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-xs text-zinc-500">
                          <span className="flex items-center gap-1 text-emerald-400/90">
                            <MdVpnKey className="w-3 h-3" />
                            {d.keysActive} active
                          </span>
                          {d.keysPending > 0 && (
                            <span className="text-amber-400/90">
                              {d.keysPending} pending
                            </span>
                          )}
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <Button
                            type="button"
                            variant="outline"
                            size={btnSize}
                            onClick={() => setEditUserId(d.userId)}
                          >
                            <MdEdit className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            size={btnSize}
                            disabled={busyId === d.userId}
                            onClick={() => void handleDeleteDeveloper(d.userId)}
                            aria-label="Delete developer"
                          >
                            <MdDelete className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </>
          )}
        </>
      )}

      {reviewApp && (
        <AdminDeveloperApplicationReviewModal
          open
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

      <AdminModal
        open={rejectId != null}
        onClose={() => {
          setRejectId(null);
          setRejectNote("");
        }}
        title="Reject application"
        size="sm"
        footer={
          <>
            <Button
              type="button"
              variant="ghost"
              size={btnSize}
              onClick={() => {
                setRejectId(null);
                setRejectNote("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size={btnSize}
              onClick={() => void handleReject()}
            >
              Reject
            </Button>
          </>
        }
      >
        <p className="text-xs text-zinc-500 mb-4">
          Optional note is stored for the applicant and audit trail.
        </p>
        <textarea
          value={rejectNote}
          onChange={(e) => setRejectNote(e.target.value)}
          placeholder="Optional note to the applicant"
          rows={3}
          className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-600/40 resize-none"
        />
      </AdminModal>

      {editUserId && editDeveloper && (
        <AdminDeveloperEditModal
          developer={editDeveloper}
          onReload={load}
          onClose={() => setEditUserId(null)}
          onProfileSuspend={() => void handleSuspend(editDeveloper.userId)}
          onProfileReactivate={() =>
            void handleReactivate(editDeveloper.userId)
          }
          profileActionBusy={busyId === editDeveloper.userId}
          onDeleteDeveloper={() =>
            void handleDeleteDeveloper(editDeveloper.userId)
          }
          deleteDeveloperBusy={busyId === editDeveloper.userId}
        />
      )}
    </AdminLayout>
  );
}