import { supabase } from "@/integrations/supabase/client";

/** Admin-only status transitions; the database guard rejects them for non-admins. */
export async function setEventStatus(id: string, status: "published" | "rejected" | "cancelled") {
  const { error } = await supabase.from("events").update({ status }).eq("id", id);
  if (error) throw error;
}

/**
 * Permanently removes an event so it is gone from every schedule, the member's home
 * page and its join link. Its sign-ups and private location are removed with it
 * (both tables cascade on delete). Staff-only: the database rejects anyone else.
 */
export async function deleteEvent(id: string) {
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) throw error;
}
