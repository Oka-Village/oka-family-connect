import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Inbox, Send } from "lucide-react";

import { AppreciationComposer } from "@/components/oka/appreciation-composer";
import { LetterCard } from "@/components/oka/letter-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { fetchLetters } from "@/lib/appreciation";
import { markAppreciationRead } from "@/lib/appreciation.functions";

export function AppreciationSpace({ currentUserId, senderFirstName }: { currentUserId: string; senderFirstName: string }) {
  const [tab, setTab] = useState<"received" | "sent">("received");
  const queryClient = useQueryClient();
  const markRead = useServerFn(markAppreciationRead);
  const query = useQuery({ queryKey: ["appreciation-letters", tab, currentUserId], queryFn: () => fetchLetters(tab, currentUserId) });

  useEffect(() => {
    const refresh = () => void queryClient.invalidateQueries({ queryKey: ["appreciation-letters"] });
    window.addEventListener("focus", refresh);
    const channel = supabase.channel(`appreciation-${currentUserId}`).on("postgres_changes", { event: "*", schema: "public", table: "appreciation_letters", filter: `recipient_id=eq.${currentUserId}` }, refresh).subscribe();
    return () => { window.removeEventListener("focus", refresh); void supabase.removeChannel(channel); };
  }, [currentUserId, queryClient]);

  async function openLetter(id: string) {
    await markRead({ data: { letterId: id } });
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["appreciation-letters"] }),
      queryClient.invalidateQueries({ queryKey: ["appreciation-unread"] }),
    ]);
  }

  return (
    <section aria-labelledby="appreciation-title" className="home-space-panel appreciation-panel">
      <div className="max-w-xl"><p className="section-label">Words that travel</p><h2 id="appreciation-title" className="mt-4 text-4xl text-foreground sm:text-5xl">Appreciation</h2><p className="mt-4 leading-relaxed text-muted-foreground">Send a small, sincere note to someone in the family.</p></div>
      <AppreciationComposer currentUserId={currentUserId} senderFirstName={senderFirstName} onSent={async () => { setTab("sent"); await Promise.all([queryClient.invalidateQueries({ queryKey: ["appreciation-letters"] }), queryClient.invalidateQueries({ queryKey: ["appreciation-unread"] })]); }} />
      <div className="lg:col-span-2">
        <Tabs value={tab} onValueChange={(value) => setTab(value as "received" | "sent")}>
          <TabsList className="h-auto rounded-full bg-cream-deep p-1"><TabsTrigger className="rounded-full px-5 py-2" value="received"><Inbox strokeWidth={1.5} />Received</TabsTrigger><TabsTrigger className="rounded-full px-5 py-2" value="sent"><Send strokeWidth={1.5} />Sent</TabsTrigger></TabsList>
        </Tabs>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {query.isLoading ? <><Skeleton className="h-44 rounded-2xl" /><Skeleton className="h-44 rounded-2xl" /></>
            : query.isError ? <div className="surface-card p-8 sm:col-span-2"><p className="font-serif text-2xl">These letters couldn't load.</p><button type="button" className="mt-3 text-sm text-primary underline" onClick={() => void query.refetch()}>Try again</button></div>
            : query.data?.length ? query.data.map((letter) => tab === "received" && !letter.read_at
              ? <LetterCard key={letter.id} letter={letter} kind={tab} onOpen={() => void openLetter(letter.id)} />
              : <LetterCard key={letter.id} letter={letter} kind={tab} />)
            : <div className="surface-card p-8 sm:col-span-2"><p className="font-serif text-2xl text-foreground">{tab === "received" ? "No letters yet" : "No notes sent yet"}</p><p className="mt-2 text-muted-foreground">{tab === "received" ? "When someone appreciates you, it will arrive here." : "A note you send will be kept here."}</p></div>}
        </div>
      </div>
    </section>
  );
}