import { inAppOnce, safe, staffIds } from "@/server/community-alerts.server";
import type { SupabaseClient } from "@supabase/supabase-js";

type Admin = SupabaseClient;

/** Bell (+ optional follow-ups) after a pod seat is confirmed paid. */
export async function announcePodEnrollment(input: {
  admin: Admin;
  podId: string;
  userId: string;
  paidCount: number;
  capacity: number;
  full: boolean;
}) {
  const { admin, podId, userId, paidCount, capacity, full } = input;

  const { data: pod } = await admin.from("pods").select("id, title, host_id").eq("id", podId).maybeSingle();
  if (!pod) return;

  const { data: member } = await admin.from("profiles").select("display_name").eq("id", userId).maybeSingle();
  const memberName = member?.display_name?.trim() || "A member";
  const title = pod.title;

  await safe("pod member bell", () =>
    inAppOnce(
      userId,
      "pod_joined",
      `You've joined ${title}!`,
      "All 3 sessions are on your schedule. You'll get email reminders before each one.",
      `/pods/${podId}`,
    ),
  );

  if (pod.host_id && pod.host_id !== userId) {
    await safe("pod host bell", () =>
      inAppOnce(
        pod.host_id,
        "pod_member_joined",
        `${memberName} joined your Pod (${paidCount}/${capacity} spots filled).`,
        full ? "Your Pod is now full!" : `${capacity - paidCount} spot(s) still open.`,
        `/pods/${podId}`,
      ),
    );
    if (full) {
      await safe("pod full host bell", () =>
        inAppOnce(pod.host_id, "pod_full", "Your Pod is now full!", `${title} has ${capacity} of ${capacity} members.`, `/pods/${podId}`),
      );
    }
  }

  for (const id of await staffIds()) {
    await safe("pod staff bell", () =>
      inAppOnce(
        id,
        "pod_payment",
        `Pod payment: ${memberName}`,
        `${title} · ${paidCount}/${capacity} seats`,
        `/pods/${podId}`,
      ),
    );
  }
}
