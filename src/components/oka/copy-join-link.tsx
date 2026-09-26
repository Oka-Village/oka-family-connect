import { Link2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { joinUrl } from "@/lib/join-link";

export function CopyJoinLink({ slug, size = "sm", className }: { slug: string; size?: "sm" | "default"; className?: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(joinUrl(slug));
      toast.success("Join link copied");
    } catch {
      toast.error("Couldn't copy — select the link and copy it by hand.");
    }
  }
  return (
    <Button size={size} variant="outline" className={className ?? "rounded-full"} onClick={() => void copy()}>
      <Link2 className="size-4 text-primary" strokeWidth={1.5} /> Copy join link
    </Button>
  );
}
