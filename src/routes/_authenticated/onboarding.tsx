import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, User } from "lucide-react";
import { toast } from "sonner";

import { Wordmark } from "@/components/oka/wordmark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { useClaimInvite } from "@/lib/affiliates";
import { AGE_RANGES } from "@/lib/profile";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Welcome to Oka" },
      {
        name: "description",
        content: "A few gentle questions so the family can know who is arriving.",
      },
      { property: "og:title", content: "Welcome to Oka" },
      {
        property: "og:description",
        content: "A few gentle questions so the family can know who is arriving.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Onboarding,
});

type Draft = {
  display_name: string;
  photo_url: string | null;
  location: string;
  age_range: string;
  profession: string;
};

const STEPS = ["welcome", "name", "photo", "location", "age", "profession"] as const;

function Onboarding() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useProfile();
  useClaimInvite(Boolean(profile));
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [draft, setDraft] = useState<Draft>({
    display_name: "",
    photo_url: null,
    location: "",
    age_range: "",
    profession: "",
  });
  const seeded = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile && !seeded.current) {
      seeded.current = true;
      setDraft({
        display_name: profile.display_name ?? "",
        photo_url: profile.photo_url,
        location: profile.location ?? "",
        age_range: profile.age_range ?? "",
        profession: profile.profession ?? "",
      });
    }
  }, [profile]);

  async function handleUpload(file: File) {
    setUploading(true);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const path = `${auth.user.id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    setUploading(false);
    if (error) {
      toast.error("That photo didn't upload. You can add one later.");
      return;
    }
    setDraft((d) => ({ ...d, photo_url: path }));
    toast.success("Photo received.");
  }

  async function finish() {
    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;

    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: draft.display_name.trim() || null,
        photo_url: draft.photo_url,
        location: draft.location.trim() || null,
        age_range: draft.age_range || null,
        profession: draft.profession.trim() || null,
        onboarded_at: new Date().toISOString(),
      })
      .eq("id", auth.user.id);

    setSaving(false);
    if (error) {
      toast.error("We couldn't save that just now. Please try again.");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["profile"] });
    navigate({ to: "/events", replace: true });
  }

  const current = STEPS[step];
  const progress = Math.round((step / (STEPS.length - 1)) * 100);
  const next = () => (step === STEPS.length - 1 ? finish() : setStep((s) => s + 1));

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" strokeWidth={1.5} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-xl flex-col px-6 py-10">
        <div className="flex items-center justify-between">
          <Wordmark className="text-2xl" />
          <p className="section-label">Welcome</p>
        </div>
        <Progress value={progress} className="mt-6" />

        <div className="flex flex-1 flex-col justify-center py-14">
          {current === "welcome" && (
            <div>
              <p className="section-label">One World Family</p>
              <h1 className="mt-5 text-4xl leading-tight text-foreground">
                We&apos;re glad you&apos;re here
              </h1>
              <p className="mt-6 text-base leading-relaxed text-muted-foreground">
                Oka is a chosen family spread across the world. We host each other, and we share
                what we&apos;re good at. One credit is one night&apos;s stay, or one hour of
                service. No money moves between us.
              </p>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                A few gentle questions, so people can recognise you. Skip anything that isn&apos;t
                ready yet.
              </p>
            </div>
          )}

          {current === "name" && (
            <StepShell label="Your name" title="What should the family call you?">
              <Input
                value={draft.display_name}
                onChange={(e) => setDraft((d) => ({ ...d, display_name: e.target.value }))}
                placeholder="Your name"
                className="rounded-2xl"
              />
            </StepShell>
          )}

          {current === "photo" && (
            <StepShell label="Your face" title="A photo helps people say hello">
              <div className="flex items-center gap-5">
                <span className="flex size-20 items-center justify-center rounded-full bg-secondary">
                  {draft.photo_url ? (
                    <Camera className="size-7 text-primary" strokeWidth={1.5} />
                  ) : (
                    <User className="size-8 text-primary" strokeWidth={1.5} />
                  )}
                </span>
                <div>
                  <Button
                    variant="outline"
                    className="rounded-full"
                    disabled={uploading}
                    onClick={() => fileInput.current?.click()}
                  >
                    {uploading ? "Uploading…" : draft.photo_url ? "Choose another" : "Upload photo"}
                  </Button>
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleUpload(file);
                    }}
                  />
                  <p className="mt-2 text-sm text-muted-foreground">
                    {draft.photo_url ? "Photo saved to your profile." : "Up to 5 MB."}
                  </p>
                </div>
              </div>
            </StepShell>
          )}

          {current === "location" && (
            <StepShell label="Your place" title="Where do you wake up most mornings?">
              <Input
                value={draft.location}
                onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))}
                placeholder="City, country"
                className="rounded-2xl"
              />
            </StepShell>
          )}

          {current === "age" && (
            <StepShell label="Your season" title="Which season of life are you in?">
              <div className="flex flex-wrap gap-2">
                {AGE_RANGES.map((range) => (
                  <button
                    key={range}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, age_range: range }))}
                    className={cn(
                      "rounded-full border border-border px-5 py-2 text-sm transition-colors",
                      draft.age_range === range
                        ? "bg-primary text-primary-foreground"
                        : "bg-card text-foreground hover:bg-accent",
                    )}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </StepShell>
          )}

          {current === "profession" && (
            <StepShell label="Your work" title="What do you spend your days doing?">
              <Input
                value={draft.profession}
                onChange={(e) => setDraft((d) => ({ ...d, profession: e.target.value }))}
                placeholder="Gardener, midwife, builder, teacher…"
                className="rounded-2xl"
              />
            </StepShell>
          )}
        </div>

        <div className="flex items-center justify-between gap-4 pb-6">
          <Button
            variant="ghost"
            className="rounded-full text-muted-foreground"
            onClick={() => (step === 0 ? void finish() : setStep((s) => s - 1))}
          >
            {step === 0 ? "Skip for now" : "Back"}
          </Button>
          <Button className="rounded-full px-8" onClick={next} disabled={saving}>
            {step === STEPS.length - 1 ? (saving ? "Saving…" : "Enter Oka") : "Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function StepShell({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="section-label">{label}</p>
      <h1 className="mt-5 text-4xl leading-tight text-foreground">{title}</h1>
      <div className="mt-8">{children}</div>
    </div>
  );
}
