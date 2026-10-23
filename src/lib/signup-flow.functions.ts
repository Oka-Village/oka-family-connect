import { createServerFn } from "@tanstack/react-start";
import { getCookie, getRequest, useSession } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isNewFlowAccount } from "./signup-flow";

const COOKIE_NAME = "oka-new-signup";

/** Server-owned, encrypted HttpOnly marker; never accepts a browser timestamp. */
export const beginSignupFlow = createServerFn({ method: "POST" }).handler(async () => {
  const request = getRequest();
  if (request.headers.get("origin") !== new URL(request.url).origin) throw new Error("Please start sign-in from Oka.");
  const password = process.env["SIGNUP_FLOW_SECRET"];
  if (!password) throw new Error("Sign-in is not ready. Please try again.");
  const session = await useSession<{ startedAt?: number }>({
    name: COOKIE_NAME, password, maxAge: 3600,
    cookie: { httpOnly: true, secure: new URL(request.url).protocol === "https:", sameSite: "lax", path: "/" },
  });
  await session.update({ startedAt: Date.now() });
  return { ready: true };
});

/** Runs before profile data or member content mounts; no marker means no write. */
export const initializeNewFlowProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!getCookie(COOKIE_NAME)) return { initialized: false };
    const password = process.env["SIGNUP_FLOW_SECRET"];
    if (!password) throw new Error("We couldn’t finish sign-in. Please try again.");
    const session = await useSession<{ startedAt?: number }>({
      name: COOKIE_NAME, password, maxAge: 3600,
      cookie: { httpOnly: true, secure: new URL(getRequest().url).protocol === "https:", sameSite: "lax", path: "/" },
    });
    const { data: auth, error: authError } = await context.supabase.auth.getUser();
    if (authError || !auth.user || auth.user.id !== context.userId) throw new Error("Please sign in again.");
    const startedAt = session.data.startedAt ?? 0;
    if (!isNewFlowAccount(auth.user.created_at, startedAt, Date.now())) {
      await session.clear();
      return { initialized: false };
    }
    const { data: staff, error: roleError } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
    if (roleError) throw new Error("We couldn’t finish sign-in. Please try again.");
    if (staff) { await session.clear(); return { initialized: false }; }
    // Privileged only to bypass the self-status guard: caller and newness verified above.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("profiles")
      .update({ member_status: "limited" })
      .eq("id", context.userId).eq("member_status", "full")
      .gte("created_at", new Date(startedAt).toISOString()).is("onboarded_at", null)
      .select("id");
    if (error) throw new Error("We couldn’t finish sign-in. Please try again.");
    await session.clear();
    return { initialized: Boolean(data?.length) };
  });