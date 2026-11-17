import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  fileURLToPath(new URL("../../drizzle/migrations/0021_event_rsvp_owner_and_host_read.sql", import.meta.url)),
  "utf8",
);

describe("event RSVP read access", () => {
  it("lets an unpaid member read their own reservation after a refresh", () => {
    expect(migration).toContain("AS RESTRICTIVE FOR SELECT TO authenticated");
    expect(migration).toContain("OR user_id = auth.uid()");
  });

  it("lets a facilitator read reservations for an event they manage", () => {
    expect(migration).toContain("OR public.is_event_manager(event_id)");
  });
});
