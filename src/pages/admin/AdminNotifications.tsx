import { useState, useEffect } from 'react';
import { Bell, Plus, Edit, Trash2, Check, X, Eye, Menu } from 'lucide-react';
import Navbar from '../../components/Navbar';
import AdminSidebar from '../../components/admin/AdminSidebar';
import Loader from '../../components/common/Loader';
import Button from '../../components/common/Button';
import Toast from '../../components/common/Toast';
import ErrorScreen from '../../components/common/ErrorScreen';
import Dropdown from '../../components/common/Dropdown';
import TextInput from '../../components/common/TextInput';
import Checkbox from '../../components/common/Checkbox';
import UpdateModalsSection from '../../components/admin/UpdateModalsSection';
import {
  fetchNotifications,
  addNotification,
  updateNotification,
  deleteNotification,
  type Notification,
} from '../../utils/fetch/admin';

export default function AdminNotifications() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingNotification, setEditingNotification] =
    useState<Notification | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  const [newNotification, setNewNotification] = useState({
    type: 'info' as 'info' | 'warning' | 'success' | 'error',
    text: '',
    show: false,
    customColor: '',
  });

  const typeOptions = [
    { value: 'info', label: 'Info' },
    { value: 'warning', label: 'Warning' },
    { value: 'success', label: 'Success' },
    { value: 'error', label: 'Error' },
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
        err instanceof Error ? err.message : 'Failed to fetch notifications'
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
        message: 'Notification added successfully',
        type: 'success',
      });
      setShowAddModal(false);
      setNewNotification({
        type: 'info',
        text: '',
        show: false,
        customColor: '',
      });
      fetchAllNotifications();
    } catch {
      setToast({ message: 'Failed to add notification', type: 'error' });
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
        message: 'Notification updated successfully',
        type: 'success',
      });
      setEditingNotification(null);
      fetchAllNotifications();
    } catch {
      setToast({
        message: 'Failed to update notification',
        type: 'error',
      });
    }
  };

  const handleDeleteNotification = async (id: number) => {
    try {
      await deleteNotification(id);
      setToast({
        message: 'Notification deleted successfully',
        type: 'success',
      });
      fetchAllNotifications();
    } catch {
      setToast({
        message: 'Failed to delete notification',
        type: 'error',
      });
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'info':
        return <Eye className="w-4 h-4 text-blue-400" />;
      case 'warning':
        return <Eye className="w-4 h-4 text-yellow-400" />;
      case 'success':
        return <Eye className="w-4 h-4 text-green-400" />;
      case 'error':
        return <Eye className="w-4 h-4 text-red-400" />;
      default:
        return <Bell className="w-4 h-4 text-zinc-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />
      <div className="flex pt-16">
        {/* Mobile Sidebar Overlay */}
        {mobileSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-40 lg:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}

        {/* Desktop Sidebar */}
        <div className="hidden lg:block">
          <AdminSidebar
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
        </div>

        {/* Mobile Sidebar */}
        <div
          className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 lg:hidden ${
            mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <AdminSidebar
            collapsed={false}
            onToggle={() => setMobileSidebarOpen(false)}
          />
        </div>

        <div className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mb-6 sm:mb-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
              <div className="flex items-center">
                <div className="p-2 sm:p-3 bg-cyan-500/20 rounded-xl mr-3 sm:mr-4">
                  <Bell className="h-6 w-6 sm:h-8 sm:w-8 text-cyan-400" />
                </div>
                <h1
                  className="text-3xl sm:text-4xl lg:text-5xl text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-600 font-extrabold"
                  style={{ lineHeight: 1.4 }}
                >
                  Notification Management
                </h1>
              </div>
              <Button
                onClick={() => setShowAddModal(true)}
                variant="outline"
                className="mt-2"
              >
                <Plus className="w-4 h-4 mr-2" /> Add Notification
              </Button>
            </div>
          </div>

          {loading ? (
            <Loader />
          ) : error ? (
            <ErrorScreen
              title="Error"
              message={error}
              onRetry={fetchAllNotifications}
            />
          ) : (
            <div className="bg-zinc-900 border-2 border-zinc-700/50 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  <thead className="bg-zinc-800">
                    <tr>
                      <th className="px-6 py-4 text-left text-zinc-400 font-medium">
                        Type
                      </th>
                      <th className="px-6 py-4 text-left text-zinc-400 font-medium">
                        Text
                      </th>
                      <th className="px-6 py-4 text-left text-zinc-400 font-medium">
                        Visible
                      </th>
                      <th className="px-6 py-4 text-left text-zinc-400 font-medium">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {notifications.map((notif) => (
                      <tr
                        key={notif.id}
                        className="border-t border-zinc-700/50 hover:bg-zinc-800/50"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-2">
                            {getNotificationIcon(notif.type)}
                            <span className="capitalize">{notif.type}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-zinc-300">
                          {notif.text}
                        </td>
                        <td className="px-6 py-4">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              handleUpdateNotification(notif.id, {
                                show: !notif.show,
                              })
                            }
                          >
                            {notif.show ? (
                              <Check className="w-4 h-4 text-green-600" />
                            ) : (
                              <X className="w-4 h-4 text-red-600" />
                            )}
                          </Button>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingNotification(notif)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => handleDeleteNotification(notif.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Update Modals Section */}
          <div className="mt-8">
            <UpdateModalsSection />
          </div>

          {/* Add/Edit Modal */}
          {(showAddModal || editingNotification) && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="bg-zinc-900 border-2 border-zinc-700 rounded-2xl p-6 w-full max-w-md">
                <h2 className="text-2xl font-bold mb-4">
                  {editingNotification ? 'Edit' : 'Add'} Notification
                </h2>
                <div className="space-y-4">
                  <Dropdown
                    options={typeOptions}
                    value={editingNotification?.type || newNotification.type}
                    onChange={(value) =>
                      editingNotification
                        ? setEditingNotification({
                            ...editingNotification,
                            type: value as
                              | 'info'
                              | 'warning'
                              | 'success'
                              | 'error',
                          })
                        : setNewNotification({
                            ...newNotification,
                            type: value as
                              | 'info'
                              | 'warning'
                              | 'success'
                              | 'error',
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
                      {
                        (editingNotification?.text || newNotification.text)
                          .length
                      }
                      /200
                    </div>
                  </div>
                  <TextInput
                    value={
                      editingNotification
                        ? editingNotification.custom_color || ''
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
                <div className="flex justify-end space-x-2 mt-4">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowAddModal(false);
                      setEditingNotification(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
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
                    {editingNotification ? 'Update' : 'Add'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {toast && (
            <Toast
              message={toast.message}
              type={toast.type}
              onClose={() => setToast(null)}
            />
          )}
        </div>
      </div>

      {/* Floating Mobile Menu Button */}
      <button
        onClick={() => setMobileSidebarOpen(true)}
        className="lg:hidden fixed bottom-6 right-6 z-30 p-4 bg-cyan-600 hover:bg-cyan-700 rounded-full shadow-lg transition-colors"
      >
        <Menu className="h-6 w-6 text-white" />
      </button>
    </div>
  );
}
