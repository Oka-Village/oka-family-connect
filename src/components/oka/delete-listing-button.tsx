import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { canDeleteListing, deleteOwnListing, type DeleteClient } from "@/lib/listing-deletion";

export function DeleteListingButton({ kind, id, title, ownerId, userId, disabled = false }: {
  kind: "skills" | "houses";
  id: string;
  title: string;
  ownerId: string;
  userId: string | null | undefined;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();
  if (!canDeleteListing(userId, ownerId)) return null;
  const label = kind === "skills" ? "skill" : "home";

  async function remove() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await deleteOwnListing(supabase as unknown as DeleteClient, kind, id, ownerId, userId);
      setOpen(false);
      await navigate({ to: "/profile" });
      qc.removeQueries({ queryKey: [kind === "skills" ? "skill" : "house", id] });
      await Promise.all([kind, `my-${kind}`, kind === "skills" ? "sessions" : "stays", "credits", "favorites"].map((key) => qc.invalidateQueries({ queryKey: [key] })));
      toast.success(`Your ${label} has been deleted`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your listing wasn't deleted. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(value) => { if (!busy) { setOpen(value); setError(null); } }}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" disabled={disabled} className="rounded-full text-destructive">
          <Trash2 className="size-4" strokeWidth={1.5} />Delete {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-[calc(100%-2rem)] rounded-2xl sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-serif text-3xl font-normal">Delete this {label}?</AlertDialogTitle>
          <AlertDialogDescription className="break-words">
            “{title}” will be permanently removed, along with its {kind === "skills" ? "session requests" : "stay requests"}. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy} className="rounded-full">Keep {label}</AlertDialogCancel>
          <Button type="button" variant="destructive" disabled={busy} onClick={() => void remove()} className="rounded-full">
            {busy ? <Loader2 className="size-4 animate-spin" strokeWidth={1.5} /> : <Trash2 className="size-4" strokeWidth={1.5} />}
            {busy ? "Deleting…" : `Delete ${label}`}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}