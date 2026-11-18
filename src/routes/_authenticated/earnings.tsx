import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { InviteEarnSection } from "@/components/oka/invite-earn-section";
import { Bars, chartColors } from "@/components/oka/open-accounting-charts";
import { Button } from "@/components/ui/button";
import { useCurrentUserId } from "@/hooks/use-is-admin";
import { canFollowUp, fetchMyEarnings, statusLabel } from "@/data/open-accounting/my-earnings";
import { formatCents } from "@/lib/affiliates";
import { POINT_RULES } from "@/lib/open-accounting/allocate";

export const Route = createFileRoute("/_authenticated/earnings")({
  head: () => ({
    meta: [
      { title: "My Earnings — Oka" },
      { name: "description", content: "Your invitations, referral and contribution earnings, and payout schedule." },
      { property: "og:title", content: "My Earnings — Oka" },
      { property: "og:description", content: "Your invitations, referral and contribution earnings, and payout schedule." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EarningsPage,
});

function formatIsoDate(iso: string) {
  if (!iso) return "—";
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function formatSigned(cents: number) {
  const formatted = formatCents(Math.abs(cents));
  if (cents > 0) return `+${formatted}`;
  if (cents < 0) return `−${formatted}`;
  return formatted;
}

function shortMonthLabel(id: string) {
  const [year, month] = id.split("-");
  if (!year || !month) return id;
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return names[Number(month) - 1] ?? id;
}

function EarningsPage() {
  const { data: uid } = useCurrentUserId();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [monthId, setMonthId] = useState<string | null>(null);

  const account = useQuery({
    queryKey: ["my-earnings", uid],
    enabled: !!uid,
    queryFn: () => fetchMyEarnings(uid!),
  });

  const data = account.data;
  const series = data?.monthSeries ?? [];
  const selectedMonthId = monthId && series.some((point) => point.id === monthId) ? monthId : series[series.length - 1]?.id ?? null;
  const selectedIndex = selectedMonthId ? series.findIndex((point) => point.id === selectedMonthId) : -1;
  const selectedMonth = selectedIndex >= 0 ? series[selectedIndex] : null;

  const yearChart = useMemo(
    () =>
      series.map((point) => ({
        label: shortMonthLabel(point.id),
        referral: point.referralCents / 100,
        contribution: point.contributionCents / 100,
      })),
    [series],
  );

  const conversion =
    selectedMonth && selectedMonth.invitedCount > 0
      ? Math.round((selectedMonth.payingCount / selectedMonth.invitedCount) * 100)
      : null;

  return (
    <div className="mx-auto max-w-4xl px-6 py-12 lg:py-16">
      <InviteEarnSection />

      {account.isLoading || !uid ? (
        <Loader2 className="mt-16 size-6 animate-spin text-primary" strokeWidth={1.5} />
      ) : account.isError ? (
        <div className="surface-card mt-16 p-6">
          <p className="text-sm text-destructive">Couldn&apos;t load your earnings.</p>
          <Button className="mt-4 rounded-full" variant="outline" onClick={() => void account.refetch()}>
            Try again
          </Button>
        </div>
      ) : data ? (
        <div className="mt-16">
          <article className="surface-card p-6">
            <p className="section-label">{data.balance.title}</p>
            <p className="mt-3 font-serif text-5xl tabular-nums text-foreground">{formatCents(Math.abs(data.balance.cents))}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {data.balance.tone === "offset"
                ? "This offsets future earnings. It is not a demand for immediate cash."
                : "After deductions and previous payouts. Subject to the payout schedule."}
            </p>
            <p className="mt-4 text-sm text-muted-foreground">Next payout {data.nextPayout.label}</p>
          </article>

          <section className="mt-12">
            <h2 className="font-serif text-3xl text-foreground">Your earnings</h2>
            <p className="mt-2 text-sm text-muted-foreground">Figures for this member account from database payments synced with Stripe</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="Total earned" value={formatCents(data.earnedCents)} note="Approved referral and contribution earnings." />
              <Metric label="Referral earnings" value={formatCents(data.referralCents)} note="Approved credits from people you invited." />
              <Metric label="Contribution earnings" value={formatCents(data.contributionCents)} note="Approved event earnings after point conversion." />
              <Metric label="Adjustments" value={formatSigned(data.adjustmentCents)} note="Credits, minus advances and deductions." />
            </div>
          </section>

          {series.length > 0 && (
            <section className="mt-12">
              <p className="section-label">Earnings over the year</p>
              <div className="surface-card mt-4 p-6">
                <p className="text-sm text-muted-foreground">Approved referral credits and approved contribution cash by month.</p>
                <div className="mt-4 h-56" role="img" aria-label="Earnings over the year">
                  <YearBars data={yearChart} />
                </div>
              </div>
            </section>
          )}

          {selectedMonth && (
            <section className="mt-12">
              <p className="section-label">Referral performance</p>
              <div className="surface-card mt-4 p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    className="rounded-full"
                    variant="secondary"
                    disabled={selectedIndex <= 0}
                    onClick={() => setMonthId(series[selectedIndex - 1]?.id ?? null)}
                  >
                    Previous month
                  </Button>
                  <p className="px-2 font-medium text-foreground">{selectedMonth.label}</p>
                  <Button
                    type="button"
                    className="rounded-full"
                    variant="secondary"
                    disabled={selectedIndex >= series.length - 1}
                    onClick={() => setMonthId(series[selectedIndex + 1]?.id ?? null)}
                  >
                    Next month
                  </Button>
                </div>
                <dl className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                  <Stat label="Invited" value={String(selectedMonth.invitedCount)} />
                  <Stat label="Became paying" value={String(selectedMonth.payingCount)} />
                  <Stat label="Conversion" value={conversion === null ? "—" : `${conversion}%`} />
                  <Stat label="Earned this month" value={formatCents(selectedMonth.referralCents)} />
                  <Stat
                    label="Contribution this month"
                    value={formatCents(selectedMonth.contributionCents)}
                  />
                </dl>
                {data.pendingCents > 0 && (
                  <p className="mt-4 text-sm text-muted-foreground">
                    {formatCents(data.pendingCents)} is estimated and not yet approved.
                  </p>
                )}
                <Bars
                  data={series.map((point) => ({ label: shortMonthLabel(point.id), value: point.invitedCount }))}
                  name="New invitations"
                  color={chartColors.terracotta}
                  money={false}
                  label="New invitations each month"
                />
                <Bars
                  data={series.map((point) => ({ label: shortMonthLabel(point.id), value: point.referralCents }))}
                  name="Referral income"
                  color={chartColors.sage}
                  money
                  label="Approved referral income each month"
                />
              </div>
            </section>
          )}

          <section className="mt-12">
            <p className="section-label">People you invited</p>
            {data.invites.length === 0 ? (
              <div className="surface-card mt-4 flex items-center gap-3 p-6 text-muted-foreground">
                <Users className="size-5 text-primary" strokeWidth={1.5} />
                No one yet — your first invitation is one message away.
              </div>
            ) : (
              <div className="surface-card mt-4 max-w-full overflow-x-auto">
                <table className="w-full min-w-180 text-left text-sm">
                  <thead className="text-xs uppercase tracking-widest text-muted-foreground">
                    <tr>
                      {["Name", "Registered", "Status", "Membership", "Reward", "Last payment", "Next action"].map((heading) => (
                        <th key={heading} className="px-4 py-3 font-medium">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.invites.map((invite) => (
                      <tr key={invite.id} className="border-t border-border align-top">
                        <td className="px-4 py-3 font-medium text-foreground">{invite.firstName}</td>
                        <td className="px-4 py-3 text-muted-foreground">{formatIsoDate(invite.registered)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{statusLabel(invite.status)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{invite.membershipType ?? "Not shared"}</td>
                        <td className="px-4 py-3 text-foreground">
                          {formatCents(invite.earnedCents)}
                          {invite.pendingCents > 0 ? ` · ${formatCents(invite.pendingCents)} pending` : ""}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{invite.lastPayment ? formatIsoDate(invite.lastPayment) : "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {canFollowUp(invite.status) ? "Follow-up available" : "Follow-up closed"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="mt-12">
            <p className="section-label">Contribution earnings</p>
            <div className="surface-card mt-4 p-6">
              <p className="text-sm leading-relaxed text-muted-foreground">
                Eligible hosted events can earn points toward the contributor reward pool. Points stay visible here, and approved dollars appear after conversion.
                Point rules: {POINT_RULES.perHostedEvent} per hosted event and {POINT_RULES.perVerifiedAttendee} per verified attendee.
              </p>
              <dl className="mt-5 grid gap-4 sm:grid-cols-3">
                <Stat label="Events" value={String(data.events.length)} />
                <Stat label="Points" value={String(data.events.reduce((total, event) => total + event.points, 0))} />
                <Stat label="Approved earnings" value={formatCents(data.contributionCents)} />
              </dl>
              {data.events.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  Your contribution journey starts here.{" "}
                  <Link to="/events/new" className="text-primary hover:underline">
                    Create your first event
                  </Link>
                  .
                </p>
              ) : (
                <div className="mt-4 max-w-full overflow-x-auto">
                  <table className="w-full min-w-180 text-left text-sm">
                    <thead className="text-xs uppercase tracking-widest text-muted-foreground">
                      <tr>
                        {["Event", "Date", "Number", "Status", "Registered", "Verified", "Points", "Earnings"].map((heading) => (
                          <th key={heading} className="py-2 pr-3 font-medium">
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.events.map((event) => (
                        <tr key={event.id} className="border-t border-border">
                          <td className="py-3 pr-3 font-medium text-foreground">{event.name}</td>
                          <td className="py-3 pr-3 text-muted-foreground">{formatIsoDate(event.date)}</td>
                          <td className="py-3 pr-3 text-muted-foreground">{event.number}</td>
                          <td className="py-3 pr-3 text-muted-foreground">{event.status}</td>
                          <td className="py-3 pr-3 text-muted-foreground">{event.registered}</td>
                          <td className="py-3 pr-3 text-muted-foreground">{event.verified}</td>
                          <td className="py-3 pr-3 text-muted-foreground">{event.points}</td>
                          <td className="py-3 pr-3 text-foreground">{formatCents(event.earningsCents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          <section className="mt-12">
            <p className="section-label">Advances, deductions, and balance</p>
            <div className="surface-card mt-4 p-6">
              <p className="text-sm text-muted-foreground">
                Net balance = approved earnings + credits − advances − deductions − previous payouts.
              </p>
              {data.statement.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">No advances, deductions, or credits yet.</p>
              ) : (
                <div className="mt-4 max-w-full overflow-x-auto">
                  <table className="w-full min-w-140 text-left text-sm">
                    <thead className="text-xs uppercase tracking-widest text-muted-foreground">
                      <tr>
                        {["Date", "Reason", "Reference", "Amount"].map((heading) => (
                          <th key={heading} className="py-2 pr-3 font-medium">
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.statement.map((row) => (
                        <tr key={row.id} className="border-t border-border">
                          <td className="py-3 pr-3 text-muted-foreground">{formatIsoDate(row.date)}</td>
                          <td className="py-3 pr-3 text-foreground">{row.reason}</td>
                          <td className="py-3 pr-3 text-muted-foreground">{row.reference ?? "—"}</td>
                          <td className="py-3 pr-3 text-foreground">
                            {row.kind === "credit" ? formatCents(row.cents) : formatSigned(-row.cents)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <dl className="mt-4 divide-y divide-border text-sm">
                <Line label="Approved earnings" value={formatCents(data.earnedCents)} />
                <Line
                  label="Credits"
                  value={formatCents(data.statement.filter((row) => row.kind === "credit").reduce((total, row) => total + row.cents, 0))}
                />
                <Line
                  label="Advances"
                  value={formatSigned(-data.statement.filter((row) => row.kind === "advance").reduce((total, row) => total + row.cents, 0))}
                />
                <Line
                  label="Deductions"
                  value={formatSigned(-data.statement.filter((row) => row.kind === "deduction").reduce((total, row) => total + row.cents, 0))}
                />
                <Line label="Previous payouts" value={formatSigned(-data.paidCents)} />
                <Line label={data.balance.title} value={formatSigned(data.balance.cents)} />
              </dl>
            </div>
          </section>

          <section className="mt-12">
            <p className="section-label">Payout schedule</p>
            <div className="surface-card mt-4 p-6">
              <p className="text-sm leading-relaxed text-muted-foreground">
                On the 20th of every month, eligible earnings from the previous calendar month are scheduled.
              </p>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                <Stat label="Current earnings period" value={data.nextPayout.coversLabel} />
                <Stat label="Next scheduled payout" value={data.nextPayout.label} />
                <Stat label="Pending approval" value={formatCents(data.pendingCents)} />
                <Stat label="Available payout" value={formatCents(Math.max(data.balance.cents, 0))} />
                <Stat label="Already paid" value={formatCents(data.paidCents)} />
                <div>
                  <dt className="section-label">Payment method</dt>
                  <dd className="mt-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full"
                      onClick={() => setPaymentOpen((open) => !open)}
                      aria-expanded={paymentOpen}
                    >
                      {data.paymentMethod ?? "No payout method on file"}
                    </Button>
                  </dd>
                </div>
              </dl>
              {paymentOpen && (
                <div className="mt-4 rounded-2xl bg-secondary p-4 text-secondary-foreground" role="dialog" aria-label="Payout method">
                  <p className="font-medium">Add or change payout method</p>
                  <p className="mt-2 text-sm">
                    Contact the Oka team to add a bank transfer or another approved payout method. Account numbers stay hidden.
                  </p>
                  <Button type="button" className="mt-3 rounded-full" variant="ghost" onClick={() => setPaymentOpen(false)}>
                    Close
                  </Button>
                </div>
              )}
              {data.payouts.length > 0 && (
                <div className="mt-4 max-w-full overflow-x-auto">
                  <table className="w-full min-w-140 text-left text-sm">
                    <thead className="text-xs uppercase tracking-widest text-muted-foreground">
                      <tr>
                        {["Date", "Covers", "Amount", "Status", "Method"].map((heading) => (
                          <th key={heading} className="py-2 pr-3 font-medium">
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.payouts.map((payout) => (
                        <tr key={payout.id} className="border-t border-border">
                          <td className="py-3 pr-3 text-muted-foreground">{formatIsoDate(payout.date)}</td>
                          <td className="py-3 pr-3 text-muted-foreground">{payout.covers}</td>
                          <td className="py-3 pr-3 text-foreground">{formatCents(payout.cents)}</td>
                          <td className="py-3 pr-3 text-muted-foreground">{payout.status}</td>
                          <td className="py-3 pr-3 text-muted-foreground">{payout.method ?? data.paymentMethod ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function YearBars({ data }: { data: { label: string; referral: number; contribution: number }[] }) {
  const compactUsd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={chartColors.sand} vertical={false} />
        <XAxis dataKey="label" tick={{ fill: chartColors.ink, fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={(value: number) => compactUsd.format(value)} tick={{ fill: chartColors.ink, fontSize: 12 }} axisLine={false} tickLine={false} width={56} />
        <Tooltip
          formatter={(value, name) => [compactUsd.format(Number(value)), String(name)]}
          contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))" }}
        />
        <Bar dataKey="referral" name="Referral" stackId="earn" fill={chartColors.terracotta} isAnimationActive={false} />
        <Bar dataKey="contribution" name="Contribution" stackId="earn" fill={chartColors.sage} radius={[6, 6, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <article className="surface-card p-5">
      <h3 className="section-label">{label}</h3>
      <p className="mt-3 font-serif text-3xl tabular-nums text-foreground">{value}</p>
      <p className="mt-2 text-sm text-muted-foreground">{note}</p>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="section-label">{label}</dt>
      <dd className="mt-1 font-serif text-2xl tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-serif text-2xl tabular-nums text-foreground">{value}</dd>
    </div>
  );
}
