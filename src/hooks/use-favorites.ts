import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useCurrentUserId } from "@/hooks/use-is-admin";

/** Add a new favoritable kind here (plus the DB check value and a renderer). */
export const FAVORITE_TYPES = ["skill", "house", "inspiration", "reflection"] as const;
export type FavoriteType = (typeof FAVORITE_TYPES)[number];
export type FavoriteSnapshot = { text: string; author?: string };
export type Favorite = { id: string; item_type: FavoriteType; item_ref: string; snapshot: FavoriteSnapshot | null; created_at: string };

/** Stable key for a drawn card, derived from its text so edits to list order never break saves. */
export function cardKey(text: string) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return `c${(h >>> 0).toString(36)}`;
}

const key = (uid: string | null | undefined) => ["favorites", uid ?? null] as const;

export function useFavorites() {
  const { data: uid } = useCurrentUserId();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: key(uid),
    enabled: Boolean(uid),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Favorite[]> => {
      const { data, error } = await supabase.from("favorites").select("id, item_type, item_ref, snapshot, created_at").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Favorite[];
    },
  });

  const set = useMemo(() => new Set((query.data ?? []).map((f) => `${f.item_type}:${f.item_ref}`)), [query.data]);
  const isFavorite = useCallback((type: FavoriteType, ref: string) => set.has(`${type}:${ref}`), [set]);

  const mutation = useMutation({
    mutationFn: async ({ type, ref, snapshot, remove }: { type: FavoriteType; ref: string; snapshot?: FavoriteSnapshot | undefined; remove: boolean }) => {
      if (remove) {
        const { error } = await supabase.from("favorites").delete().eq("item_type", type).eq("item_ref", ref);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("favorites").upsert(
          { item_type: type, item_ref: ref, snapshot: (snapshot ?? null) as Json },
          { onConflict: "user_id,item_type,item_ref", ignoreDuplicates: true },
        );
        if (error) throw error;
      }
    },
    onMutate: async ({ type, ref, snapshot, remove }) => {
      await qc.cancelQueries({ queryKey: key(uid) });
      const previous = qc.getQueryData<Favorite[]>(key(uid));
      qc.setQueryData<Favorite[]>(key(uid), (list = []) =>
        remove
          ? list.filter((f) => !(f.item_type === type && f.item_ref === ref))
          : [{ id: `tmp-${ref}`, item_type: type, item_ref: ref, snapshot: snapshot ?? null, created_at: new Date().toISOString() }, ...list],
      );
      return { previous };
    },
    onError: (_e, vars, ctx) => {
      qc.setQueryData(key(uid), ctx?.previous);
      toast.error(vars.remove ? "Couldn't remove that just now. Please try again." : "Couldn't save that just now. Please try again.");
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: key(uid) }),
  });

  const toggle = useCallback(
    (type: FavoriteType, ref: string, snapshot?: FavoriteSnapshot) => mutation.mutate({ type, ref, snapshot, remove: isFavorite(type, ref) }),
    [mutation, isFavorite],
  );

  return { ...query, favorites: query.data ?? [], isFavorite, toggle };
}
