import { Resend } from "resend";
import { KUMOJI, KUMOJI_JOY, noticeText, type EventNotice } from "@/lib/event-notifications";

export type MailAttachment = { filename: string; content: string; contentType?: string | undefined };

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function ctaButton(label: string, href: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 12px;"><tr><td style="border-radius:999px;background:#BB6A4D;"><a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 22px;font-family:Inter,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;line-height:1.2;color:#FAF6EF;text-decoration:none;">${escapeHtml(label)}</a></td></tr></table>`;
}

export function renderNoticeHtml(notice: EventNotice) {
  const paragraphs = notice.paragraphs.map((paragraph) =>
    `<p style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:18px;line-height:1.55;color:#372C24;">${escapeHtml(paragraph)}</p>`,
  ).join("");
  const links = notice.links.map((link) => ctaButton(link.label, link.href)).join("");
  const closing = notice.kumoji
    ? `<div style="margin:28px 0 0;">${
      notice.mood === "joy"
        ? `<p style="margin:0 0 8px;font-family:'Noto Sans JP',Inter,Helvetica,Arial,sans-serif;font-size:22px;line-height:1.4;color:#BB6A4D;">${escapeHtml(KUMOJI_JOY)}</p>`
        : ""
    }<p style="margin:0;font-family:'Noto Sans JP',Inter,Helvetica,Arial,sans-serif;font-size:20px;line-height:1.4;color:#BB6A4D;">${escapeHtml(KUMOJI)}</p></div>`
    : "";
  const footer = notice.kumoji
    ? `<p style="margin:28px 0 0;font-family:Inter,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.4;color:#8c6a52;">Made with care for our family</p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#FAF6EF;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF6EF;"><tr><td style="padding:32px 16px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#FAF6EF;border:1px solid #E4DACD;border-radius:24px;"><tr><td style="padding:36px 28px;"><p style="margin:0 0 18px;font-family:Inter,Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#BB6A4D;">OneWorld Family</p><h1 style="margin:0 0 20px;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.25;font-weight:normal;color:#372C24;">${escapeHtml(notice.subject)}</h1>${paragraphs}${links}${closing}${footer}</td></tr></table></td></tr></table></body></html>`;
}

export function resendConfigured() {
  return Boolean(process.env["RESEND_API_KEY"] && process.env["RESEND_FROM_EMAIL"]);
}

export async function sendResendEmail(input: { to: string; notice: EventNotice; attachment?: MailAttachment | null | undefined }) {
  const apiKey = process.env["RESEND_API_KEY"];
  const from = process.env["RESEND_FROM_EMAIL"];
  if (!apiKey || !from) return { ok: false as const, reason: "not_configured" as const };
  try {
    const resend = new Resend(apiKey);
    const message = {
      from,
      to: input.to,
      subject: input.notice.subject,
      text: noticeText(input.notice),
      html: renderNoticeHtml(input.notice),
    };
    const result = await resend.emails.send(input.attachment ? {
      ...message,
      attachments: [{
        filename: input.attachment.filename,
        content: Buffer.from(input.attachment.content, "utf8"),
        contentType: input.attachment.contentType ?? "text/calendar",
      }],
    } : message);
    if (result.error) return { ok: false as const, reason: "failed" as const, error: result.error.message };
    return { ok: true as const, id: result.data?.id ?? "" };
  } catch (error) {
    return { ok: false as const, reason: "failed" as const, error: error instanceof Error ? error.message : "Email failed" };
  }
}
