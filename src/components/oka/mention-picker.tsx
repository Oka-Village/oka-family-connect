import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";

import { MemberAvatar } from "@/components/oka/profile-sections";
import { Skeleton } from "@/components/ui/skeleton";
import { searchMentionMembers, type MentionMember } from "@/lib/appreciation";
import { cn } from "@/lib/utils";

export function MentionPicker({ query, currentUserId, onSelect, onClose }: { query: string; currentUserId: string; onSelect: (member: MentionMember) => void; onClose: () => void }) {
  const [debounced, setDebounced] = useState(query);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => { const timer = setTimeout(() => setDebounced(query), 150); return () => clearTimeout(timer); }, [query]);
  const members = useQuery({ queryKey: ["mention-members", debounced, currentUserId], queryFn: () => searchMentionMembers(debounced, currentUserId), staleTime: 30_000 });

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const rows = members.data ?? [];
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
      if (event.key === "ArrowDown") { event.preventDefault(); setActive((value) => Math.min(value + 1, rows.length - 1)); }
      if (event.key === "ArrowUp") { event.preventDefault(); setActive((value) => Math.max(value - 1, 0)); }
      if (event.key === "Enter" && rows[active]) { event.preventDefault(); onSelect(rows[active]); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active, members.data, onClose, onSelect]);

  return (
    <div ref={listRef} role="listbox" aria-label="Choose a community member" className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-border bg-popover p-2 shadow-card">
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground"><Search className="size-4 text-primary" strokeWidth={1.5} />{query ? `Searching “${query}”` : "Choose someone"}</div>
      {members.isLoading ? <div className="space-y-2 p-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
        : members.isError ? <p className="px-3 py-4 text-sm text-muted-foreground">Members couldn't load. Try typing again.</p>
        : members.data?.length ? members.data.map((member, index) => (
          <button key={member.id} type="button" role="option" aria-selected={index === active} onMouseEnter={() => setActive(index)} onClick={() => onSelect(member)} className={cn("flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", index === active && "bg-accent")}>
            <MemberAvatar src={member.photo} name={member.display_name} className="size-9" />
            <span className="font-medium text-foreground">{member.display_name}</span>
          </button>
        )) : <p className="px-3 py-4 text-sm text-muted-foreground">No members match that name yet.</p>}
    </div>
  );
}