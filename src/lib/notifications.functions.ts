import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { defaultPreferences, notificationSchema, preferenceSchema } from "@/lib/notifications";

// The future tables deliberately aren't in the generated schema. This local
// client type permits querying them without modifying the generated integration.
export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      const client = context.supabase as unknown as SupabaseClient;
      const { data, error } = await client.from("notifications")
        .select("id,title,body,created_at,read_at,link")
        .eq("user_id", context.userId).order("created_at", { ascending: false });
      if (error) return { notifications: [], available: false };
      const parsed = notificationSchema.array().safeParse(data ?? []);
      return { notifications: parsed.success ? parsed.data : [], available: parsed.success };
    } catch {
      return { notifications: [], available: false };
    }
  });

export const markAllRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      const client = context.supabase as unknown as SupabaseClient;
      const { error } = await client.from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", context.userId).is("read_at", null);
      return { ok: !error };
    } catch {
      return { ok: false };
    }
  });

export const getPreferences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const defaults = defaultPreferences();
    try {
      const client = context.supabase as unknown as SupabaseClient;
      const { data, error } = await client.from("notification_preferences")
        .select("type,in_app,email").eq("user_id", context.userId);
      if (error) return { preferences: defaults, available: false };
      const parsed = preferenceSchema.array().safeParse(data ?? []);
      if (!parsed.success) return { preferences: defaults, available: false };
      return { preferences: defaults.map((item) => parsed.data.find((row) => row.type === item.type) ?? item), available: true };
    } catch {
      return { preferences: defaults, available: false };
    }
  });

export const setPreference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => preferenceSchema.parse(input))
  .handler(async ({ data, context }) => {
    try {
      const client = context.supabase as unknown as SupabaseClient;
      const { error } = await client.from("notification_preferences")
        .upsert({ user_id: context.userId, ...data }, { onConflict: "user_id,type" });
      return { ok: !error };
    } catch {
      return { ok: false };
    }
  });
