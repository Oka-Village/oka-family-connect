import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { POD_MEMBER_SEATS, POD_ENCOUNTER_COUNT } from "@/lib/pods/constants";
import type { PodListItem, PodRow } from "@/lib/pods/types";

async function assertCanCreate(
  supabase: { from: (t: string) => any },
  userId: string,
): Promise<{ isStaff: boolean }> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = new Set((data ?? []).map((r: { role: string }) => r.role));
  const isStaff = roles.has("admin") || roles.has("moderator");
  const isFacilitator = roles.has("facilitator");
  if (!isStaff && !isFacilitator) throw new Error("Only facilitators and admins can create pods.");
  return { isStaff };
}

const encounterSchema = z.object({
  topic: z.string().trim().min(1).max(80),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }).nullable().optional(),
});

export const createPod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        title: z.string().trim().min(1).max(120),
        description: z.string().trim().max(4000).optional().nullable(),
        photoUrl: z.string().trim().max(500).optional().nullable(),
        timezone: z.string().trim().min(1).max(80),
        meetUrl: z.string().url().optional().nullable().or(z.literal("")),
        encounters: z.array(encounterSchema).length(POD_ENCOUNTER_COUNT),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { isStaff } = await assertCanCreate(context.supabase, context.userId);
    const status = isStaff ? "published" : "pending_approval";

    const { data: pod, error: podError } = await context.supabase
      .from("pods")
      .insert({
        title: data.title,
        description: data.description ?? null,
        photo_url: data.photoUrl ?? null,
        format: "online",
        timezone: data.timezone,
        meet_url: data.meetUrl || null,
        host_id: context.userId,
        created_by: context.userId,
        status,
        capacity_members: POD_MEMBER_SEATS,
      })
      .select("*")
      .single();

    if (podError || !pod) throw new Error(podError?.message ?? "Couldn't create the pod.");

    const eventRows = data.encounters.map((enc, i) => ({
      title: `${data.title} · Encounter ${i + 1}: ${enc.topic}`,
      description: data.description ?? null,
      photo_url: data.photoUrl ?? null,
      event_type: "pod_session" as const,
      format: "virtual" as const,
      starts_at: enc.startsAt,
      ends_at: enc.endsAt ?? null,
      timezone: data.timezone,
      capacity: POD_MEMBER_SEATS,
      status: status === "published" ? ("published" as const) : ("pending_approval" as const),
      created_by: context.userId,
      host_id: context.userId,
      pod_id: pod.id,
      session_index: i + 1,
    }));

    const { error: evError } = await context.supabase.from("events").insert(eventRows);
    if (evError) {
      await context.supabase.from("pods").delete().eq("id", pod.id);
      throw new Error(evError.message ?? "Couldn't save pod encounters.");
    }

    return { pod: pod as PodRow };
  });

export const publishPod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ podId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
    const set = new Set((roles ?? []).map((r) => r.role));
    if (!set.has("admin") && !set.has("moderator")) {
      throw new Error("Only staff can publish pods.");
    }

    const { error } = await context.supabase
      .from("pods")
      .update({ status: "published", updated_at: new Date().toISOString() })
      .eq("id", data.podId);
    if (error) throw new Error(error.message);

    await context.supabase.from("events").update({ status: "published" }).eq("pod_id", data.podId);

    return { ok: true as const };
  });

export const listPendingPods = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roles } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
    const set = new Set((roles ?? []).map((r) => r.role));
    if (!set.has("admin") && !set.has("moderator")) {
      throw new Error("Only staff can review pods.");
    }

    const { data: pods, error } = await context.supabase
      .from("pods")
      .select("id, title, host_id, created_at, status, timezone")
      .eq("status", "pending_approval")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const list = pods ?? [];
    if (!list.length) return { pods: [] as Array<(typeof list)[number] & { host_name: string | null }> };

    const hostIds = [...new Set(list.map((p) => p.host_id))];
    const { data: hosts } = await context.supabase.from("profiles").select("id, display_name").in("id", hostIds);
    const hostMap = new Map((hosts ?? []).map((h) => [h.id, h.display_name]));

    return {
      pods: list.map((p) => ({ ...p, host_name: hostMap.get(p.host_id) ?? null })),
    };
  });

function encounterDisplay(startsAt: string, timezone: string) {
  const d = new Date(startsAt);
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: timezone }).format(d);
  const month = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: timezone }).format(d);
  const day = Number(new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone: timezone }).format(d));
  return { weekday, month, day, starts_at: startsAt };
}

export const listPublishedPods = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: pods, error } = await context.supabase
      .from("pods")
      .select("*")
      .eq("status", "published")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const list = (pods ?? []) as PodRow[];
    if (!list.length) return { pods: [] as PodListItem[] };

    const ids = list.map((p) => p.id);
    const hostIds = [...new Set(list.map((p) => p.host_id))];

    const [{ data: events }, { data: hosts }, { data: enrollments }] = await Promise.all([
      context.supabase
        .from("events")
        .select("id, pod_id, session_index, starts_at, timezone")
        .in("pod_id", ids)
        .order("session_index", { ascending: true }),
      context.supabase.from("profiles").select("id, display_name, photo_url").in("id", hostIds),
      context.supabase.from("pod_enrollments").select("pod_id").in("pod_id", ids).eq("status", "paid"),
    ]);

    const hostMap = new Map((hosts ?? []).map((h) => [h.id, h]));
    const paidByPod = new Map<string, number>();
    for (const e of enrollments ?? []) {
      paidByPod.set(e.pod_id, (paidByPod.get(e.pod_id) ?? 0) + 1);
    }

    const encountersByPod = new Map<string, PodListItem["encounters"]>();
    for (const ev of events ?? []) {
      if (!ev.pod_id || ev.session_index == null) continue;
      const arr = encountersByPod.get(ev.pod_id) ?? [];
      const disp = encounterDisplay(ev.starts_at, ev.timezone || "UTC");
      arr.push({
        session_index: ev.session_index,
        starts_at: disp.starts_at,
        weekday: disp.weekday,
        month: disp.month,
        day: disp.day,
      });
      encountersByPod.set(ev.pod_id, arr);
    }

    const result: PodListItem[] = list.map((p) => {
      const host = hostMap.get(p.host_id);
      return {
        ...p,
        host_name: host?.display_name ?? null,
        host_avatar: host?.photo_url ?? null,
        paid_count: paidByPod.get(p.id) ?? 0,
        encounters: encountersByPod.get(p.id) ?? [],
      };
    });

    return { pods: result };
  });

export const getPod = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ podId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: pod, error } = await context.supabase.from("pods").select("*").eq("id", data.podId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!pod) return { pod: null, encounters: [], paidCount: 0, enrollment: null, host: null };

    const [{ data: events }, { data: paidRows }, { data: enrollment }, { data: host }] = await Promise.all([
      context.supabase
        .from("events")
        .select("id, pod_id, session_index, title, starts_at, ends_at, timezone")
        .eq("pod_id", data.podId)
        .order("session_index", { ascending: true }),
      context.supabase.from("pod_enrollments").select("id").eq("pod_id", data.podId).eq("status", "paid"),
      context.supabase
        .from("pod_enrollments")
        .select("id, status")
        .eq("pod_id", data.podId)
        .eq("user_id", context.userId)
        .maybeSingle(),
      context.supabase.from("profiles").select("id, display_name, photo_url").eq("id", pod.host_id).maybeSingle(),
    ]);

    return {
      pod: pod as PodRow,
      encounters: events ?? [],
      paidCount: paidRows?.length ?? 0,
      enrollment: enrollment ?? null,
      host: host ?? null,
    };
  });
