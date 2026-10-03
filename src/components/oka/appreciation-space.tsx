import { useEffect, useRef, useState } from "react";
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

export function AppreciationSpace({ currentUserId, senderFirstName, senderCity }: { currentUserId: string; senderFirstName: string; senderCity?: string | null }) {
  const [tab, setTab] = useState<"received" | "sent">("received");
  const letterboxRef = useRef<HTMLElement>(null);
  const queryClient = useQueryClient();
  const markRead = useServerFn(markAppreciationRead);
  const query = useQuery({ queryKey: ["appreciation-letters", tab, currentUserId], queryFn: () => fetchLetters(tab, currentUserId) });
  const unread = useQuery({
    queryKey: ["appreciation-unread", currentUserId],
    queryFn: async () => {
      const { count, error } = await supabase.from("appreciation_letters").select("id", { count: "exact", head: true }).eq("recipient_id", currentUserId).is("read_at", null);
      if (error) throw error;
      return count ?? 0;
    },
  });

  useEffect(() => {
    const refresh = () => void queryClient.invalidateQueries({ queryKey: ["appreciation-letters"] });
    window.addEventListener("focus", refresh);
    const channel = supabase.channel(`appreciation-${currentUserId}`).on("postgres_changes", { event: "*", schema: "public", table: "appreciation_letters", filter: `recipient_id=eq.${currentUserId}` }, () => { refresh(); void queryClient.invalidateQueries({ queryKey: ["appreciation-unread"] }); }).subscribe();
    return () => { window.removeEventListener("focus", refresh); void supabase.removeChannel(channel); };
  }, [currentUserId, queryClient]);

  async function openLetter(id: string) {
    await markRead({ data: { letterId: id } });
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["appreciation-letters"] }),
      queryClient.invalidateQueries({ queryKey: ["appreciation-unread"] }),
    ]);
  }

  function openLetterbox() {
    setTab("received");
    letterboxRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }

  return (
    <>
      <AppreciationComposer
        currentUserId={currentUserId}
        senderFirstName={senderFirstName}
        senderCity={senderCity}
        waitingCount={unread.data ?? 0}
        onOpenLetterbox={openLetterbox}
        onSent={async () => { setTab("sent"); await Promise.all([queryClient.invalidateQueries({ queryKey: ["appreciation-letters"] }), queryClient.invalidateQueries({ queryKey: ["appreciation-unread"] })]); }}
      />
      <section ref={letterboxRef} aria-labelledby="letterbox-title" className="mt-8 scroll-mt-24">
        <div className="flex flex-wrap items-end justify-between gap-4 border-t border-sand pt-8">
          <div><p className="section-label">Your letterbox</p><h2 id="letterbox-title" className="mt-2 font-serif text-4xl text-foreground">Notes that found their way</h2></div>
          <Tabs value={tab} onValueChange={(value) => setTab(value as "received" | "sent")}>
            <TabsList className="h-auto rounded-full bg-cream-deep p-1"><TabsTrigger className="rounded-full px-5 py-2" value="received"><Inbox strokeWidth={1.5} />Received</TabsTrigger><TabsTrigger className="rounded-full px-5 py-2" value="sent"><Send strokeWidth={1.5} />Sent</TabsTrigger></TabsList>
          </Tabs>
        </div>
        <div className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {query.isLoading ? <><Skeleton className="h-44" /><Skeleton className="h-44" /></>
            : query.isError ? <div className="sm:col-span-2"><p className="font-serif text-2xl">These notes couldn't load.</p><button type="button" className="mt-3 text-sm text-primary underline" onClick={() => void query.refetch()}>Try again</button></div>
            : query.data?.length ? query.data.map((letter, i) => tab === "received" && !letter.read_at
              ? <LetterCard key={letter.id} index={i} letter={letter} kind={tab} onOpen={() => void openLetter(letter.id)} />
              : <LetterCard key={letter.id} index={i} letter={letter} kind={tab} />)
            : <div className="sm:col-span-2 lg:col-span-3"><p className="font-serif text-2xl text-foreground">{tab === "received" ? "Your letterbox is empty for now" : "No cards sent yet"}</p><p className="mt-2 text-muted-foreground">{tab === "received" ? "When someone appreciates you, their card will arrive here." : "A card you send will be kept here."}</p></div>}
        </div>
      </section>
    </>
  );
}
