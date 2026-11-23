import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { queryOptions } from "@tanstack/react-query";
import type { Database } from "@/integrations/supabase/types";
import type { EventFilters, EventRow } from "./events";
import { filterPublicEvents, type EventFetchOptions } from "./public-events";

export const getPublicEvents = createServerFn({ method: "GET" }).handler(async (): Promise<EventRow[]> => {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("The event schedule is unavailable. Please try again.");
  const client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
      headers.set("apikey", key);
      return fetch(input, { ...init, headers });
    } },
  });
  const { data, error } = await client.rpc("public_event_catalog");
  if (error) throw error;
  return (data ?? []) as unknown as EventRow[];
});

export const publicEventsOptions = queryOptions({
  queryKey: ["events", "public-catalog"],
  queryFn: () => getPublicEvents(),
  staleTime: 60_000,
});

export async function fetchPublicEvents(filters: EventFilters, opts: EventFetchOptions = {}) {
  return filterPublicEvents(await getPublicEvents(), filters, opts);
}