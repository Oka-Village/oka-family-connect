import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const REFLECTION_MAX = 2000;

export type Reflection = { id: string; question_text: string; body: string; created_at: string };

const KEY = ["reflections"] as const;

export function useReflections() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<Reflection[]> => {
      const { data, error } = await supabase
        .from("reflections")
        .select("id, question_text, body, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSaveReflection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { question: string; body: string }) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("reflections")
        .insert({ member_id: u.user.id, question_text: input.question, body: input.body });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteReflection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("reflections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
