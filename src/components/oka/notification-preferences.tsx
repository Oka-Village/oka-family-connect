import { Suspense, useState } from "react";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Switch } from "@/components/ui/switch";
import { getPreferences, setPreference } from "@/lib/notifications.functions";
import { defaultPreferences, type NotificationPreference } from "@/lib/notifications";

const LABELS = {
  event_reminder: "Event reminders", event_changed: "Event changes",
  event_cancelled: "Event cancellations", profile_approved: "Profile approval",
  referral_credit: "Referral credit",
};

export function NotificationPreferences({ userId }: { userId: string }) {
  return <section className="surface-card mt-12 p-6 md:p-8">
    <p className="section-label">Notification preferences</p>
    <Suspense fallback={<p className="mt-4 text-sm text-muted-foreground" role="status">A moment, please…</p>}>
      <PreferencesRows userId={userId} />
    </Suspense>
  </section>;
}

function PreferencesRows({ userId }: { userId: string }) {
  const get = useServerFn(getPreferences);
  const set = useServerFn(setPreference);
  const queryClient = useQueryClient();
  const [saveError, setSaveError] = useState(false);
  const queryKey = ["notification-preferences", userId];
  const { data } = useSuspenseQuery({ queryKey, queryFn: async () => {
    try { return await get(); } catch { return { preferences: defaultPreferences(), available: false }; }
  }, staleTime: 30_000 });
  const mutation = useMutation({
    mutationFn: (preference: NotificationPreference) => set({ data: preference }),
    onSuccess: async (result) => {
      setSaveError(!result.ok);
      if (result.ok) await queryClient.invalidateQueries({ queryKey });
    },
    onError: () => setSaveError(true),
  });
  return <>
    {!data.available && <p className="mt-3 text-sm text-muted-foreground">Preferences activate soon.</p>}
    <div className="mt-5 grid grid-cols-[minmax(0,1fr)_3.5rem_3.5rem] gap-4 text-center text-xs text-muted-foreground">
      <span /><span>In-app</span><span>Email</span>
    </div>
    {data.preferences.map((preference) => <div key={preference.type} className="grid grid-cols-[minmax(0,1fr)_3.5rem_3.5rem] items-center gap-4 border-b border-border py-4">
      <span className="text-sm text-foreground">{LABELS[preference.type]}</span>
      {(["in_app", "email"] as const).map((channel) => <div key={channel} className="flex min-h-11 items-center justify-center">
        <Switch checked={preference[channel]} disabled={!data.available || mutation.isPending}
          aria-label={`${LABELS[preference.type]} — ${channel === "in_app" ? "In-app" : "Email"}`}
          onCheckedChange={(checked) => { setSaveError(false); mutation.mutate({ ...preference, [channel]: checked }); }} />
      </div>)}
    </div>)}
    {saveError && <p role="alert" className="mt-3 text-sm text-destructive">Your preference didn’t save. Please try again.</p>}
  </>;
}