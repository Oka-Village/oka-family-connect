import { Link2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { joinUrl } from "@/lib/join-link";

export function CopyJoinLink({ slug, refCode, size = "sm", className, label = "Copy join link", disabled = false }: { slug: string; refCode?: string | null; size?: "sm" | "default"; className?: string; label?: string; disabled?: boolean }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(joinUrl(slug, refCode));
      toast.success("Join link copied");
    } catch {
      toast.error("Couldn't copy — select the link and copy it by hand.");
    }
  }
  return (
    <Button size={size} variant="outline" className={className ?? "rounded-full"} disabled={disabled} onClick={() => void copy()}>
      <Link2 className="size-4 text-primary" strokeWidth={1.5} /> {label}
    </Button>
  );
}
