import type { EventNotice } from "@/lib/event-notifications";

/** Browser-safe copy for home, stay, skill session and appreciation alerts. */
const n = (subject: string, paragraphs: string[], links: EventNotice["links"], kumoji = true): EventNotice => ({ subject, paragraphs, links, kumoji });

export function housePublishedHostNotice(p: { firstName: string; title: string; url: string }) {
  return n(`Your home is open to family: ${p.title}`, [`Dear ${p.firstName},`, `${p.title} is now published and members of OneWorld Family can see it and request a stay.`, "You'll get an email each time someone asks to stay."], [{ label: "View your home", href: p.url }]);
}
export function housePublishedAdminNotice(p: { host: string; title: string; url: string }) {
  return n(`New home listed by ${p.host}: ${p.title}`, [`${p.host} published a new home: ${p.title}.`], [{ label: "View the home", href: p.url }], false);
}
export function stayGuestNotice(p: { firstName: string; title: string; host: string; dates: string; nights: number; url: string }) {
  return n(`Your stay request for ${p.title} was sent`, [`Dear ${p.firstName},`, `Your request to stay at ${p.title} was sent to ${p.host}.`, `Dates: ${p.dates} (${p.nights} ${p.nights === 1 ? "night" : "nights"}, ${p.nights} ${p.nights === 1 ? "credit" : "credits"} reserved).`, "We'll email you as soon as they reply."], [{ label: "See your stays", href: p.url }]);
}
export function stayHostNotice(p: { firstName: string; guest: string; title: string; dates: string; message: string | null; url: string }) {
  return n(`${p.guest} requested to stay at your home`, [`Dear ${p.firstName},`, `${p.guest} would like to stay at ${p.title}.`, `Dates: ${p.dates}.`, ...(p.message ? [`Their message: "${p.message}"`] : []), "Please accept or decline the request."], [{ label: "Review the request", href: p.url }]);
}
export function stayAdminNotice(p: { guest: string; host: string; title: string; dates: string; status: string; url: string }) {
  return n(`Stay ${p.status}: ${p.guest} at ${p.title}`, [`Guest: ${p.guest}. Host: ${p.host}.`, `Dates: ${p.dates}.`, `Status: ${p.status}.`], [{ label: "Open admin", href: p.url }], false);
}
export function stayStatusGuestNotice(p: { firstName: string; title: string; host: string; dates: string; approved: boolean; url: string }) {
  return p.approved
    ? n(`Your stay at ${p.title} is confirmed`, [`Dear ${p.firstName},`, `${p.host} approved your stay at ${p.title}.`, `Dates: ${p.dates}.`], [{ label: "See your stay", href: p.url }])
    : n(`Update on your stay request for ${p.title}`, [`Dear ${p.firstName},`, `${p.host} couldn't host you for ${p.dates}. Your reserved credits have been returned.`], [{ label: "Find another home", href: p.url }]);
}
export function skillProviderNotice(p: { firstName: string; requester: string; title: string; when: string; message: string | null; url: string }) {
  return n(`${p.requester} requested an hour of your skill: ${p.title}`, [`Dear ${p.firstName},`, `${p.requester} would like a session of ${p.title}.`, `Proposed time: ${p.when}.`, ...(p.message ? [`Their message: "${p.message}"`] : []), "Please accept or decline the request."], [{ label: "Review the request", href: p.url }]);
}
export function skillStatusRequesterNotice(p: { firstName: string; title: string; host: string; when: string; accepted: boolean; url: string }) {
  return p.accepted
    ? n(`Your session for ${p.title} is confirmed`, [`Dear ${p.firstName},`, `${p.host} accepted your session request for ${p.title}.`, `Time: ${p.when}.`], [{ label: "See your sessions", href: p.url }])
    : n(`Update on your session request for ${p.title}`, [`Dear ${p.firstName},`, `${p.host} couldn't take your session for ${p.title}. Your reserved credits have been returned.`], [{ label: "Explore other skills", href: p.url }]);
}
export function appreciationRecipientNotice(p: { firstName: string; sender: string; url: string }) {
  return n(`${p.sender} sent you a note of appreciation`, [`Dear ${p.firstName},`, `${p.sender} wrote you a letter of appreciation on OneWorld Family.`], [{ label: "Read your letter", href: p.url }]);
}

export function formatStayDates(checkIn: string, checkOut: string) {
  const f = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  return `${f(checkIn)} – ${f(checkOut)}`;
}
