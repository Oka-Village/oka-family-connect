import { useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";

import { HeaderBand } from "@/components/oka/pods/header-band";
import { PodsButton } from "@/components/oka/pods/pods-button";
import { SeatCircle } from "@/components/oka/pods/seat-circle";
import { POD_ENCOUNTER_COUNT, POD_MEMBER_SEATS } from "@/lib/pods/constants";
import { createPod } from "@/lib/pods/pods.functions";
import { useProfile } from "@/hooks/use-profile";

type Enc = { topic: string; starts: string; ends: string };

export function PodsCreatePage() {
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  const [title, setTitle] = useState("One World Family Pod");
  const [description, setDescription] = useState("");
  const [timezone, setTimezone] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  );
  const [meetUrl, setMeetUrl] = useState("");
  const [encounters, setEncounters] = useState<Enc[]>(() =>
    Array.from({ length: POD_ENCOUNTER_COUNT }, () => ({ topic: "", starts: "", ends: "" })),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function up(i: number, key: keyof Enc, value: string) {
    setEncounters((prev) => prev.map((e, j) => (j === i ? { ...e, [key]: value } : e)));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const result = await createPod({
        data: {
          title,
          description: description || null,
          photoUrl: null,
          timezone,
          meetUrl: meetUrl || null,
          encounters: encounters.map((enc) => ({
            topic: enc.topic,
            startsAt: new Date(enc.starts).toISOString(),
            endsAt: enc.ends ? new Date(enc.ends).toISOString() : null,
          })),
        },
      });
      void navigate({ to: "/pods/$podId", params: { podId: result.pod.id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the pod.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pods-ui pb-16">
      <HeaderBand
        tone="sun"
        eyebrow="Facilitator"
        title={
          <>
            Open a <i>new pod</i>
          </>
        }
        lead="Set all three encounters at once. An admin reviews it before members see it (staff publish immediately)."
      />
      <div className="pods-wrap grid items-start gap-8 py-12 max-[1100px]:grid-cols-1 lg:grid-cols-[1fr_340px]">
        <form
          onSubmit={onSubmit}
          className="flex flex-col gap-6 rounded-[var(--pods-radius-lg)] border border-[color:var(--pods-line-hairline)] bg-[color:var(--pods-surface-card)] p-8 max-[720px]:p-4"
        >
          <label className="flex flex-col gap-2 text-sm font-semibold">
            Pod name
            <input
              className="min-h-12 rounded-[var(--pods-radius-md)] border border-[color:var(--pods-line-control)] bg-[color:var(--pods-surface-card)] px-4 font-normal"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={120}
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-semibold">
            Description
            <textarea
              className="min-h-24 rounded-[var(--pods-radius-md)] border border-[color:var(--pods-line-control)] bg-[color:var(--pods-surface-card)] px-4 py-3 font-normal"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={4000}
            />
          </label>
          <fieldset className="m-0 border-0 p-0">
            <legend className="mb-3 text-[17px] font-semibold">Three encounters</legend>
            <div className="flex flex-col gap-3">
              {encounters.map((enc, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[110px_1fr_1fr] items-center gap-3 rounded-[var(--pods-radius-md)] bg-[color:var(--pods-surface-linen)] px-4 py-3 max-[720px]:grid-cols-1"
                >
                  <b className="text-sm">Encounter {i + 1}</b>
                  <input
                    className="min-h-12 rounded-[var(--pods-radius-md)] border border-[color:var(--pods-line-control)] bg-[color:var(--pods-surface-card)] px-3 font-normal"
                    placeholder="Topic"
                    value={enc.topic}
                    onChange={(e) => up(i, "topic", e.target.value)}
                    required
                    maxLength={80}
                  />
                  <input
                    type="datetime-local"
                    className="min-h-12 rounded-[var(--pods-radius-md)] border border-[color:var(--pods-line-control)] bg-[color:var(--pods-surface-card)] px-3 font-normal"
                    value={enc.starts}
                    onChange={(e) => up(i, "starts", e.target.value)}
                    required
                  />
                </div>
              ))}
            </div>
          </fieldset>
          <div className="grid grid-cols-2 gap-4 max-[720px]:grid-cols-1">
            <label className="flex flex-col gap-2 text-sm font-semibold">
              Time zone
              <input
                className="min-h-12 rounded-[var(--pods-radius-md)] border border-[color:var(--pods-line-control)] bg-[color:var(--pods-surface-card)] px-4 font-normal"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                required
              />
            </label>
            <div className="flex flex-col gap-2 text-sm font-semibold">
              Seats
              <div className="flex min-h-12 items-center gap-3 rounded-[var(--pods-radius-md)] bg-[color:var(--pods-surface-linen)] px-4 text-sm font-normal">
                {POD_MEMBER_SEATS} members and a facilitator
              </div>
            </div>
          </div>
          <label className="flex flex-col gap-2 text-sm font-semibold">
            Meeting link
            <input
              className="min-h-12 rounded-[var(--pods-radius-md)] border border-[color:var(--pods-line-control)] bg-[color:var(--pods-surface-card)] px-4 font-normal"
              value={meetUrl}
              onChange={(e) => setMeetUrl(e.target.value)}
              placeholder="https://meet.google.com/…"
            />
            <small className="font-normal text-[color:var(--pods-ink-muted)]">
              Only shown to members of this pod.
            </small>
          </label>
          {error ? (
            <p className="rounded-[var(--pods-radius-md)] bg-[color:var(--pods-tint-fire)] px-4 py-3 text-sm text-[color:var(--pods-ink-fire)]" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <PodsButton variant="primary" type="submit" disabled={saving}>
              {saving ? "Saving…" : "Send for review"}
            </PodsButton>
            <PodsButton variant="outline" href="/pods">
              Cancel
            </PodsButton>
          </div>
        </form>
        <aside className="flex flex-col gap-6">
          <div className="flex justify-center rounded-[var(--pods-radius-lg)] border border-[color:var(--pods-line-hairline)] bg-[color:var(--pods-surface-card)] p-6">
            <SeatCircle
              facilitatorName={profile?.display_name ?? "You"}
              facilitatorAvatar="ana"
              members={[]}
            />
          </div>
          <p className="text-center text-sm text-[color:var(--pods-ink-secondary)]">
            Your circle waits for {POD_MEMBER_SEATS} members.
          </p>
        </aside>
      </div>
    </div>
  );
}
