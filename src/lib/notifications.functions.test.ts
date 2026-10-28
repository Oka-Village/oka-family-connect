import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ middleware: {}, query: {} as Record<string, ReturnType<typeof vi.fn>> }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: mocks.middleware }));
vi.mock("@tanstack/react-start", () => ({
  createServerOnlyFn: (fn: unknown) => fn,
  createServerFn: () => {
    const builder = {
      middleware: (items: unknown[]) => { expect(items).toEqual([mocks.middleware]); return builder; },
      inputValidator: () => builder,
      handler: (fn: unknown) => fn,
    };
    return builder;
  },
}));
import { listNotifications, getPreferences, markAllRead, setPreference } from "./notifications.functions";
import { sendNotificationEmail } from "../server/notifications";

// The mocked builder exposes the real handler so its database boundary can be
// tested without performing a database request or changing any real rows.
function invoke(fn: unknown, data?: unknown) {
  return (fn as (input: unknown) => Promise<unknown>)({ data, context: {
    userId: "member-123", supabase: { from: mocks.query['from'] },
  } });
}

beforeEach(() => {
  mocks.query = {};
  for (const method of ["from", "select", "eq", "order", "update", "is", "upsert"]) {
    mocks.query[method] = vi.fn(() => mocks.query);
  }
  mocks.query['then'] = vi.fn((resolve) => resolve({ data: null, error: { code: "42P01", message: "Missing table" } }));
});

describe("notification database boundaries", () => {
  it("returns a gentle empty list for missing notifications and scopes newest-first reads to the caller", async () => {
    expect(await invoke(listNotifications)).toEqual({ notifications: [], available: false });
    expect(mocks.query['from']).toHaveBeenCalledWith("notifications");
    expect(mocks.query['eq']).toHaveBeenCalledWith("user_id", "member-123");
    expect(mocks.query['order']).toHaveBeenCalledWith("created_at", { ascending: false });
  });
  it("returns disabled enabled-by-default preferences when the table is missing", async () => {
    const result = await invoke(getPreferences) as { available: boolean; preferences: unknown[] };
    expect(result.available).toBe(false);
    expect(result.preferences).toHaveLength(5);
    expect(mocks.query['eq']).toHaveBeenCalledWith("user_id", "member-123");
  });
  it("marks only the caller's unread rows and tolerates missing tables", async () => {
    expect(await invoke(markAllRead)).toEqual({ ok: false });
    expect(mocks.query['eq']).toHaveBeenCalledWith("user_id", "member-123");
    expect(mocks.query['is']).toHaveBeenCalledWith("read_at", null);
    expect(mocks.query['update']).toHaveBeenCalledWith({ read_at: expect.any(String) });
  });
  it("writes preferences only for the verified caller and tolerates missing tables", async () => {
    const preference = { type: "event_reminder", in_app: false, email: true };
    expect(await invoke(setPreference, preference)).toEqual({ ok: false });
    expect(mocks.query['upsert']).toHaveBeenCalledWith({ user_id: "member-123", ...preference }, { onConflict: "user_id,type" });
  });
  it("keeps email sending skipped with or without a configured key", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    vi.stubEnv("RESEND_API_KEY", "");
    expect(await sendNotificationEmail("test@example.invalid", "Update", "Text")).toEqual({ skipped: true });
    vi.stubEnv("RESEND_API_KEY", "test-only-not-a-key");
    expect(await sendNotificationEmail("test@example.invalid", "Update", "Text")).toEqual({ skipped: true });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
    vi.unstubAllEnvs();
  });
});