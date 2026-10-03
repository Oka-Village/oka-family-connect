import { supabase } from "@/integrations/supabase/client";

export type MentionMember = { id: string; display_name: string; photo_url: string | null; photo: string | null };
export type AppreciationLetter = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
  person: MentionMember | null;
};

const cleanSearch = (value: string) => value.replace(/[%_\\,()*]/g, " ").trim().slice(0, 60);

async function signMembers(rows: Array<{ id: string; display_name: string | null; photo_url: string | null }>): Promise<MentionMember[]> {
  const paths = rows.map((row) => row.photo_url).filter((path): path is string => Boolean(path && !path.startsWith("http")));
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data } = await supabase.storage.from("avatars").createSignedUrls(paths, 3600);
    data?.forEach((item) => { if (item.path && item.signedUrl) signed.set(item.path, item.signedUrl); });
  }
  return rows.filter((row) => Boolean(row.display_name?.trim())).map((row) => ({
    id: row.id,
    display_name: row.display_name?.trim() ?? "Oka member",
    photo_url: row.photo_url,
    photo: row.photo_url?.startsWith("http") ? row.photo_url : row.photo_url ? signed.get(row.photo_url) ?? null : null,
  }));
}

export async function searchMentionMembers(search: string, currentUserId: string): Promise<MentionMember[]> {
  let query = supabase.from("profiles").select("id,display_name,photo_url").neq("id", currentUserId).not("display_name", "is", null).order("display_name").limit(8);
  const term = cleanSearch(search);
  if (term) query = query.ilike("display_name", `%${term}%`);
  const { data, error } = await query;
  if (error) throw error;
  return signMembers(data ?? []);
}

export async function fetchLetters(kind: "received" | "sent", currentUserId: string): Promise<AppreciationLetter[]> {
  const column = kind === "received" ? "recipient_id" : "sender_id";
  const { data, error } = await supabase.from("appreciation_letters").select("id,sender_id,recipient_id,body,created_at,read_at").eq(column, currentUserId).order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  const rows = data ?? [];
  const personIds = [...new Set(rows.map((row) => kind === "received" ? row.sender_id : row.recipient_id))];
  const { data: profiles, error: profileError } = personIds.length
    ? await supabase.from("profiles").select("id,display_name,photo_url").in("id", personIds)
    : { data: [], error: null };
  if (profileError) throw profileError;
  const people = new Map((await signMembers(profiles ?? [])).map((person) => [person.id, person]));
  return rows.map((row) => ({ ...row, person: people.get(kind === "received" ? row.sender_id : row.recipient_id) ?? null }));
}

export async function sendAppreciation(senderId: string, recipientId: string, body: string) {
  const { data, error } = await supabase.from("appreciation_letters").insert({ sender_id: senderId, recipient_id: recipientId, body: body.trim() }).select("id").single();
  if (error) throw error;
  return data;
}