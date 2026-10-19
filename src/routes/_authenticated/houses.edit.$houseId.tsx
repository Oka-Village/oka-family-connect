import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";

import { HouseForm } from "@/components/oka/house-form";
import { useCurrentUserId, useRoles } from "@/hooks/use-is-admin";
import { canEditListing } from "@/lib/direct-edit";
import { supabase } from "@/integrations/supabase/client";
import { HOUSE_SELECT, type HouseRow } from "@/lib/houses";

export const Route = createFileRoute("/_authenticated/houses/edit/$houseId")({
  head: () => ({
    meta: [
      { title: "Edit home — Oka" },
      { name: "description", content: "Update your home listing." },
      { property: "og:title", content: "Edit home — Oka" },
      { property: "og:description", content: "Update your home listing." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EditHouse,
});

function EditHouse() {
  const { houseId } = Route.useParams();
  const { data: uid } = useCurrentUserId();
  const roles = useRoles();
  const q = useQuery({
    queryKey: ["house", houseId, "edit"],
    queryFn: async () => {
      const { data, error } = await supabase.from("houses").select(HOUSE_SELECT).eq("id", houseId).maybeSingle();
      if (error) throw error;
      return data as unknown as HouseRow | null;
    },
  });
  return (
    <div className="mx-auto max-w-2xl px-6 py-12 lg:py-16">
      <Link to="/houses/$houseId" params={{ houseId }} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4 text-primary" strokeWidth={1.5} /> Back to home</Link>
      <p className="section-label mt-8">{roles.data?.isAdmin ? "Edit home" : "My offerings"}</p>
      <h1 className="mt-3 text-4xl text-foreground">Edit home</h1>
      <div className="mt-8">
        {q.isLoading || roles.isLoading || !uid ? <Loader2 className="size-6 animate-spin text-primary" strokeWidth={1.5} />
          : q.data && canEditListing(uid, q.data.owner_id, roles.data?.isAdmin) ? <HouseForm userId={uid} initial={q.data} />
          : <p className="text-muted-foreground">Only the host or an admin can edit this home.</p>}
      </div>
    </div>
  );
}
