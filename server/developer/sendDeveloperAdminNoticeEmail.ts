import { Resend } from "resend";
import { getDeveloperProfile } from "../db/developer.js";
import { createDeveloperNotificationUnsubscribeUrl } from "./developerNotificationUnsubscribeToken.js";

const NOTICE_SUCCESS_PREFIX = "[[success]]";
const EMAIL_MAX_LEN = 320;
const DEFAULT_DEVELOPER_NOTICE_TEMPLATE_ID = "pfcontrol-devs";

function isPlausibleDeveloperNotificationEmail(s: string): boolean {
  const t = s.trim();
  if (t.length < 3 || t.length > EMAIL_MAX_LEN) return false;
  if (/\s/.test(t)) return false;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return false;
  return true;
}

function subjectForNotice(detail: string): string {
  const d = detail.trim();
  if (d.startsWith(NOTICE_SUCCESS_PREFIX)) {
    return "Your developer application was approved";
  }
  return "Your developer account was updated";
}

function bodyForNotice(detail: string): string {
  let text = detail.trim();
  if (text.startsWith(NOTICE_SUCCESS_PREFIX)) {
    text = text
      .slice(NOTICE_SUCCESS_PREFIX.length)
      .replace(/^\s*\n+/, "")
      .trim();
  }
  if (!text) {
    text = "An administrator updated your developer settings.";
  }
  const base = process.env.FRONTEND_URL?.replace(/\/$/, "");
  if (base) {
    return `${text}\n\nOpen your developer portal: ${base}/developers`;
  }
  return text;
}

function developerNoticeTemplateId(): string {
  return (
    process.env.RESEND_DEVELOPER_NOTICE_TEMPLATE_ID?.trim() ||
    DEFAULT_DEVELOPER_NOTICE_TEMPLATE_ID
  );
}

export async function sendDeveloperAdminNoticeEmail(
  userId: string,
  detail: string
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return;

  const templateId = developerNoticeTemplateId();

  const profile = await getDeveloperProfile(userId);
  if (!profile) return;

  const raw = profile.notification_email;
  const to = typeof raw === "string" ? raw.trim() : "";
  if (!to || !isPlausibleDeveloperNotificationEmail(to)) return;

  const subject = subjectForNotice(detail);
  const body = bodyForNotice(detail);
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  let unsubscribeUrl: string;
  try {
    unsubscribeUrl = createDeveloperNotificationUnsubscribeUrl(userId, to);
  } catch (e) {
    console.error(
      "[developer admin notice email] failed to build unsubscribe URL",
      e
    );
    return;
  }

  const resend = new Resend(apiKey);

  const { error } = await resend.emails.send({
    to: [to],
    subject,
    ...(from ? { from } : {}),
    template: {
      id: templateId,
      variables: {
        subject,
        body,
        unsubscribe_url: unsubscribeUrl,
      },
    },
  });
  if (error) {
    console.error("[developer admin notice email] Resend error:", error);
  }
}
