import { useEffect, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import AdminModal from './AdminModal';
import { AdminLoading } from './AdminStates';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import ScopeTagSelector from '../developers/ScopeTagSelector';
import {
  fetchAdminDeveloperCatalog,
  type AdminDeveloperApplication,
  type AdminScopeCatalogEntry,
} from '../../utils/fetch/adminDevelopers';

type Props = {
  application: AdminDeveloperApplication;
  open: boolean;
  onClose: () => void;
  onApprove: (body: {
    approvedScopes: string[];
    rateLimitPerMinute?: number | null;
    note?: string;
  }) => Promise<void>;
  onRequestReject: () => void;
  busy: boolean;
};

export default function AdminDeveloperApplicationReviewModal({
  application,
  open,
  onClose,
  onApprove,
  onRequestReject,
  busy,
}: Props) {
  const [catalog, setCatalog] = useState<AdminScopeCatalogEntry[]>([]);
  const [approvedScopes, setApprovedScopes] = useState<Set<string>>(
    () => new Set(application.requestedScopes)
  );
  const [touchDefaultRpm, setTouchDefaultRpm] = useState(false);
  const [rpmText, setRpmText] = useState('');
  const [note, setNote] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAdminDeveloperCatalog()
      .then((c) => {
        if (!cancelled) setCatalog(c);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setApprovedScopes(new Set(application.requestedScopes));
    setTouchDefaultRpm(false);
    setRpmText('');
    setNote('');
    setLocalError(null);
  }, [application.id, application.requestedScopes]);

  const submitApprove = async () => {
    setLocalError(null);
    if (approvedScopes.size === 0) {
      setLocalError('Select at least one scope to approve.');
      return;
    }
    const body: {
      approvedScopes: string[];
      note?: string;
      rateLimitPerMinute?: number | null;
    } = {
      approvedScopes: [...approvedScopes],
      note: note.trim() ? note.trim() : undefined,
    };
    if (touchDefaultRpm) {
      if (rpmText.trim() === '') {
        body.rateLimitPerMinute = null;
      } else {
        const n = Math.floor(Number(rpmText.trim()));
        if (!Number.isFinite(n) || n < 0) {
          setLocalError(
            'Default RPM must be a non-negative number, or leave blank for site default.'
          );
          return;
        }
        body.rateLimitPerMinute = n === 0 ? null : n;
      }
    }
    try {
      await onApprove(body);
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Approve failed');
    }
  };

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title={`Review: ${application.username}`}
      description={
        <span className="font-mono text-xs">{application.userId}</span>
      }
      size="xl"
      footer={
        <>
          <Button
            type="button"
            variant="destructive"
            className="sm:mr-auto"
            disabled={busy}
            onClick={onRequestReject}
          >
            Reject…
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={busy || catalog.length === 0}
            onClick={() => void submitApprove()}
          >
            {busy ? <Loader2 className="animate-spin" /> : null}
            Approve with these settings
          </Button>
        </>
      }
    >
      <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
        <div className="grid content-start gap-1">
          <dt className="text-xs text-muted-foreground">Who</dt>
          <dd className="max-h-40 overflow-y-auto text-sm leading-relaxed whitespace-pre-wrap">
            {application.whoText}
          </dd>
        </div>
        <div className="grid content-start gap-1">
          <dt className="text-xs text-muted-foreground">Why</dt>
          <dd className="max-h-40 overflow-y-auto text-sm leading-relaxed whitespace-pre-wrap">
            {application.whyText || (
              <span className="text-muted-foreground">N/A</span>
            )}
          </dd>
        </div>
        <div className="grid content-start gap-1 sm:col-span-2">
          <dt className="text-xs text-muted-foreground">Requested scopes</dt>
          <dd className="text-sm">
            {application.requestedScopes.length === 0 ? (
              <span className="text-muted-foreground">N/A</span>
            ) : (
              <ul className="grid gap-0.5 font-mono text-xs text-muted-foreground">
                {application.requestedScopes.map((s) => (
                  <li key={s} className="truncate">
                    {s}
                  </li>
                ))}
              </ul>
            )}
          </dd>
        </div>
      </dl>

      <div className="grid gap-5">
        <div className="grid gap-2">
          <Label>Approved scope ceiling</Label>
          {catalog.length === 0 ? (
            <AdminLoading
              label="Loading catalog…"
              className="justify-start py-2"
            />
          ) : (
            <ScopeTagSelector
              catalog={catalog}
              selected={approvedScopes}
              onChange={setApprovedScopes}
            />
          )}
        </div>

        <div className="grid gap-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="admin-dev-review-touch-rpm"
              checked={touchDefaultRpm}
              onCheckedChange={(v) => setTouchDefaultRpm(v === true)}
            />
            <Label htmlFor="admin-dev-review-touch-rpm">
              Set default rate limit for new keys
            </Label>
          </div>
          {touchDefaultRpm && (
            <div className="grid gap-2 pl-6">
              <Label htmlFor="admin-dev-review-rpm">Requests / minute</Label>
              <Input
                id="admin-dev-review-rpm"
                type="text"
                inputMode="numeric"
                value={rpmText}
                onChange={(e) => setRpmText(e.target.value)}
                placeholder="e.g. 120 (empty = site default)"
                className="max-w-xs"
              />
            </div>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="admin-dev-review-note">
            Note to applicant (optional)
          </Label>
          <Textarea
            id="admin-dev-review-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Shown in their portal with the approval notice"
            className="resize-none"
          />
        </div>

        {localError && (
          <p
            className="flex items-start gap-2 text-sm text-destructive"
            role="alert"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {localError}
          </p>
        )}
      </div>
    </AdminModal>
  );
}
