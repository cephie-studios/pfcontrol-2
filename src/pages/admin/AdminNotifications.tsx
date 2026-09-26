import { useState, useEffect, useId } from 'react';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Info,
  Pencil,
  Plus,
  Trash2,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import AdminLayout from '../../components/admin/AdminLayout';
import AdminModal from '../../components/admin/AdminModal';
import AdminPage from '../../components/admin/AdminPage';
import AdminSection from '../../components/admin/AdminSection';
import AdminSelect from '../../components/admin/AdminSelect';
import AdminStatusBadge from '../../components/admin/AdminStatusBadge';
import AdminTable from '../../components/admin/AdminTable';
import AdminToggleSwitch from '../../components/admin/AdminToggleSwitch';
import {
  AdminErrorState,
  AdminLoading,
} from '../../components/admin/AdminStates';
import { useAdminConfirm } from '../../components/admin/useAdminConfirm';
import type { AdminTone } from '../../components/admin/adminConstants';
import UpdateModalsSection from '../../components/admin/UpdateModalsSection';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  fetchNotifications,
  addNotification,
  updateNotification,
  deleteNotification,
  type Notification,
} from '../../utils/fetch/admin';

const TYPE_TONE: Record<string, AdminTone> = {
  info: 'info',
  warning: 'warning',
  success: 'success',
  error: 'danger',
};

const TYPE_ICON: Record<string, LucideIcon> = {
  info: Info,
  warning: AlertTriangle,
  success: CheckCircle2,
  error: XCircle,
};

export default function AdminNotifications() {
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
  const { confirm, confirmDialog } = useAdminConfirm();
  const textId = useId();
  const colorId = useId();
  const showId = useId();

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
    if (
      !(await confirm({
        title: 'Delete this notification?',
        description:
          'The notification will be removed from the site. This action cannot be undone.',
        confirmText: 'Delete',
        destructive: true,
      }))
    )
      return;
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

  const closeModal = () => {
    setShowAddModal(false);
    setEditingNotification(null);
  };

  const formText = editingNotification?.text || newNotification.text;
  const formColor = editingNotification
    ? editingNotification.custom_color || ''
    : newNotification.customColor;

  return (
    <AdminLayout toast={toast} onToastClose={() => setToast(null)}>
      <AdminPage
        title="Notifications"
        icon={Bell}
        actions={
          <Button size="sm" onClick={() => setShowAddModal(true)}>
            <Plus />
            Add notification
          </Button>
        }
      >
        {loading ? (
          <AdminLoading label="Loading notifications…" />
        ) : error ? (
          <AdminErrorState
            title="Error"
            message={error}
            onRetry={fetchAllNotifications}
          />
        ) : (
          <>
            <AdminSection title="Site notifications">
              <AdminTable minWidth="600px">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">Type</TableHead>
                    <TableHead>Text</TableHead>
                    <TableHead className="w-24">Visible</TableHead>
                    <TableHead className="w-24 text-right">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notifications.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="h-24 text-center text-muted-foreground"
                      >
                        No notifications yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    notifications.map((notif) => (
                      <TableRow key={notif.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <AdminStatusBadge
                              tone={TYPE_TONE[notif.type] ?? 'neutral'}
                              icon={TYPE_ICON[notif.type]}
                              showLabel
                              className="capitalize"
                            >
                              {notif.type}
                            </AdminStatusBadge>
                            {notif.custom_color ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span
                                    className="size-3 shrink-0 rounded-full border"
                                    style={{
                                      backgroundColor: notif.custom_color,
                                    }}
                                    aria-label={`Custom color ${notif.custom_color}`}
                                  />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <span className="font-mono">
                                    {notif.custom_color}
                                  </span>
                                </TooltipContent>
                              </Tooltip>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-normal break-words">
                          {notif.text}
                        </TableCell>
                        <TableCell>
                          <AdminToggleSwitch
                            checked={notif.show}
                            onChange={() =>
                              handleUpdateNotification(notif.id, {
                                show: !notif.show,
                              })
                            }
                            aria-label={
                              notif.show
                                ? 'Hide notification'
                                : 'Show notification'
                            }
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => setEditingNotification(notif)}
                                  aria-label="Edit notification"
                                >
                                  <Pencil />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() =>
                                    handleDeleteNotification(notif.id)
                                  }
                                  aria-label="Delete notification"
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete</TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </AdminTable>
            </AdminSection>

            <UpdateModalsSection onToast={setToast} />
          </>
        )}
      </AdminPage>

      <AdminModal
        open={showAddModal || !!editingNotification}
        onClose={closeModal}
        title={`${editingNotification ? 'Edit' : 'Add'} Notification`}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button
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
          </>
        }
      >
        <div className="grid gap-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Type</Label>
              <AdminSelect
                options={typeOptions}
                value={editingNotification?.type || newNotification.type}
                onChange={(value) =>
                  editingNotification
                    ? setEditingNotification({
                        ...editingNotification,
                        type: value as 'info' | 'warning' | 'success' | 'error',
                      })
                    : setNewNotification({
                        ...newNotification,
                        type: value as 'info' | 'warning' | 'success' | 'error',
                      })
                }
                placeholder="Select type"
                aria-label="Notification type"
                className="sm:w-full"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={colorId}>Custom color (optional)</Label>
              <div className="relative">
                <span
                  className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 rounded-full border bg-muted"
                  style={formColor ? { backgroundColor: formColor } : undefined}
                  aria-hidden
                />
                <Input
                  id={colorId}
                  value={formColor}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (editingNotification) {
                      setEditingNotification({
                        ...editingNotification,
                        custom_color: value,
                      });
                    } else {
                      setNewNotification({
                        ...newNotification,
                        customColor: value,
                      });
                    }
                  }}
                  placeholder="e.g. #FFFFFF"
                  className="pl-8 font-mono"
                />
              </div>
            </div>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor={textId}>Text</Label>
              <span className="text-xs text-muted-foreground tabular-nums">
                {formText.length}/200
              </span>
            </div>
            <Textarea
              id={textId}
              value={formText}
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
              className="min-h-20 resize-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id={showId}
              checked={editingNotification?.show || newNotification.show}
              onCheckedChange={(checked) => {
                const value = checked === true;
                if (editingNotification) {
                  setEditingNotification({
                    ...editingNotification,
                    show: value,
                  });
                } else {
                  setNewNotification({
                    ...newNotification,
                    show: value,
                  });
                }
              }}
            />
            <Label htmlFor={showId} className="font-normal">
              Show notification
            </Label>
          </div>
        </div>
      </AdminModal>

      {confirmDialog}
    </AdminLayout>
  );
}
