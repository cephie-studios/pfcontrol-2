import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import ScopeTagSelector from "../developers/ScopeTagSelector";
import {
  fetchAdminDeveloperCatalog,
  type AdminDeveloperApplication,
  type AdminScopeCatalogEntry,
} from "../../utils/fetch/adminDevelopers";

type Props = {
  application: AdminDeveloperApplication;
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
  onClose,
  onApprove,
  onRequestReject,
  busy,
}: Props) {
  const [catalog, setCatalog] = useState<AdminScopeCatalogEntry[]>([]);
  const [approvedScopes, setApprovedScopes] = useState<Set<string>>(
    () => new Set(application.requestedScopes),
  );
  const [touchDefaultRpm, setTouchDefaultRpm] = useState(false);
  const [rpmText, setRpmText] = useState("");
  const [note, setNote] = useState("");
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
    setRpmText("");
    setNote("");
    setLocalError(null);
  }, [application.id, application.requestedScopes]);

  const submitApprove = async () => {
    setLocalError(null);
    if (approvedScopes.size === 0) {
      setLocalError("Select at least one scope to approve.");
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
      if (rpmText.trim() === "") {
        body.rateLimitPerMinute = null;
      } else {
        const n = Math.floor(Number(rpmText.trim()));
        if (!Number.isFinite(n) || n < 0) {
          setLocalError(
            "Default RPM must be a non-negative number, or leave blank for site default.",
          );
          return;
        }
        body.rateLimitPerMinute = n === 0 ? null : n;
      }
    }
    try {
      await onApprove(body);
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Approve failed");
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col ring-1 ring-zinc-800/50"
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-review-title"
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-zinc-800 shrink-0">
          <div className="min-w-0">
            <h2 id="app-review-title" className="text-lg font-semibold text-white">
              Review application
            </h2>
            <p className="text-sm text-zinc-400 mt-0.5 truncate">{application.username}</p>
            <p className="text-[11px] text-zinc-500 font-mono truncate">{application.userId}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="p-2 rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 min-h-0">
          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">
                Who
              </p>
              <p className="text-zinc-300 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                {application.whoText}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">
                Why
              </p>
              <p className="text-zinc-300 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                {application.whyText || "—"}
              </p>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">
              Requested scopes
            </p>
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

          <div>
            <p className="text-sm font-medium text-zinc-200 mb-1">Approved scope ceiling</p>
            <p className="text-xs text-zinc-500 mb-3 leading-relaxed">
              Starts from what they asked for. You can remove scopes or add any catalog scope. This
              becomes their maximum allowed scopes.
            </p>
            {catalog.length === 0 ? (
              <p className="text-sm text-zinc-500">Loading catalog…</p>
            ) : (
              <div className="rounded-xl border border-zinc-700/80 bg-zinc-950/50 p-3 ring-1 ring-zinc-800/30">
                <ScopeTagSelector
                  catalog={catalog}
                  selected={approvedScopes}
                  onChange={setApprovedScopes}
                />
              </div>
            )}
          </div>

          <div className="rounded-xl border border-zinc-700/60 bg-zinc-950/40 p-4 space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={touchDefaultRpm}
                onChange={(e) => setTouchDefaultRpm(e.target.checked)}
                className="mt-1 rounded border-zinc-600"
              />
              <span>
                <span className="text-sm font-medium text-zinc-200">
                  Set default rate limit for new keys
                </span>
                <span className="block text-xs text-zinc-500 mt-1 leading-relaxed">
                  When checked, new keys they create use this RPM unless you set per-key limits
                  later. Leave unchecked to keep their current default unchanged. Empty field = site
                  default.
                </span>
              </span>
            </label>
            {touchDefaultRpm && (
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Requests / minute</label>
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

          <div>
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
            <div className="rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-200">
              {localError}
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 px-5 py-4 border-t border-zinc-800 shrink-0">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-zinc-400 hover:bg-zinc-800 text-sm transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onRequestReject}
            className="px-4 py-2 rounded-xl border border-red-900/50 bg-red-950/40 text-red-200 text-sm font-medium hover:bg-red-950/60 disabled:opacity-50 transition-colors"
          >
            Reject…
          </button>
          <button
            type="button"
            disabled={busy || catalog.length === 0}
            onClick={() => void submitApprove()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold disabled:opacity-50 transition-colors"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Approve with these settings
          </button>
        </div>
      </div>
    </div>
  );
}