import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type Application = {
  id: string; legal_name: string; public_name: string | null; email: string;
  answers: Record<string, string | string[]>; acceptance_name: string; news_opt_in: boolean;
  status: string; created_at: string;
};

const LABELS: Record<string, string> = {
  legalName: "Full legal name", publicName: "Public name", email: "Email", country: "Country", timezone: "Timezone",
  roles: "Roles", rolesOther: "Other role", expertise: "Expertise", training: "Training", experience: "Experience",
  links: "Links", session: "Proposed sessions", format: "Duration", availability: "Availability",
  minimumParticipants: "Minimum participants", themes: "Theme", invoicingName: "Invoicing name",
  paymentMethod: "Payment method", why: "Why One World Family",
};

/** Admin-only list of facilitator applications (non-binding drafts). */
export function FacilitatorsSection() {
  const qc = useQueryClient();
  const [open, setOpen] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["admin", "facilitator-applications"],
    queryFn: async () => {
      const { data, error } = await supabase.from("facilitator_applications").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data as unknown as Application[];
    },
  });
  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("facilitator_applications").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "facilitator-applications"] }),
    onError: () => toast.error("Couldn’t update that application."),
  });

  return (
    <section className="mt-10">
      <p className="text-sm text-muted-foreground">Applications are non-binding expressions of interest.</p>
      {q.isLoading && <p className="mt-6 text-muted-foreground">Loading applications…</p>}
      {q.data?.length === 0 && <p className="mt-6 text-muted-foreground">No applications yet.</p>}
      <ul className="mt-6 flex flex-col gap-3">
        {q.data?.map((a) => (
          <li key={a.id} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium text-foreground">{a.public_name || a.legal_name}</p>
                <p className="text-sm text-muted-foreground">
                  <a href={`mailto:${a.email}`} className="text-primary underline-offset-4 hover:underline">{a.email}</a>
                  {" · "}{new Date(a.created_at).toLocaleDateString()}{" · "}<span className="capitalize">{a.status}</span>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="rounded-full" onClick={() => setOpen(open === a.id ? null : a.id)}>
                  {open === a.id ? "Hide" : "View"}
                </Button>
                {a.status !== "reviewed" && <Button size="sm" variant="outline" className="rounded-full" onClick={() => setStatus.mutate({ id: a.id, status: "reviewed" })}>Mark reviewed</Button>}
                {a.status !== "archived" && <Button size="sm" variant="outline" className="rounded-full" onClick={() => setStatus.mutate({ id: a.id, status: "archived" })}>Archive</Button>}
              </div>
            </div>
            {open === a.id && (
              <dl className="mt-4 grid gap-3 text-sm">
                {Object.entries(a.answers).filter(([, v]) => (Array.isArray(v) ? v.length : String(v).trim())).map(([k, v]) => (
                  <div key={k}>
                    <dt className="font-semibold text-foreground">{LABELS[k] ?? k}</dt>
                    <dd className="whitespace-pre-wrap text-muted-foreground">{Array.isArray(v) ? v.join(", ") : v}</dd>
                  </div>
                ))}
                <div><dt className="font-semibold text-foreground">Acceptance name</dt><dd className="text-muted-foreground">{a.acceptance_name}</dd></div>
                <div><dt className="font-semibold text-foreground">News opt-in</dt><dd className="text-muted-foreground">{a.news_opt_in ? "Yes" : "No"}</dd></div>
              </dl>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
