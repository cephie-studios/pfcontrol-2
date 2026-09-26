import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  Loader2,
  LayoutDashboard,
  KeyRound,
  BookOpen,
  ChevronRight,
  Bell,
  CheckCircle2,
  X,
  Clock,
  Compass,
  FileText,
  Mail,
  PauseCircle,
  ShieldAlert,
} from 'lucide-react';
import DeveloperAccessRequestForm from '../../components/developers/DeveloperAccessRequestForm';
import SettingsSection from '../../components/Settings/SettingsSection';
import SettingsGroup from '../../components/Settings/SettingsGroup';
import SettingsRow from '../../components/Settings/SettingsRow';
import { ADMIN_TONE_TEXT } from '@/components/admin/adminConstants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDeveloperPortal } from './developerPortalContext';

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

function OverviewLinkRow({
  to,
  icon,
  label,
  description,
}: {
  to: string;
  icon: ReactNode;
  label: string;
  description: string;
}) {
  return (
    <Link to={to} className="group block transition-colors hover:bg-muted/40">
      <SettingsRow
        icon={icon}
        label={label}
        description={description}
        className="flex-row items-center justify-between gap-6"
      >
        <ChevronRight className="size-4 text-muted-foreground transition-colors group-hover:text-foreground" />
      </SettingsRow>
    </Link>
  );
}

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
    setError,
    notificationEmail,
    notificationEmailSaving,
    saveNotificationEmail,
  } = useDeveloperPortal();

  const [emailDraft, setEmailDraft] = useState('');
  useEffect(() => {
    setEmailDraft(notificationEmail ?? '');
  }, [notificationEmail]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const adminNoticeParsed = parseAdminNoticeDetail(adminNoticeDetail);
  const adminNoticeParagraphs = adminNoticeParsed.body
    ? adminNoticeParsed.body.split(/\n\n+/).filter((p) => p.trim().length > 0)
    : [];

  if (profileActive) {
    const noticeSuccess = adminNoticeParsed.variant === 'success';
    const NoticeIcon = noticeSuccess ? CheckCircle2 : Bell;
    return (
      <div className="flex flex-col gap-10">
        {showAdminNotice && (
          <SettingsGroup>
            <SettingsRow
              icon={
                <NoticeIcon
                  className={
                    noticeSuccess
                      ? ADMIN_TONE_TEXT.success
                      : ADMIN_TONE_TEXT.warning
                  }
                />
              }
              label={
                noticeSuccess
                  ? 'Application approved'
                  : 'Something changed on your account'
              }
              description={
                <span className="flex flex-col gap-2 leading-relaxed">
                  {adminNoticeParagraphs.length > 0 ? (
                    adminNoticeParagraphs.map((para, i) => (
                      <span key={i}>{para.trim()}</span>
                    ))
                  ) : (
                    <span>
                      {adminNoticeDetail?.trim() ||
                        'An admin updated your scopes, a key, or rate limits. Peek at Keys or the API reference when you have a minute.'}
                    </span>
                  )}
                </span>
              }
              className="flex-row items-start justify-between gap-4 sm:items-start"
            >
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground"
                onClick={() => void dismissAdminNotice()}
                aria-label="Dismiss notification"
              >
                <X />
              </Button>
            </SettingsRow>
          </SettingsGroup>
        )}

        <SettingsSection title="Quick links" icon={Compass}>
          <SettingsGroup>
            <OverviewLinkRow
              to="/developers/console"
              icon={<LayoutDashboard className="text-sky-400" />}
              label="Usage"
              description="Request volume, scope mix, and recent calls."
            />
            <OverviewLinkRow
              to="/developers/keys"
              icon={<KeyRound className="text-blue-400" />}
              label="API keys"
              description="Create, rotate, and revoke scoped keys."
            />
            <OverviewLinkRow
              to="/developers/docs"
              icon={<BookOpen className="text-emerald-400" />}
              label="API reference"
              description="Routes, parameters, and curl examples."
            />
          </SettingsGroup>
        </SettingsSection>

        <SettingsSection title="Notifications" icon={Bell}>
          <SettingsGroup>
            <SettingsRow
              icon={<Mail className="text-blue-400" />}
              label="Email alerts"
              description="Optional. We'll email you when an admin changes your scopes, keys, rate limits, or account status."
              htmlFor="dev-notify-email"
            >
              <Input
                id="dev-notify-email"
                type="email"
                autoComplete="email"
                value={emailDraft}
                onChange={(e) => setEmailDraft(e.target.value)}
                placeholder="you@example.com"
                disabled={notificationEmailSaving}
                className="w-full sm:w-64"
              />
              <Button
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
                className="shrink-0 sm:w-20"
              >
                {notificationEmailSaving ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  'Save'
                )}
              </Button>
            </SettingsRow>
          </SettingsGroup>
        </SettingsSection>
      </div>
    );
  }

  if (profileSuspended) {
    return (
      <SettingsSection title="Developer access" icon={ShieldAlert}>
        <SettingsGroup>
          <SettingsRow
            icon={<PauseCircle className={ADMIN_TONE_TEXT.danger} />}
            label="Your developer access is on pause"
            description={
              <>
                API keys won&apos;t work until an administrator turns access
                back on. If this looks wrong, reach out{' '}
                <a
                  href="https://cephie.app/discord"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-blue-400 underline underline-offset-2 hover:text-blue-300"
                >
                  on Discord
                </a>
                .
              </>
            }
          />
        </SettingsGroup>
      </SettingsSection>
    );
  }

  if (pending) {
    const application = appState?.latestApplication;
    return (
      <SettingsSection title="Your application" icon={FileText}>
        <SettingsGroup>
          <SettingsRow
            icon={<Clock className={ADMIN_TONE_TEXT.warning} />}
            label="Application in the queue"
            description="Thanks for applying! A human will read it soon. Once approved you can create keys from the Keys tab."
          />
        </SettingsGroup>
        {application && (
          <SettingsGroup title="What you sent">
            <SettingsRow
              label="About you"
              description={
                <span className="whitespace-pre-wrap">
                  {application.whoText}
                </span>
              }
            />
            <SettingsRow
              label="What you're building"
              description={
                <span className="whitespace-pre-wrap">
                  {application.whyText}
                </span>
              }
            />
            <SettingsRow
              label="Scopes you asked for"
              description={application.requestedScopes
                .map((id) => scopeLabelMap.get(id) ?? id)
                .join(', ')}
            />
          </SettingsGroup>
        )}
      </SettingsSection>
    );
  }

  return (
    <DeveloperAccessRequestForm
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
