import { useState, useEffect, useId } from 'react';
import {
  CircleDashed,
  EyeOff,
  ImageUp,
  Loader2,
  Pencil,
  Plus,
  Radio,
  Send,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import MDEditor from '@uiw/react-md-editor';
import AdminModal from './AdminModal';
import AdminSection from './AdminSection';
import AdminStatusBadge from './AdminStatusBadge';
import AdminTable from './AdminTable';
import { AdminLoading } from './AdminStates';
import { useAdminConfirm } from './useAdminConfirm';
import Toast from '../common/Toast';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  fetchAllUpdateModals,
  createUpdateModal,
  updateUpdateModal,
  deleteUpdateModal,
  publishUpdateModal,
  unpublishUpdateModal,
  type UpdateModal,
} from '../../utils/fetch/admin/updateModals';

type SectionToast = {
  message: string;
  type: 'success' | 'error' | 'info';
};

type UpdateModalsSectionProps = {
  onToast?: (toast: SectionToast) => void;
  className?: string;
};

function RowAction({
  label,
  icon: Icon,
  onClick,
  destructive,
}: {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          onClick={onClick}
          className={
            destructive ? 'text-destructive hover:text-destructive' : undefined
          }
        >
          <Icon />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export default function UpdateModalsSection({
  onToast,
  className,
}: UpdateModalsSectionProps = {}) {
  const [modals, setModals] = useState<UpdateModal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingModal, setEditingModal] = useState<UpdateModal | null>(null);
  const [toast, setToast] = useState<SectionToast | null>(null);
  const [uploading, setUploading] = useState(false);
  const { confirm, confirmDialog } = useAdminConfirm();
  const titleId = useId();
  const bannerId = useId();

  useEffect(() => {
    if (toast && onToast) {
      onToast(toast);
      setToast(null);
    }
  }, [toast, onToast]);

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    banner_url: '',
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
          err instanceof Error ? err.message : 'Failed to fetch update modals',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.title || !formData.content) {
      setToast({ message: 'Title and content are required', type: 'error' });
      return;
    }

    try {
      await createUpdateModal(formData);
      setToast({
        message: 'Update modal created successfully',
        type: 'success',
      });
      setShowAddModal(false);
      resetForm();
      fetchModals();
    } catch (err) {
      setToast({
        message:
          err instanceof Error ? err.message : 'Failed to create update modal',
        type: 'error',
      });
    }
  };

  const handleUpdate = async () => {
    if (!editingModal) return;
    if (!formData.title || !formData.content) {
      setToast({ message: 'Title and content are required', type: 'error' });
      return;
    }

    try {
      await updateUpdateModal(editingModal.id, formData);
      setToast({
        message: 'Update modal updated successfully',
        type: 'success',
      });
      setEditingModal(null);
      resetForm();
      fetchModals();
    } catch (err) {
      setToast({
        message:
          err instanceof Error ? err.message : 'Failed to update update modal',
        type: 'error',
      });
    }
  };

  const handleDelete = async (id: number) => {
    if (
      !(await confirm({
        title: 'Delete this update modal?',
        description:
          'The update modal will be permanently removed. This action cannot be undone.',
        confirmText: 'Delete',
        destructive: true,
      }))
    )
      return;

    try {
      await deleteUpdateModal(id);
      setToast({
        message: 'Update modal deleted successfully',
        type: 'success',
      });
      fetchModals();
    } catch (err) {
      setToast({
        message:
          err instanceof Error ? err.message : 'Failed to delete update modal',
        type: 'error',
      });
    }
  };

  const handlePublish = async (id: number) => {
    if (
      !(await confirm({
        title: 'Publish this update modal?',
        description:
          "Publishing this modal will show it to users who haven't seen it yet (tracked via localStorage).",
        confirmText: 'Publish',
      }))
    )
      return;

    try {
      await publishUpdateModal(id);
      setToast({
        message: 'Update modal published! Users will see it on next page load.',
        type: 'success',
      });
      fetchModals();
    } catch (err) {
      setToast({
        message:
          err instanceof Error ? err.message : 'Failed to publish update modal',
        type: 'error',
      });
    }
  };

  const handleUnpublish = async (id: number) => {
    try {
      await unpublishUpdateModal(id);
      setToast({
        message: 'Update modal unpublished successfully',
        type: 'success',
      });
      fetchModals();
    } catch (err) {
      setToast({
        message:
          err instanceof Error
            ? err.message
            : 'Failed to unpublish update modal',
        type: 'error',
      });
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setToast({ message: 'Please upload an image file', type: 'error' });
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('image', file);

      const API_BASE_URL = import.meta.env.VITE_SERVER_URL || '';
      const response = await fetch(
        `${API_BASE_URL}/api/uploads/upload-modal-banner`,
        {
          method: 'POST',
          credentials: 'include',
          body: formData,
        }
      );

      if (!response.ok) throw new Error('Upload failed');

      const result = await response.json();
      setFormData((prev) => ({ ...prev, banner_url: result.url }));
      setToast({ message: 'Banner uploaded successfully', type: 'success' });
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Failed to upload banner',
        type: 'error',
      });
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setFormData({ title: '', content: '', banner_url: '' });
  };

  const openEditModal = (modal: UpdateModal) => {
    setEditingModal(modal);
    setFormData({
      title: modal.title,
      content: modal.content,
      banner_url: modal.banner_url || '',
    });
  };

  const closeModals = () => {
    setShowAddModal(false);
    setEditingModal(null);
    resetForm();
  };

  return (
    <>
      <AdminSection
        title="Update overview modals"
        className={className}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddModal(true)}
          >
            <Plus />
            Create modal
          </Button>
        }
      >
        {loading ? (
          <AdminLoading label="Loading update modals…" />
        ) : (
          <AdminTable minWidth="600px">
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead className="w-20">Status</TableHead>
                <TableHead className="w-32">Published</TableHead>
                <TableHead className="w-32 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {modals.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No update modals created yet
                  </TableCell>
                </TableRow>
              ) : (
                modals.map((modal) => (
                  <TableRow key={modal.id}>
                    <TableCell className="max-w-0 whitespace-normal">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span
                          className="truncate font-medium"
                          title={modal.title}
                        >
                          {modal.title.length > 40
                            ? `${modal.title.substring(0, 40)}...`
                            : modal.title}
                        </span>
                        <span
                          className="truncate text-xs text-muted-foreground"
                          title={modal.content}
                        >
                          {modal.content.length > 60
                            ? `${modal.content.substring(0, 60)}...`
                            : modal.content}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {modal.is_active ? (
                        <AdminStatusBadge tone="success" icon={Radio}>
                          Active
                        </AdminStatusBadge>
                      ) : (
                        <AdminStatusBadge tone="neutral" icon={CircleDashed}>
                          Draft
                        </AdminStatusBadge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {modal.published_at
                        ? new Date(modal.published_at).toLocaleDateString()
                        : 'Not published'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {modal.is_active ? (
                          <RowAction
                            label="Unpublish"
                            icon={EyeOff}
                            onClick={() => handleUnpublish(modal.id)}
                          />
                        ) : (
                          <RowAction
                            label="Publish"
                            icon={Send}
                            onClick={() => handlePublish(modal.id)}
                          />
                        )}
                        <RowAction
                          label="Edit"
                          icon={Pencil}
                          onClick={() => openEditModal(modal)}
                        />
                        <RowAction
                          label="Delete"
                          icon={Trash2}
                          destructive
                          onClick={() => handleDelete(modal.id)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </AdminTable>
        )}
      </AdminSection>

      <AdminModal
        open={showAddModal || !!editingModal}
        onClose={closeModals}
        title={editingModal ? 'Edit Update Modal' : 'Create Update Modal'}
        size="xl"
        footer={
          <>
            <Button variant="outline" onClick={closeModals}>
              Cancel
            </Button>
            <Button
              onClick={editingModal ? handleUpdate : handleCreate}
              disabled={!formData.title || !formData.content}
            >
              {editingModal ? 'Update' : 'Create'} Modal
            </Button>
          </>
        }
      >
        <div className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor={titleId}>Title</Label>
            <Input
              id={titleId}
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder="e.g., New Features & Improvements"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor={bannerId}>Banner image (optional)</Label>
            <div className="flex items-center gap-4">
              <label
                className={cn(
                  buttonVariants({ variant: 'outline' }),
                  'flex-1 cursor-pointer justify-start',
                  uploading && 'pointer-events-none opacity-50'
                )}
                aria-disabled={uploading}
              >
                <input
                  id={bannerId}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="sr-only"
                  disabled={uploading}
                />
                {uploading ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <ImageUp />
                    Upload via Cephie Snap
                  </>
                )}
              </label>
              {formData.banner_url && (
                <img
                  src={formData.banner_url}
                  alt="Banner preview"
                  className="size-20 shrink-0 rounded-md border object-cover"
                />
              )}
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Content (Markdown)</Label>
            <div
              data-color-mode="dark"
              className="overflow-hidden rounded-md border [&_.w-md-editor]:rounded-none [&_.w-md-editor]:border-0 [&_.w-md-editor]:bg-transparent [&_.w-md-editor]:shadow-none"
            >
              <MDEditor
                value={formData.content}
                onChange={(val) =>
                  setFormData({ ...formData, content: val || '' })
                }
                preview="edit"
                height={400}
              />
            </div>
          </div>
        </div>
      </AdminModal>

      {confirmDialog}

      {!onToast && toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}
