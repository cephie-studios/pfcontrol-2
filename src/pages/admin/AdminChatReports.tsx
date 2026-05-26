import { useState, useEffect } from "react";
import {
  MdReport,
  MdVisibility,
  MdDelete,
  MdBlock,
  MdOpenInNew,
  MdTaskAlt,
} from "react-icons/md";
import AdminRefreshButton from "../../components/admin/AdminRefreshButton";
import AdminLayout from "../../components/admin/AdminLayout";
import AdminModal from "../../components/admin/AdminModal";
import AdminPageHeader from "../../components/admin/AdminPageHeader";
import AdminToolbar from "../../components/admin/AdminToolbar";
import AdminSearchInput from "../../components/admin/AdminSearchInput";
import AdminTable from "../../components/admin/AdminTable";
import {
  adminDownsizeButtonSize,
  ADMIN_TH,
  ADMIN_TD,
  ADMIN_TABLE_HEAD,
} from "../../components/admin/adminConstants";
import Loader from "../../components/common/Loader";
import Button from "../../components/common/Button";
import Dropdown from "../../components/common/Dropdown";
import {
  fetchChatReports,
  updateChatReportStatus,
  deleteChatReport,
  type ChatReport,
} from "../../utils/fetch/admin";
import ErrorScreen from "../../components/common/ErrorScreen";

export default function AdminChatReports() {
  const [reports, setReports] = useState<ChatReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [filterReporter, setFilterReporter] = useState<string>("all");
  const [selectedReport, setSelectedReport] = useState<ChatReport | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  const filterOptions = [
    { value: "all", label: "All Reports" },
    { value: "automod", label: "Automod Only" },
    { value: "user", label: "User Reports Only" },
  ];

  useEffect(() => {
    fetchReports();
  }, [page, filterReporter]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchChatReports(
        page,
        limit,
        filterReporter === "all" ? undefined : filterReporter
      );
      setReports(data.reports);
      setTotalPages(data.pagination.pages);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch reports";
      setError(errorMessage);
      setToast({ message: errorMessage, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleViewReport = (report: ChatReport) => {
    setSelectedReport(report);
    setShowModal(true);
  };

  const handleDismissReport = async (reportId: number) => {
    if (!confirm("Are you sure you want to dismiss this report?")) return;
    try {
      await deleteChatReport(reportId);
      setToast({ message: "Report dismissed", type: "success" });
      fetchReports();
    } catch {
      setToast({ message: "Failed to dismiss report", type: "error" });
    }
  };

  const handleMarkResolved = async (reportId: number) => {
    try {
      await updateChatReportStatus(reportId, "resolved");
      setToast({ message: "Report marked as resolved", type: "success" });
      fetchReports();
    } catch {
      setToast({ message: "Failed to update report", type: "error" });
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const filteredReports = reports.filter(
    (r) =>
      !search ||
      r.message.toLowerCase().includes(search.toLowerCase()) ||
      r.reported_user_id.includes(search)
  );

  const btnSize = adminDownsizeButtonSize("sm");

  return (
    <AdminLayout toast={toast} onToastClose={() => setToast(null)}>
      <AdminPageHeader title="Chat Reports" icon={MdReport} accent="red" />

      <AdminToolbar>
        <AdminSearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by message or user…"
          loading={loading}
        />
        <Dropdown
          options={filterOptions}
          value={filterReporter}
          onChange={setFilterReporter}
          placeholder="Filter by reporter…"
          size="sm"
        />
        <AdminRefreshButton onClick={fetchReports} loading={loading} />
      </AdminToolbar>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader />
        </div>
      ) : error ? (
        <ErrorScreen
          title="Error loading reports"
          message={error}
          onRetry={fetchReports}
        />
      ) : (
        <>
          <div className="hidden lg:block">
            <AdminTable minWidth="800px">
              <thead className={ADMIN_TABLE_HEAD}>
                <tr>
                  <th className={ADMIN_TH}>Reporter</th>
                  <th className={ADMIN_TH}>Reported User</th>
                  <th className={ADMIN_TH}>Message</th>
                  <th className={ADMIN_TH}>Reason</th>
                  <th className={ADMIN_TH}>Status</th>
                  <th className={ADMIN_TH}>Timestamp</th>
                  <th className={ADMIN_TH}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredReports.map((report) => (
                  <tr
                    key={report.id}
                    className="border-t border-zinc-800/60 hover:bg-zinc-800/30"
                  >
                    <td className={ADMIN_TD}>
                      <div className="flex items-center gap-2">
                        <img
                          src={
                            report.avatar || "/assets/app/default/avatar.webp"
                          }
                          alt={
                            report.reporter_user_id === "automod"
                              ? "Automod"
                              : report.reporter_username ||
                                report.reporter_user_id
                          }
                          className="w-7 h-7 rounded-full"
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="text-white font-medium truncate">
                            {report.reporter_user_id === "automod"
                              ? "Automod"
                              : report.reporter_username || "Unknown"}
                          </span>
                          {report.reporter_user_id !== "automod" && (
                            <span className="text-zinc-500 text-xs truncate">
                              {report.reporter_user_id}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className={ADMIN_TD}>
                      <div className="flex items-center gap-2">
                        <img
                          src={
                            report.reported_avatar ||
                            "/assets/app/default/avatar.webp"
                          }
                          alt={
                            report.reported_username || report.reported_user_id
                          }
                          className="w-7 h-7 rounded-full"
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="text-white font-medium truncate">
                            {report.reported_username || "Unknown"}
                          </span>
                          <span className="text-zinc-500 text-xs truncate">
                            {report.reported_user_id}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className={`${ADMIN_TD} max-w-xs truncate`}>
                      {report.message}
                    </td>
                    <td className={ADMIN_TD}>{report.reason}</td>
                    <td className={ADMIN_TD}>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs ${
                          report.status === "resolved"
                            ? "bg-green-500/20 text-green-400"
                            : "bg-yellow-500/20 text-yellow-400"
                        }`}
                      >
                        {report.status || "pending"}
                      </span>
                    </td>
                    <td className={ADMIN_TD}>
                      {formatTimestamp(report.created_at)}
                    </td>
                    <td className={ADMIN_TD}>
                      <div className="flex items-center gap-1">
                        <Button
                          size={btnSize}
                          variant="ghost"
                          onClick={() => handleViewReport(report)}
                        >
                          <MdVisibility size={16} />
                        </Button>
                        <Button
                          size={btnSize}
                          variant="success"
                          onClick={() => handleMarkResolved(report.id)}
                        >
                          <MdTaskAlt size={16} />
                        </Button>
                        <Button
                          size={btnSize}
                          variant="danger"
                          onClick={() => handleDismissReport(report.id)}
                        >
                          <MdDelete size={16} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </AdminTable>
          </div>

          <div className="lg:hidden">
            {filteredReports.map((report) => (
              <div
                key={report.id}
                className="py-3 border-b border-zinc-800/80 last:border-b-0 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <img
                    src={report.avatar || "/assets/app/default/avatar.webp"}
                    alt={
                      report.reporter_user_id === "automod"
                        ? "Automod"
                        : report.reporter_username || report.reporter_user_id
                    }
                    className="w-7 h-7 rounded-full"
                  />
                  <div className="min-w-0">
                    <p className="text-white font-medium text-sm truncate">
                      {report.reporter_user_id === "automod"
                        ? "Automod"
                        : report.reporter_username || "Unknown"}
                    </p>
                    {report.reporter_user_id !== "automod" && (
                      <p className="text-zinc-500 text-xs truncate">
                        {report.reporter_user_id}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <img
                    src={
                      report.reported_avatar ||
                      "/assets/app/default/avatar.webp"
                    }
                    alt={report.reported_username || report.reported_user_id}
                    className="w-7 h-7 rounded-full"
                  />
                  <div className="min-w-0">
                    <p className="text-white font-medium text-sm truncate">
                      {report.reported_username || "Unknown"}
                    </p>
                    <p className="text-zinc-500 text-xs truncate">
                      {report.reported_user_id}
                    </p>
                  </div>
                </div>

                <p className="text-zinc-300 text-sm">
                  <span className="text-zinc-500">Message:</span>{" "}
                  {report.message}
                </p>
                <p className="text-zinc-300 text-sm">
                  <span className="text-zinc-500">Reason:</span> {report.reason}
                </p>

                <div className="flex justify-between items-center">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs ${
                      report.status === "resolved"
                        ? "bg-green-500/20 text-green-400"
                        : "bg-yellow-500/20 text-yellow-400"
                    }`}
                  >
                    {report.status || "pending"}
                  </span>
                  <p className="text-zinc-500 text-xs">
                    {formatTimestamp(report.created_at)}
                  </p>
                </div>

                <div className="flex gap-1">
                  <Button
                    size={btnSize}
                    variant="ghost"
                    onClick={() => handleViewReport(report)}
                  >
                    <MdVisibility size={16} />
                  </Button>
                  <Button
                    size={btnSize}
                    variant="success"
                    onClick={() => handleMarkResolved(report.id)}
                  >
                    <MdTaskAlt size={16} />
                  </Button>
                  <Button
                    size={btnSize}
                    variant="danger"
                    onClick={() => handleDismissReport(report.id)}
                  >
                    <MdDelete size={16} />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <AdminToolbar className="justify-center mt-4">
            <Button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              variant="outline"
              size={btnSize}
            >
              Previous
            </Button>
            <span className="text-zinc-500 text-sm px-2">
              Page {page} of {totalPages}
            </span>
            <Button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              variant="outline"
              size={btnSize}
            >
              Next
            </Button>
          </AdminToolbar>
        </>
      )}

      <AdminModal
        open={showModal && !!selectedReport}
        onClose={() => setShowModal(false)}
        title="Report Details"
        size="lg"
        footer={
          selectedReport ? (
            <>
              <Button
                onClick={() => {
                  setShowModal(false);
                  window.location.href = `/admin/bans?userId=${selectedReport.reported_user_id}&username=${encodeURIComponent(selectedReport.reported_username || "")}&reason=${encodeURIComponent(selectedReport.reason)}`;
                }}
                variant="danger"
                size={adminDownsizeButtonSize("md")}
              >
                <MdBlock size={16} className="mr-2" /> Ban User
              </Button>
              <Button
                onClick={() => handleMarkResolved(selectedReport.id)}
                variant="primary"
                size={adminDownsizeButtonSize("md")}
              >
                Mark Resolved
              </Button>
            </>
          ) : undefined
        }
      >
        {selectedReport && (
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <img
                src={selectedReport.avatar || "/assets/app/default/avatar.webp"}
                alt={
                  selectedReport.reporter_user_id === "automod"
                    ? "Automod"
                    : selectedReport.reporter_username ||
                      selectedReport.reporter_user_id
                }
                className="w-10 h-10 rounded-full"
              />
              <p>
                <strong>Reporter:</strong>{" "}
                {selectedReport.reporter_user_id === "automod"
                  ? "Automod"
                  : `${selectedReport.reporter_username || "Unknown"} (${selectedReport.reporter_user_id})`}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <img
                src={
                  selectedReport.reported_avatar ||
                  "/assets/app/default/avatar.webp"
                }
                alt={
                  selectedReport.reported_username ||
                  selectedReport.reported_user_id
                }
                className="w-10 h-10 rounded-full"
              />
              <p>
                <strong>Reported User:</strong>{" "}
                {selectedReport.reported_username || "Unknown"} (
                {selectedReport.reported_user_id})
              </p>
            </div>
            <p>
              <strong>Message:</strong> {selectedReport.message}
            </p>
            <p>
              <strong>Reason:</strong> {selectedReport.reason}
            </p>
            <p>
              <strong>Session:</strong>{" "}
              <a
                href={`/admin/sessions?search=${selectedReport.session_id}`}
                className="text-blue-400"
              >
                {selectedReport.session_id}{" "}
                <MdOpenInNew size={16} className="inline" />
              </a>
            </p>
            <p>
              <strong>Timestamp:</strong>{" "}
              {formatTimestamp(selectedReport.created_at)}
            </p>
          </div>
        )}
      </AdminModal>
    </AdminLayout>
  );
}