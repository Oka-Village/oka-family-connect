import { createFileRoute } from "@tanstack/react-router";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";

import { AppreciationSpace } from "@/components/oka/appreciation-space";
import { SpaceShell } from "@/components/oka/postcard";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/hooks/use-profile";

// t / demo are read by the composer's preview-only replay tools.
const searchSchema = z.object({ t: fallback(z.string().optional(), undefined), demo: fallback(z.string().optional(), undefined) });

export const Route = createFileRoute("/_authenticated/home/appreciation")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({ meta: [
    { title: "Appreciation — Oka" },
    { name: "description", content: "Write a postcard of thanks to someone in the family and send it off by dove." },
    { property: "og:title", content: "Appreciation — Oka" },
    { property: "og:description", content: "Write a postcard of thanks to someone in the family and send it off by dove." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: AppreciationPage,
});

function AppreciationPage() {
  const { data: profile, isLoading, isError } = useProfile();
  const firstName = profile?.display_name?.trim().split(/\s+/)[0];
  const city = profile?.location?.split(",")[0]?.trim() || null;
  return (
    <SpaceShell label="Appreciation · From the heart">
      {profile ? <AppreciationSpace currentUserId={profile.id} senderFirstName={firstName ?? "A friend"} senderCity={city} />
        : isLoading ? <Skeleton className="h-[600px]" />
        : isError ? <p className="text-muted-foreground">Appreciation couldn't open just now. Please try again.</p> : null}
    </SpaceShell>
  );
}
