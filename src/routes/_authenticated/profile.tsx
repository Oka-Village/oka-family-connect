import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { resolvePhotoUrl, useProfile } from "@/hooks/use-profile";
import { profileCompleteness } from "@/lib/profile";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "My Profile — Oka" },
      { name: "description", content: "Your presence in the Oka family." },
      { property: "og:title", content: "My Profile — Oka" },
      { property: "og:description", content: "Your presence in the Oka family." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { data: profile, isLoading } = useProfile();
  const { data: photo } = useQuery({
    queryKey: ["profile-photo", profile?.photo_url],
    queryFn: () => resolvePhotoUrl(profile?.photo_url ?? null),
    enabled: Boolean(profile),
  });

  const completeness = profileCompleteness(profile);

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <p className="section-label">My Profile</p>
      <h1 className="mt-4 text-4xl text-foreground">
        {isLoading ? "…" : (profile?.display_name ?? "Welcome")}
      </h1>

      <div className="surface-card mt-10 flex items-center gap-5 p-6">
        {photo ? (
          <img
            src={photo}
            alt={profile?.display_name ?? "Your photo"}
            className="size-20 rounded-full object-cover"
          />
        ) : (
          <span className="flex size-20 items-center justify-center rounded-full bg-secondary">
            <User className="size-8 text-primary" strokeWidth={1.5} />
          </span>
        )}
        <div className="flex-1">
          <p className="section-label">Profile completeness</p>
          <Progress value={completeness} className="mt-3" />
          <p className="mt-2 text-sm text-muted-foreground">{completeness}% complete</p>
        </div>
      </div>

      <dl className="surface-card mt-6 divide-y divide-border p-6">
        {[
          ["Location", profile?.location],
          ["Age range", profile?.age_range],
          ["Profession", profile?.profession],
        ].map(([label, value]) => (
          <div key={label} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
            <dt className="section-label">{label}</dt>
            <dd className="text-sm text-foreground">{value || "Not shared yet"}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-8">
        <Button asChild className="rounded-full px-6">
          <Link to="/onboarding">Continue your profile</Link>
        </Button>
      </div>
    </div>
  );
}
