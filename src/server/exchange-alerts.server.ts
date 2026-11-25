/**
 * Home, stay, skill session and appreciation alerts. Best-effort: every send is
 * wrapped so failures never undo the member's action. In-app rows double as the
 * dedupe key, so repeated calls never re-send.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { PRODUCTION_ORIGIN } from "@/lib/affiliate-share";
import { firstNameFromDisplayName } from "@/lib/event-notifications";
import {
  appreciationRecipientNotice, formatStayDates, housePublishedAdminNotice, housePublishedHostNotice,
  skillProviderNotice, skillStatusRequesterNotice, stayAdminNotice, stayGuestNotice, stayHostNotice, stayStatusGuestNotice,
} from "@/lib/exchange-notifications";
import { emailOf, emailStaff, inAppOnce, profileName, safe, staffIds } from "@/server/community-alerts.server";
import { sendResendEmail } from "@/server/email.server";
import { sendSlackEventAlert } from "@/server/slack.server";

const db = () => supabaseAdmin as unknown as SupabaseClient;
const O = PRODUCTION_ORIGIN;

async function mail(userId: string, notice: Parameters<typeof sendResendEmail>[0]["notice"]) {
  const to = await emailOf(userId);
  if (to) await sendResendEmail({ to, notice });
}

async function tzOf(userId: string) {
  const { data } = await db().from("profiles").select("timezone").eq("id", userId).maybeSingle();
  return (data as { timezone?: string | null } | null)?.timezone || "UTC";
}

function formatWhen(iso: string, tz: string) {
  try {
    return new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: tz, timeZoneName: "short" });
  } catch { return new Date(iso).toUTCString(); }
}

async function staffInApp(type: string, title: string, body: string, link: string) {
  let fresh = false;
  for (const id of await staffIds()) fresh = (await inAppOnce(id, type, title, body, link)) || fresh;
  return fresh;
}

export async function announceExchange(input: { kind: "house" | "booking" | "session" | "letter"; id: string; userId: string }) {
  await safe(`exchange ${input.kind}`, async () => {
    if (input.kind === "house") return house(input.id, input.userId);
    if (input.kind === "booking") return booking(input.id, input.userId);
    if (input.kind === "session") return session(input.id, input.userId);
    return letter(input.id, input.userId);
  });
}

async function house(id: string, userId: string) {
  const { data } = await db().from("houses").select("id,owner_id,title,status").eq("id", id).maybeSingle();
  const h = data as { owner_id: string; title: string; status: string } | null;
  if (!h || h.owner_id !== userId || h.status !== "published") return;
  const link = `/houses/${id}`;
  const host = (await profileName(userId)).name;
  const fresh = await inAppOnce(userId, "house_published", "Your home is open to family", `${h.title} is now visible to members.`, link);
  if (!fresh) return;
  await safe("house host email", () => mail(userId, housePublishedHostNotice({ firstName: firstNameFromDisplayName(host), title: h.title, url: `${O}${link}` })));
  await safe("house admin in-app", () => staffInApp("house_published_admin", `New home: ${h.title}`, `Listed by ${host}`, link));
  await safe("house admin email", () => emailStaff(housePublishedAdminNotice({ host, title: h.title, url: `${O}${link}` })));
  await safe("house slack", () => sendSlackEventAlert(`🏡 New home listed by ${host}: ${h.title}\n${O}${link}`));
}

type BookingRow = { guest_id: string; host_id: string; check_in: string; check_out: string; nights: number | null; message: string | null; status: string; houses: { title?: string } | null };

async function booking(id: string, userId: string) {
  const { data } = await db().from("bookings").select("guest_id,host_id,check_in,check_out,nights,message,status,houses(title)").eq("id", id).maybeSingle();
  const b = data as BookingRow | null;
  if (!b || (b.guest_id !== userId && b.host_id !== userId)) return;
  const title = b.houses?.title ?? "a home";
  const [guest, host] = await Promise.all([profileName(b.guest_id), profileName(b.host_id)]);
  const dates = formatStayDates(b.check_in, b.check_out);
  const nights = b.nights ?? 0;
  const admin = (status: string) => safe("stay admin", async () => {
    const fresh = await staffInApp("stay_admin", `Stay ${status}: ${guest.name} at ${title}`, `Host: ${host.name} · ${dates}`, `/stays#${id}-${status}`);
    if (fresh) await emailStaff(stayAdminNotice({ guest: guest.name, host: host.name, title, dates, status, url: `${O}/admin` }));
  });

  if (b.status === "pending" && userId === b.guest_id) {
    if (!(await inAppOnce(b.host_id, "stay_request", `${guest.name} requested to stay`, `${title} · ${dates}`, `/stays?tab=hosting#${id}`))) return;
    await safe("stay host email", () => mail(b.host_id, stayHostNotice({ firstName: firstNameFromDisplayName(host.name), guest: guest.name, title, dates, message: b.message, url: `${O}/stays?tab=hosting` })));
    await safe("stay guest email", () => mail(b.guest_id, stayGuestNotice({ firstName: firstNameFromDisplayName(guest.name), title, host: host.name, dates, nights, url: `${O}/stays` })));
    await admin("requested");
    return;
  }
  if ((b.status === "approved" || b.status === "declined") && userId === b.host_id) {
    const approved = b.status === "approved";
    if (!(await inAppOnce(b.guest_id, approved ? "stay_approved" : "stay_declined", approved ? "Your stay is confirmed" : "Your stay request was declined", `${title} · ${dates}`, `/stays#${id}-${b.status}`))) return;
    await safe("stay status email", () => mail(b.guest_id, stayStatusGuestNotice({ firstName: firstNameFromDisplayName(guest.name), title, host: host.name, dates, approved, url: approved ? `${O}/stays` : `${O}/houses` })));
    await admin(b.status);
  }
}

type SessionRow = { requester_id: string; host_id: string; proposed_at: string; message: string | null; status: string; skills: { title?: string } | null };

async function session(id: string, userId: string) {
  const { data } = await db().from("skill_session_requests").select("requester_id,host_id,proposed_at,message,status,skills(title)").eq("id", id).maybeSingle();
  const s = data as SessionRow | null;
  if (!s || (s.requester_id !== userId && s.host_id !== userId)) return;
  const title = s.skills?.title ?? "a skill";
  const [requester, host] = await Promise.all([profileName(s.requester_id), profileName(s.host_id)]);

  if (s.status === "pending" && userId === s.requester_id) {
    if (!(await inAppOnce(s.host_id, "skill_request", `${requester.name} requested a session`, title, `/sessions?tab=incoming#${id}`))) return;
    const when = formatWhen(s.proposed_at, await tzOf(s.host_id));
    await safe("skill provider email", () => mail(s.host_id, skillProviderNotice({ firstName: firstNameFromDisplayName(host.name), requester: requester.name, title, when, message: s.message, url: `${O}/sessions?tab=incoming` })));
    return;
  }
  if ((s.status === "accepted" || s.status === "declined") && userId === s.host_id) {
    const accepted = s.status === "accepted";
    if (!(await inAppOnce(s.requester_id, accepted ? "skill_accepted" : "skill_declined", accepted ? "Your session is confirmed" : "Your session request was declined", title, `/sessions#${id}-${s.status}`))) return;
    const when = formatWhen(s.proposed_at, await tzOf(s.requester_id));
    await safe("skill status email", () => mail(s.requester_id, skillStatusRequesterNotice({ firstName: firstNameFromDisplayName(requester.name), title, host: host.name, when, accepted, url: accepted ? `${O}/sessions` : `${O}/skills` })));
  }
}

async function letter(id: string, userId: string) {
  const { data } = await db().from("appreciation_letters").select("sender_id,recipient_id").eq("id", id).maybeSingle();
  const l = data as { sender_id: string; recipient_id: string } | null;
  if (!l || l.sender_id !== userId || l.recipient_id === userId) return;
  const sender = (await profileName(userId)).name;
  if (!(await inAppOnce(l.recipient_id, "appreciation", `${sender} sent you a note of appreciation`, "Open it in your Appreciation space.", `/home/appreciation#${id}`))) return;
  const recipient = (await profileName(l.recipient_id)).name;
  await safe("appreciation email", () => mail(l.recipient_id, appreciationRecipientNotice({ firstName: firstNameFromDisplayName(recipient), sender, url: `${O}/home/appreciation` })));
}
