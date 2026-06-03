import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Loader2,
  LayoutDashboard,
  KeyRound,
  BookOpen,
  ArrowRight,
  Bell,
  X,
  Clock,
  Sparkles,
  Mail,
} from 'lucide-react';
import DeveloperAccessRequestForm from '../../components/developers/DeveloperAccessRequestForm';
import { cardClass, statusBadgeClass } from './constants';
import { useDeveloperPortal } from './developerPortalContext';

const devNoticeSuccessClass =
  'flex items-start gap-3 rounded-2xl border border-emerald-800/45 bg-emerald-950/40 px-4 py-3 text-emerald-50 ring-1 ring-emerald-900/30';

const devNoticeClass =
  'flex items-start gap-3 rounded-2xl border border-amber-800/40 bg-amber-950/35 px-4 py-3 text-amber-50 ring-1 ring-amber-900/25';

const ADMIN_NOTICE_SUCCESS_PREFIX = '[[success]]';

function parseAdminNoticeDetail(raw: string | null | undefined): {
  variant: 'success' | 'default';
  body: string;
} {
  const text = raw?.trim() ?? '';
  if (text.startsWith(ADMIN_NOTICE_SUCCESS_PREFIX)) {
    const body = text
      .slice(ADMIN_NOTICE_SUCCESS_PREFIX.length)
      .replace(/^\s*\n+/, '')
      .trimEnd();
    return { variant: 'success', body };
  }
  return { variant: 'default', body: text };
}

const devPendingBannerClass =
  'flex items-start gap-3 rounded-2xl border border-sky-800/40 bg-sky-950/35 px-4 py-3 text-sky-50 ring-1 ring-sky-900/25';

const devPendingCardClass =
  'rounded-3xl border border-zinc-700/80 bg-linear-to-br from-zinc-900/95 via-zinc-900/90 to-sky-950/20 p-6 sm:p-8 shadow-xl ring-1 ring-zinc-700/45 text-zinc-200';

export default function DeveloperOverview() {
  const {
    loading,
    profileActive,
    profileSuspended,
    pending,
    appState,
    catalog,
    who,
    setWho,
    why,
    setWhy,
    selectedScopes,
    setSelectedScopes,
    submitting,
    handleApply,
    scopeLabelMap,
    showAdminNotice,
    adminNoticeDetail,
    dismissAdminNotice,
    approvedScopes,
    scopeExpansionSubmitting,
    submitScopeExpansionRequest,
    setError,
    notificationEmail,
    notificationEmailSaving,
    saveNotificationEmail,
  } = useDeveloperPortal();

  const [emailDraft, setEmailDraft] = useState('');
  useEffect(() => {
    setEmailDraft(notificationEmail ?? '');
  }, [notificationEmail]);

  const [scopeRequestOpen, setScopeRequestOpen] = useState(false);
  const [rqWho, setRqWho] = useState('');
  const [rqWhy, setRqWhy] = useState('');
  const [rqScopes, setRqScopes] = useState<Set<string>>(new Set());

  const catalogForNewScopes = useMemo(
    () => catalog.filter((c) => !approvedScopes.includes(c.id)),
    [catalog, approvedScopes]
  );

  const scopeRequestPending = appState?.latestApplication?.status === 'pending';

  const openScopeRequest = () => {
    setError(null);
    setRqWho('');
    setRqWhy('');
    setRqScopes(new Set());
    setScopeRequestOpen(true);
  };

  const submitScopeRequest = async () => {
    setError(null);
    const ok = await submitScopeExpansionRequest({
      who: rqWho,
      why: rqWhy,
      additionalScopes: [...rqScopes],
    });
    if (ok) {
      setScopeRequestOpen(false);
      setRqWho('');
      setRqWhy('');
      setRqScopes(new Set());
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  const adminNoticeParsed = parseAdminNoticeDetail(adminNoticeDetail);
  const adminNoticeParagraphs = adminNoticeParsed.body
    ? adminNoticeParsed.body.split(/\n\n+/).filter((p) => p.trim().length > 0)
    : [];

  if (profileActive) {
    return (
      <div className="space-y-6">
        {showAdminNotice && (
          <div
            className={
              adminNoticeParsed.variant === 'success'
                ? devNoticeSuccessClass
                : devNoticeClass
            }
          >
            <Bell
              className={`w-5 h-5 shrink-0 mt-0.5 ${
                adminNoticeParsed.variant === 'success'
                  ? 'text-emerald-400'
                  : 'text-amber-400'
              }`}
            />
            <div className="flex-1 min-w-0">
              <p
                className={`text-sm font-semibold ${
                  adminNoticeParsed.variant === 'success'
                    ? 'text-emerald-100'
                    : 'text-amber-100'
                }`}
              >
                {adminNoticeParsed.variant === 'success'
                  ? 'Application approved'
                  : 'Something changed on your account'}
              </p>
              <div
                className={`mt-2 space-y-2 text-sm leading-relaxed ${
                  adminNoticeParsed.variant === 'success'
                    ? 'text-emerald-100/90'
                    : 'text-amber-200/90'
                }`}
              >
                {adminNoticeParagraphs.length > 0 ? (
                  adminNoticeParagraphs.map((para, i) => (
                    <p key={i}>{para.trim()}</p>
                  ))
                ) : (
                  <p>
                    {adminNoticeDetail?.trim() ||
                      'An admin updated your scopes, a key, or rate limits. Peek at Keys or the API reference when you have a minute.'}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => void dismissAdminNotice()}
              className={`shrink-0 p-1.5 rounded-lg transition-colors ${
                adminNoticeParsed.variant === 'success'
                  ? 'text-emerald-200/85 hover:bg-emerald-900/45 hover:text-emerald-50'
                  : 'text-amber-200/80 hover:bg-amber-900/40 hover:text-amber-50'
              }`}
              aria-label="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {scopeRequestPending && (
          <div className={devPendingBannerClass}>
            <Clock className="w-5 h-5 shrink-0 text-sky-400 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-sky-100">
                We&apos;re reviewing a scope request
              </p>
              <p className="text-sm text-sky-200/85 mt-1 leading-relaxed">
                Hang tight — your current access still works while we take a
                look. We&apos;ll follow up when it&apos;s sorted.
              </p>
            </div>
          </div>
        )}
        <p className="text-zinc-400 text-sm sm:text-base max-w-2xl">
          You&apos;re all set. Jump into usage, keys, or the live API reference
          whenever you like.
        </p>

        {catalogForNewScopes.length > 0 && !scopeRequestOpen && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={openScopeRequest}
              disabled={scopeRequestPending}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-zinc-600 bg-zinc-800/80 text-zinc-100 text-sm font-semibold hover:bg-zinc-800 hover:border-zinc-500 transition-colors disabled:opacity-45 disabled:pointer-events-none ring-1 ring-zinc-700/50"
            >
              <Sparkles className="w-4 h-4 shrink-0 text-sky-400" />
              Ask for more API access
            </button>
            {scopeRequestPending && (
              <span className="text-xs text-zinc-500">
                You already have one request waiting — thanks for your patience.
              </span>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            to="/developers/console"
            className={`${cardClass()} group block hover:border-zinc-600/90 transition-colors`}
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400">
                <LayoutDashboard className="w-5 h-5" />
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
            </div>
            <h2 className="text-base font-semibold text-zinc-100">Usage</h2>
            <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
              Request volume, scope mix, and recent calls.
            </p>
          </Link>
          <Link
            to="/developers/keys"
            className={`${cardClass()} group block hover:border-zinc-600/90 transition-colors`}
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                <KeyRound className="w-5 h-5" />
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
            </div>
            <h2 className="text-base font-semibold text-zinc-100">API keys</h2>
            <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
              Create, rotate, and revoke scoped keys.
            </p>
          </Link>
          <Link
            to="/developers/docs"
            className={`${cardClass()} group block hover:border-zinc-600/90 transition-colors`}
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                <BookOpen className="w-5 h-5" />
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
            </div>
            <h2 className="text-base font-semibold text-zinc-100">
              API reference
            </h2>
            <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
              Routes, parameters, and curl examples.
            </p>
          </Link>
        </div>

        <div className={`${cardClass()} w-full`}>
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-violet-500/10 text-violet-400 shrink-0">
              <Mail className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <h2 className="text-lg font-semibold text-zinc-100">
                  Email alerts
                </h2>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  (Optional) We&apos;ll email you when an administrator updates
                  your scopes, API keys, rate limits, or account status (same
                  summary as the in-portal notice).
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                <label className="flex-1 min-w-0">
                  <span className="sr-only">Notification email</span>
                  <input
                    type="email"
                    autoComplete="email"
                    value={emailDraft}
                    onChange={(e) => setEmailDraft(e.target.value)}
                    placeholder="you@example.com"
                    disabled={notificationEmailSaving}
                    className="w-full rounded-xl border border-zinc-700/90 bg-zinc-950/50 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-violet-500/70 focus:ring-1 focus:ring-violet-500/35 disabled:opacity-50"
                  />
                </label>
                <button
                  type="button"
                  disabled={
                    notificationEmailSaving ||
                    (emailDraft.trim() === '' && notificationEmail === null) ||
                    (emailDraft.trim() !== '' &&
                      emailDraft.trim() === (notificationEmail ?? ''))
                  }
                  onClick={() => {
                    setError(null);
                    void saveNotificationEmail(emailDraft.trim() || null);
                  }}
                  className="inline-flex justify-center items-center gap-2 shrink-0 px-6 py-2.5 rounded-xl border border-violet-600/50 bg-violet-950/40 text-violet-100 text-sm font-semibold hover:bg-violet-900/45 hover:border-violet-500/55 transition-colors disabled:opacity-40 disabled:pointer-events-none ring-1 ring-violet-900/25"
                >
                  {notificationEmailSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Save'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {scopeRequestOpen && (
          <DeveloperAccessRequestForm
            mode="expansion"
            who={rqWho}
            why={rqWhy}
            onWhoChange={setRqWho}
            onWhyChange={setRqWhy}
            catalog={catalogForNewScopes}
            selectedScopes={rqScopes}
            onScopesChange={setRqScopes}
            onSubmit={submitScopeRequest}
            submitting={scopeExpansionSubmitting}
            onDismiss={() => setScopeRequestOpen(false)}
          />
        )}
      </div>
    );
  }

  if (profileSuspended) {
    return (
      <div className="rounded-3xl border border-rose-900/45 bg-linear-to-br from-zinc-900/95 via-rose-950/20 to-zinc-900/95 p-6 sm:p-8 shadow-xl ring-1 ring-rose-900/20 text-zinc-200">
        <div className="flex items-center gap-2 mb-3">
          <span
            className={`text-[11px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-lg ${statusBadgeClass('suspended')}`}
          >
            Suspended
          </span>
        </div>
        <h2 className="text-lg font-semibold text-zinc-50 mb-2">
          Your developer access is on pause
        </h2>
        <p className="text-sm text-zinc-400 leading-relaxed">
          API keys won&apos;t work until an administrator turns access back on.
          If this looks wrong, reach out{' '}
          <a
            href="https://cephie.app/discord"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-400 font-medium hover:text-sky-300 underline decoration-sky-600 underline-offset-2"
          >
            on Discord
          </a>
          .
        </p>
      </div>
    );
  }

  if (pending) {
    return (
      <div className={devPendingCardClass}>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Clock className="w-5 h-5 text-amber-400 shrink-0" />
          <h2 className="text-lg font-semibold text-zinc-50">
            Application in the queue
          </h2>
          <span
            className={`text-[11px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-lg ${statusBadgeClass('pending')}`}
          >
            Pending
          </span>
        </div>
        <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
          Thanks for applying! A human will read it soon. When you&apos;re
          approved you&apos;ll be able to create keys from the Keys tab.
        </p>
        {appState?.latestApplication && (
          <div className="space-y-5 text-sm border-t border-zinc-700/80 pt-5">
            <div>
              <p className="text-xs font-semibold text-sky-400/90 mb-1.5">
                About you
              </p>
              <p className="text-zinc-200 whitespace-pre-wrap leading-relaxed">
                {appState.latestApplication.whoText}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-sky-400/90 mb-1.5">
                What you&apos;re building
              </p>
              <p className="text-zinc-200 whitespace-pre-wrap leading-relaxed">
                {appState.latestApplication.whyText}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-sky-400/90 mb-2.5">
                Scopes you asked for
              </p>
              <div className="flex flex-wrap gap-2">
                {appState.latestApplication.requestedScopes.map((id) => (
                  <span
                    key={id}
                    className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border border-sky-700/50 bg-sky-950/40 text-sky-200"
                  >
                    {scopeLabelMap.get(id) ?? id}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <DeveloperAccessRequestForm
      mode="initial"
      who={who}
      why={why}
      onWhoChange={setWho}
      onWhyChange={setWhy}
      catalog={catalog}
      selectedScopes={selectedScopes}
      onScopesChange={setSelectedScopes}
      onSubmit={() => void handleApply()}
      submitting={submitting}
    />
  );
}
