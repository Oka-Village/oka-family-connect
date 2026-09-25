import { supabase } from "@/integrations/supabase/client";

/** Admin-only status transitions; the database guard rejects them for non-admins. */
export async function setEventStatus(id: string, status: "published" | "rejected" | "cancelled") {
  const { error } = await supabase.from("events").update({ status }).eq("id", id);
  if (error) throw error;
}
