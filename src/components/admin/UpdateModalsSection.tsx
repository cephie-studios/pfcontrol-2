import { useState, useEffect } from "react";
import {
  MdCampaign,
  MdAdd,
  MdEdit,
  MdDelete,
  MdSend,
  MdVisibilityOff,
  MdUpload,
} from "react-icons/md";
import AdminModal from "./AdminModal";
import AdminTable from "./AdminTable";
import AdminSectionTitle from "./AdminSectionTitle";
import AdminToolbar from "./AdminToolbar";
import {
  adminDownsizeButtonSize,
  ADMIN_TABLE_HEAD,
  ADMIN_TH,
  ADMIN_TD,
  statusBadgeClass,
} from "./adminConstants";
import Button from "../common/Button";
import Toast from "../common/Toast";
import Loader from "../common/Loader";
import TextInput from "../common/TextInput";
import MDEditor from "@uiw/react-md-editor";
import {
  fetchAllUpdateModals,
  createUpdateModal,
  updateUpdateModal,
  deleteUpdateModal,
  publishUpdateModal,
  unpublishUpdateModal,
  type UpdateModal,
} from "../../utils/fetch/admin/updateModals";

export default function UpdateModalsSection() {
  const [modals, setModals] = useState<UpdateModal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingModal, setEditingModal] = useState<UpdateModal | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    content: "",
    banner_url: "",
  });

  useEffect(() => {
    fetchModals();
  }, []);

  const fetchModals = async () => {
    try {
      setLoading(true);
      const data = await fetchAllUpdateModals();
      setModals(data);
    } catch (err) {
      setToast({
        message:
          err instanceof Error ? err.message : "Failed to fetch update modals",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.title || !formData.content) {
      setToast({ message: "Title and content are required", type: "error" });
      return;
    }

    try {
      await createUpdateModal(formData);
      setToast({
        message: "Update modal created successfully",
        type: "success",
      });
      setShowAddModal(false);
      resetForm();
      fetchModals();
    } catch (err) {
      setToast({
        message:
          err instanceof Error ? err.message : "Failed to create update modal",
        type: "error",
      });
    }
  };

  const handleUpdate = async () => {
    if (!editingModal) return;
    if (!formData.title || !formData.content) {
      setToast({ message: "Title and content are required", type: "error" });
      return;
    }

    try {
      await updateUpdateModal(editingModal.id, formData);
      setToast({
        message: "Update modal updated successfully",
        type: "success",
      });
      setEditingModal(null);
      resetForm();
      fetchModals();
    } catch (err) {
      setToast({
        message:
          err instanceof Error ? err.message : "Failed to update update modal",
        type: "error",
      });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this update modal?")) return;

    try {
      await deleteUpdateModal(id);
      setToast({
        message: "Update modal deleted successfully",
        type: "success",
      });
      fetchModals();
    } catch (err) {
      setToast({
        message:
          err instanceof Error ? err.message : "Failed to delete update modal",
        type: "error",
      });
    }
  };

  const handlePublish = async (id: number) => {
    if (
      !confirm(
        "Publishing this modal will show it to users who haven't seen it yet (tracked via localStorage). Continue?"
      )
    )
      return;

    try {
      await publishUpdateModal(id);
      setToast({
        message: "Update modal published! Users will see it on next page load.",
        type: "success",
      });
      fetchModals();
    } catch (err) {
      setToast({
        message:
          err instanceof Error ? err.message : "Failed to publish update modal",
        type: "error",
      });
    }
  };

  const handleUnpublish = async (id: number) => {
    try {
      await unpublishUpdateModal(id);
      setToast({
        message: "Update modal unpublished successfully",
        type: "success",
      });
      fetchModals();
    } catch (err) {
      setToast({
        message:
          err instanceof Error
            ? err.message
            : "Failed to unpublish update modal",
        type: "error",
      });
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setToast({ message: "Please upload an image file", type: "error" });
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("image", file);

      const API_BASE_URL = import.meta.env.VITE_SERVER_URL || "";
      const response = await fetch(
        `${API_BASE_URL}/api/uploads/upload-modal-banner`,
        {
          method: "POST",
          credentials: "include",
          body: formData,
        }
      );

      if (!response.ok) throw new Error("Upload failed");

      const result = await response.json();
      setFormData((prev) => ({ ...prev, banner_url: result.url }));
      setToast({ message: "Banner uploaded successfully", type: "success" });
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : "Failed to upload banner",
        type: "error",
      });
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setFormData({ title: "", content: "", banner_url: "" });
  };

  const openEditModal = (modal: UpdateModal) => {
    setEditingModal(modal);
    setFormData({
      title: modal.title,
      content: modal.content,
      banner_url: modal.banner_url || "",
    });
  };

  const closeModals = () => {
    setShowAddModal(false);
    setEditingModal(null);
    resetForm();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader />
      </div>
    );
  }

  return (
    <div>
      <AdminToolbar className="!mb-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <MdCampaign className="w-5 h-5 text-cyan-400 shrink-0" />
          <div className="min-w-0">
            <AdminSectionTitle className="!mb-0">
              Update overview modals
            </AdminSectionTitle>
            <p className="text-xs text-zinc-500 mt-0.5">
              Manage update announcements shown to users
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size={adminDownsizeButtonSize("sm")}
          onClick={() => setShowAddModal(true)}
          className="shrink-0"
        >
          <MdAdd className="w-4 h-4 sm:mr-1.5" />
          <span className="hidden sm:inline">Create modal</span>
        </Button>
      </AdminToolbar>

      <AdminTable minWidth="600px">
        <thead className={ADMIN_TABLE_HEAD}>
          <tr>
            <th className={ADMIN_TH}>Title</th>
            <th className={`${ADMIN_TH} text-center`}>Status</th>
            <th className={`${ADMIN_TH} text-center`}>Published</th>
            <th className={`${ADMIN_TH} text-center`}>Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/80">
          {modals.length === 0 ? (
            <tr>
              <td
                colSpan={4}
                className={`${ADMIN_TD} p-8 text-center text-zinc-500`}
              >
                No update modals created yet
              </td>
            </tr>
          ) : (
            modals.map((modal) => (
              <tr key={modal.id} className="hover:bg-zinc-800/30">
                <td className={`${ADMIN_TD} w-1/2`}>
                  <div className="flex flex-col gap-1">
                    <h3
                      className="font-medium text-white truncate"
                      title={modal.title}
                    >
                      {modal.title.length > 40
                        ? `${modal.title.substring(0, 40)}...`
                        : modal.title}
                    </h3>
                    <p
                      className="text-sm text-zinc-400 truncate"
                      title={modal.content}
                    >
                      {modal.content.length > 60
                        ? `${modal.content.substring(0, 60)}...`
                        : modal.content}
                    </p>
                  </div>
                </td>
                <td className={`${ADMIN_TD} text-center w-24`}>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium ${statusBadgeClass(modal.is_active ? "active" : "draft")}`}
                  >
                    {modal.is_active ? (
                      <>
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                        Active
                      </>
                    ) : (
                      "Draft"
                    )}
                  </span>
                </td>
                <td className={`${ADMIN_TD} text-center w-28`}>
                  {modal.published_at
                    ? new Date(modal.published_at).toLocaleDateString()
                    : "Not published"}
                </td>
                <td className={`${ADMIN_TD} text-center w-32`}>
                  <div className="flex items-center justify-center gap-1.5">
                    {modal.is_active ? (
                      <Button
                        variant="outline"
                        size={adminDownsizeButtonSize("sm")}
                        onClick={() => handleUnpublish(modal.id)}
                      >
                        <MdVisibilityOff className="w-4 h-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size={adminDownsizeButtonSize("sm")}
                        onClick={() => handlePublish(modal.id)}
                      >
                        <MdSend className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size={adminDownsizeButtonSize("sm")}
                      onClick={() => openEditModal(modal)}
                    >
                      <MdEdit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="danger"
                      size={adminDownsizeButtonSize("sm")}
                      onClick={() => handleDelete(modal.id)}
                    >
                      <MdDelete className="w-4 h-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </AdminTable>

      <AdminModal
        open={showAddModal || !!editingModal}
        onClose={closeModals}
        title={editingModal ? "Edit Update Modal" : "Create Update Modal"}
        size="xl"
        footer={
          <>
            <Button
              variant="secondary"
              size={adminDownsizeButtonSize("sm")}
              onClick={closeModals}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size={adminDownsizeButtonSize("sm")}
              onClick={editingModal ? handleUpdate : handleCreate}
              disabled={!formData.title || !formData.content}
            >
              {editingModal ? "Update" : "Create"} Modal
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Title
            </label>
            <TextInput
              value={formData.title}
              onChange={(value) => setFormData({ ...formData, title: value })}
              placeholder="e.g., New Features & Improvements"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Banner Image (Optional)
            </label>
            <div className="flex items-center gap-4">
              <label className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  disabled={uploading}
                />
                <div className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg cursor-pointer transition-colors border border-zinc-700">
                  {uploading ? (
                    <>
                      <Loader />
                      <span className="text-sm text-zinc-300">
                        Uploading...
                      </span>
                    </>
                  ) : (
                    <>
                      <MdUpload className="w-4 h-4 text-zinc-400" />
                      <span className="text-sm text-zinc-300">
                        Upload via Cephie Snap
                      </span>
                    </>
                  )}
                </div>
              </label>
              {formData.banner_url && (
                <img
                  src={formData.banner_url}
                  alt="Banner preview"
                  className="w-20 h-20 rounded-lg object-cover border-2 border-cyan-500/50"
                />
              )}
            </div>
            {formData.banner_url && (
              <p className="text-xs text-zinc-500 mt-1">
                Image uploaded successfully
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Content (Markdown)
            </label>
            <div data-color-mode="dark">
              <MDEditor
                value={formData.content}
                onChange={(val) =>
                  setFormData({ ...formData, content: val || "" })
                }
                preview="edit"
                height={400}
              />
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              Supports markdown formatting: **bold**, *italic*, [links](url),
              lists, etc.
            </p>
          </div>
        </div>
      </AdminModal>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}