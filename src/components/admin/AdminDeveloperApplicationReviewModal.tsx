import { useEffect, useState } from 'react';
import { MdRefresh } from 'react-icons/md';
import AdminModal from './AdminModal';
import AdminSectionTitle from './AdminSectionTitle';
import { adminDownsizeButtonSize, adminSectionClass } from './adminConstants';
import Button from '../common/Button';
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
      title={`Review — ${application.username}`}
      size="xl"
      footer={
        <>
          <Button
            type="button"
            variant="ghost"
            size={adminDownsizeButtonSize('sm')}
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            size={adminDownsizeButtonSize('sm')}
            disabled={busy}
            onClick={onRequestReject}
          >
            Reject…
          </Button>
          <Button
            type="button"
            variant="primary"
            size={adminDownsizeButtonSize('sm')}
            disabled={busy || catalog.length === 0}
            onClick={() => void submitApprove()}
            className="!bg-emerald-600 hover:!bg-emerald-500"
          >
            {busy ? (
              <MdRefresh className="w-4 h-4 animate-spin inline mr-1" />
            ) : null}
            Approve with these settings
          </Button>
        </>
      }
    >
      <p className="text-[11px] text-zinc-500 font-mono mb-4">
        {application.userId}
      </p>

      <div
        className={`grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm ${adminSectionClass('!mt-0 !pt-0 !border-t-0')}`}
      >
        <div>
          <AdminSectionTitle className="!text-[10px] !font-semibold !uppercase !tracking-wider !text-zinc-500 !mb-1">
            Who
          </AdminSectionTitle>
          <p className="text-zinc-300 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
            {application.whoText}
          </p>
        </div>
        <div>
          <AdminSectionTitle className="!text-[10px] !font-semibold !uppercase !tracking-wider !text-zinc-500 !mb-1">
            Why
          </AdminSectionTitle>
          <p className="text-zinc-300 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
            {application.whyText || '—'}
          </p>
        </div>
      </div>

      <div className={adminSectionClass()}>
        <AdminSectionTitle className="!text-[10px] !font-semibold !uppercase !tracking-wider !text-zinc-500 !mb-2">
          Requested scopes
        </AdminSectionTitle>
        <div className="flex flex-wrap gap-1.5">
          {application.requestedScopes.map((s) => (
            <span
              key={s}
              className="text-[10px] font-mono px-2 py-0.5 rounded-full border bg-zinc-800/80 text-zinc-300 border-zinc-600"
            >
              {s}
            </span>
          ))}
        </div>
      </div>

      <div className={adminSectionClass()}>
        <AdminSectionTitle>Approved scope ceiling</AdminSectionTitle>
        <p className="text-xs text-zinc-500 mb-3 leading-relaxed">
          Starts from what they asked for. You can remove scopes or add any
          catalog scope. This becomes their maximum allowed scopes.
        </p>
        {catalog.length === 0 ? (
          <p className="text-sm text-zinc-500">Loading catalog…</p>
        ) : (
          <div className="rounded-xl border border-zinc-700/80 bg-zinc-950/50 p-3">
            <ScopeTagSelector
              catalog={catalog}
              selected={approvedScopes}
              onChange={setApprovedScopes}
            />
          </div>
        )}
      </div>

      <div
        className={`${adminSectionClass()} rounded-xl border border-zinc-800/60 bg-zinc-950/40 p-4 space-y-3`}
      >
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={touchDefaultRpm}
            onChange={(e) => setTouchDefaultRpm(e.target.checked)}
            className="mt-1 accent-blue-600 rounded border-zinc-600"
          />
          <span>
            <span className="text-sm font-medium text-zinc-200">
              Set default rate limit for new keys
            </span>
            <span className="block text-xs text-zinc-500 mt-1 leading-relaxed">
              When checked, new keys they create use this RPM unless you set
              per-key limits later. Leave unchecked to keep their current
              default unchanged. Empty field = site default.
            </span>
          </span>
        </label>
        {touchDefaultRpm && (
          <div>
            <label className="block text-xs text-zinc-500 mb-1">
              Requests / minute
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={rpmText}
              onChange={(e) => setRpmText(e.target.value)}
              placeholder="e.g. 120 (empty = site default)"
              className="w-full max-w-xs rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
        )}
      </div>

      <div className={adminSectionClass()}>
        <label className="block text-xs font-medium text-zinc-400 mb-1">
          Note to applicant (optional)
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Shown in their portal with the approval notice"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none"
        />
      </div>

      {localError && (
        <div className="mt-4 rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          {localError}
        </div>
      )}
    </AdminModal>
  );
}
