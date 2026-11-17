import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Pencil, Plus } from "lucide-react";
import { DeleteListingButton } from "@/components/oka/delete-listing-button";

import { HouseCard } from "@/components/oka/house-card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { HOUSE_SELECT, withSignedHousePhotos, type HouseRow } from "@/lib/houses";

/** My homes on My Profile, including unlisted ones. */
export function MyHouses({ userId }: { userId: string }) {
  const q = useQuery({
    queryKey: ["my-houses", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("houses").select(HOUSE_SELECT).eq("owner_id", userId).order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return withSignedHousePhotos((data ?? []) as unknown as HouseRow[]);
    },
  });
  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="section-label">My home</p>
          <h2 className="mt-2 text-3xl text-foreground">My home</h2>
        </div>
        <Button asChild className="rounded-full bg-sage text-cream hover:bg-sage/90"><Link to="/houses/new"><Plus className="size-4" strokeWidth={1.5} />List my home</Link></Button>
      </div>
      {q.data?.length ? (
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          {q.data.map((h) => (
            <div key={h.id} className="relative">
              {h.status !== "published" && <span className="absolute right-3 top-3 z-10 rounded-full bg-card px-3 py-1 text-xs uppercase tracking-widest text-muted-foreground shadow-soft">Unlisted</span>}
              <HouseCard house={h} />
              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm" className="rounded-full"><Link to="/houses/edit/$houseId" params={{ houseId: h.id }}><Pencil className="size-4 text-primary" strokeWidth={1.5} />Edit</Link></Button>
                <DeleteListingButton kind="houses" id={h.id} title={h.title} ownerId={h.owner_id} userId={userId} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="surface-card mt-6 p-6 text-muted-foreground">{q.isLoading ? "…" : "You haven't opened your home yet. Every night you host earns a credit."}</p>
      )}
    </section>
  );
}
