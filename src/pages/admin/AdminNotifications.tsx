import { useState, useEffect } from "react";
import {
  MdNotifications,
  MdAdd,
  MdEdit,
  MdDelete,
  MdCheck,
  MdClose,
  MdVisibility,
} from "react-icons/md";
import AdminLayout from "../../components/admin/AdminLayout";
import AdminModal from "../../components/admin/AdminModal";
import AdminPageHeader from "../../components/admin/AdminPageHeader";
import AdminTable from "../../components/admin/AdminTable";
import AdminSectionTitle from "../../components/admin/AdminSectionTitle";
import {
  adminDownsizeButtonSize,
  adminSectionClass,
  ADMIN_TABLE_HEAD,
  ADMIN_TH,
  ADMIN_TD,
} from "../../components/admin/adminConstants";
import Loader from "../../components/common/Loader";
import Button from "../../components/common/Button";
import ErrorScreen from "../../components/common/ErrorScreen";
import Dropdown from "../../components/common/Dropdown";
import TextInput from "../../components/common/TextInput";
import Checkbox from "../../components/common/Checkbox";
import UpdateModalsSection from "../../components/admin/UpdateModalsSection";
import {
  fetchNotifications,
  addNotification,
  updateNotification,
  deleteNotification,
  type Notification,
} from "../../utils/fetch/admin";

export default function AdminNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingNotification, setEditingNotification] =
    useState<Notification | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  const [newNotification, setNewNotification] = useState({
    type: "info" as "info" | "warning" | "success" | "error",
    text: "",
    show: false,
    customColor: "",
  });

  const typeOptions = [
    { value: "info", label: "Info" },
    { value: "warning", label: "Warning" },
    { value: "success", label: "Success" },
    { value: "error", label: "Error" },
  ];

  useEffect(() => {
    fetchAllNotifications();
  }, []);

  const fetchAllNotifications = async () => {
    try {
      setLoading(true);
      const data = await fetchNotifications();
      setNotifications(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch notifications"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAddNotification = async () => {
    try {
      await addNotification({
        type: newNotification.type,
        text: newNotification.text,
        show: newNotification.show,
        custom_color: newNotification.customColor?.trim() || null,
      });
      setToast({
        message: "Notification added successfully",
        type: "success",
      });
      setShowAddModal(false);
      setNewNotification({
        type: "info",
        text: "",
        show: false,
        customColor: "",
      });
      fetchAllNotifications();
    } catch {
      setToast({ message: "Failed to add notification", type: "error" });
    }
  };

  const handleUpdateNotification = async (
    id: number,
    updates: Partial<Notification>
  ) => {
    try {
      const cleanedUpdates = {
        ...updates,
        custom_color: updates.custom_color?.trim() || null,
      };
      await updateNotification(id, cleanedUpdates);
      setToast({
        message: "Notification updated successfully",
        type: "success",
      });
      setEditingNotification(null);
      fetchAllNotifications();
    } catch {
      setToast({
        message: "Failed to update notification",
        type: "error",
      });
    }
  };

  const handleDeleteNotification = async (id: number) => {
    try {
      await deleteNotification(id);
      setToast({
        message: "Notification deleted successfully",
        type: "success",
      });
      fetchAllNotifications();
    } catch {
      setToast({
        message: "Failed to delete notification",
        type: "error",
      });
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "info":
        return <MdVisibility size={18} className="text-blue-400" />;
      case "warning":
        return <MdVisibility size={18} className="text-yellow-400" />;
      case "success":
        return <MdVisibility size={18} className="text-green-400" />;
      case "error":
        return <MdVisibility size={18} className="text-red-400" />;
      default:
        return <MdNotifications size={18} className="text-zinc-400" />;
    }
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingNotification(null);
  };

  return (
    <AdminLayout toast={toast} onToastClose={() => setToast(null)}>
      <AdminPageHeader
        title="Notifications"
        icon={MdNotifications}
        accent="cyan"
        actions={
          <Button
            onClick={() => setShowAddModal(true)}
            variant="outline"
            size={adminDownsizeButtonSize("sm")}
          >
            <MdAdd size={16} className="mr-1.5" />
            Add
          </Button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader />
        </div>
      ) : error ? (
        <ErrorScreen
          title="Error"
          message={error}
          onRetry={fetchAllNotifications}
        />
      ) : (
        <>
          <div className={adminSectionClass("!mt-0 !pt-0 !border-t-0")}>
            <AdminSectionTitle>Site notifications</AdminSectionTitle>

            <div className="hidden md:block">
              <AdminTable minWidth="600px">
                <thead className={ADMIN_TABLE_HEAD}>
                  <tr>
                    <th className={ADMIN_TH}>Type</th>
                    <th className={ADMIN_TH}>Text</th>
                    <th className={ADMIN_TH}>Visible</th>
                    <th className={ADMIN_TH}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80">
                  {notifications.map((notif) => (
                    <tr key={notif.id} className="hover:bg-zinc-800/30">
                      <td className={ADMIN_TD}>
                        <div className="flex items-center space-x-2">
                          {getNotificationIcon(notif.type)}
                          <span className="capitalize">{notif.type}</span>
                        </div>
                      </td>
                      <td className={ADMIN_TD}>{notif.text}</td>
                      <td className={ADMIN_TD}>
                        <Button
                          size={adminDownsizeButtonSize("sm")}
                          variant="ghost"
                          onClick={() =>
                            handleUpdateNotification(notif.id, {
                              show: !notif.show,
                            })
                          }
                        >
                          {notif.show ? (
                            <MdCheck size={16} className="text-green-600" />
                          ) : (
                            <MdClose size={16} className="text-red-600" />
                          )}
                        </Button>
                      </td>
                      <td className={ADMIN_TD}>
                        <div className="flex space-x-2">
                          <Button
                            size={adminDownsizeButtonSize("sm")}
                            variant="outline"
                            onClick={() => setEditingNotification(notif)}
                          >
                            <MdEdit size={16} />
                          </Button>
                          <Button
                            size={adminDownsizeButtonSize("sm")}
                            variant="danger"
                            onClick={() => handleDeleteNotification(notif.id)}
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

            <div className="block md:hidden space-y-3">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-3"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="shrink-0">
                      {getNotificationIcon(notif.type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-white font-medium capitalize truncate">
                        {notif.type}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm text-zinc-300 mb-3">
                    <div className="break-words">
                      <span className="font-medium">Text:</span> {notif.text}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Visible:</span>
                      <button
                        onClick={() =>
                          handleUpdateNotification(notif.id, {
                            show: !notif.show,
                          })
                        }
                        className="shrink-0"
                      >
                        {notif.show ? (
                          <MdCheck size={18} className="text-green-600" />
                        ) : (
                          <MdClose size={18} className="text-red-600" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Button
                      size={adminDownsizeButtonSize("sm")}
                      variant="outline"
                      onClick={() => setEditingNotification(notif)}
                      className="w-full justify-center"
                    >
                      <MdEdit size={16} className="mr-2" />
                      Edit
                    </Button>
                    <Button
                      size={adminDownsizeButtonSize("sm")}
                      variant="danger"
                      onClick={() => handleDeleteNotification(notif.id)}
                      className="w-full justify-center"
                    >
                      <MdDelete size={16} className="mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={adminSectionClass()}>
            <UpdateModalsSection />
          </div>
        </>
      )}

      <AdminModal
        open={showAddModal || !!editingNotification}
        onClose={closeModal}
        title={`${editingNotification ? "Edit" : "Add"} Notification`}
        size="md"
        footer={
          <>
            <Button
              size={adminDownsizeButtonSize("sm")}
              variant="outline"
              onClick={closeModal}
            >
              Cancel
            </Button>
            <Button
              size={adminDownsizeButtonSize("sm")}
              onClick={
                editingNotification
                  ? () =>
                      handleUpdateNotification(
                        editingNotification.id,
                        editingNotification
                      )
                  : handleAddNotification
              }
            >
              {editingNotification ? "Update" : "Add"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Dropdown
            options={typeOptions}
            value={editingNotification?.type || newNotification.type}
            onChange={(value) =>
              editingNotification
                ? setEditingNotification({
                    ...editingNotification,
                    type: value as "info" | "warning" | "success" | "error",
                  })
                : setNewNotification({
                    ...newNotification,
                    type: value as "info" | "warning" | "success" | "error",
                  })
            }
            placeholder="Select type"
          />
          <div>
            <textarea
              value={editingNotification?.text || newNotification.text}
              onChange={(e) => {
                const value = e.target.value.slice(0, 200);
                if (editingNotification) {
                  setEditingNotification({
                    ...editingNotification,
                    text: value,
                  });
                } else {
                  setNewNotification({
                    ...newNotification,
                    text: value,
                  });
                }
              }}
              placeholder="Notification text"
              maxLength={200}
              rows={3}
              className="w-full px-4 py-2 bg-gray-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:border-blue-600 focus:outline-none resize-none"
            />
            <div className="text-xs text-zinc-500 mt-1 text-right">
              {(editingNotification?.text || newNotification.text).length}
              /200
            </div>
          </div>
          <TextInput
            value={
              editingNotification
                ? editingNotification.custom_color || ""
                : newNotification.customColor
            }
            onChange={(value) =>
              editingNotification
                ? setEditingNotification({
                    ...editingNotification,
                    custom_color: value,
                  })
                : setNewNotification({
                    ...newNotification,
                    customColor: value,
                  })
            }
            placeholder="Custom color (e.g., #FFFFFF)"
          />
          <Checkbox
            checked={editingNotification?.show || newNotification.show}
            onChange={(checked) =>
              editingNotification
                ? setEditingNotification({
                    ...editingNotification,
                    show: checked,
                  })
                : setNewNotification({
                    ...newNotification,
                    show: checked,
                  })
            }
            label="Show notification"
          />
        </div>
      </AdminModal>
    </AdminLayout>
  );
}