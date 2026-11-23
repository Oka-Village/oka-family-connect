import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Camera, ChevronLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { MemberAvatar } from "@/components/oka/profile-sections";
import { GivingCircle } from "@/components/oka/onboarding-visual/giving-circle";
import { PresencePortrait } from "@/components/oka/onboarding-visual/presence-portrait";
import { SacredSpaceDialog } from "@/components/oka/onboarding-visual/sacred-space-dialog";
import { StepProgress } from "@/components/oka/onboarding-visual/step-progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resolvePhotoUrl, useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { useClaimInvite } from "@/lib/affiliates";
import { AGE_RANGES } from "@/lib/profile";
import { cn } from "@/lib/utils";
import { useMembership } from "@/hooks/use-membership";
import { hasPaidMembership, isPaymentExempt } from "@/lib/membership";
import { useRoles } from "@/hooks/use-is-admin";
import { trialState } from "@/lib/trial-access";
import { needsOnboardingPhoto, showSupportOffer } from "@/lib/onboarding-rules";
import { trackPlatformRegistration } from "@/lib/meta-pixel";

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

const STEPS = ["welcome", "profile"] as const;

const VALUES = [
  { title: "Generosity", line: "We give freely.", mark: "(´︶`)っ✿", pill: "bg-golden-tint text-golden-ink", label: "Here's a gift" },
  { title: "Kindness", line: "We meet as equals.", mark: "⊂(´︶`)⊃", pill: "bg-terracotta-tint text-terracotta", label: "With you" },
  { title: "Reciprocity", line: "It comes back around.", mark: "(´︶`)～♡", pill: "bg-sand text-muted-foreground", label: "No one owes" },
] as const;

function Onboarding() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useProfile();
  const membership = useMembership(profile?.id);
  const roles = useRoles();
  const [sacredOpen, setSacredOpen] = useState(false);
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
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [signedPreview, setSignedPreview] = useState<string | null>(null);
  const seeded = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const localPreviewRef = useRef<string | null>(null);

  function replaceLocalPreview(next: string | null) {
    if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current);
    localPreviewRef.current = next;
    setLocalPreview(next);
  }

  useEffect(() => () => {
    if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current);
  }, []);

  useEffect(() => {
    if (profile && !seeded.current) {
      seeded.current = true;
      setDraft({
        display_name: profile.display_name ?? "",
        photo_url: needsOnboardingPhoto(profile.photo_url) ? null : profile.photo_url,
        location: profile.location ?? "",
        age_range: profile.age_range ?? "",
        profession: profile.profession ?? "",
      });
    }
  }, [profile]);

  useEffect(() => {
    let alive = true;
    const previewAtStart = localPreviewRef.current;
    if (!draft.photo_url) {
      setSignedPreview(null);
      return () => { alive = false; };
    }
    void resolvePhotoUrl(draft.photo_url).then((url) => {
      if (!alive) return;
      setSignedPreview(url);
      if (url && localPreviewRef.current && localPreviewRef.current === previewAtStart) {
        URL.revokeObjectURL(localPreviewRef.current);
        localPreviewRef.current = null;
        setLocalPreview(null);
      }
    });
    return () => { alive = false; };
  }, [draft.photo_url]);

  async function handleUpload(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Please choose a photo under 5 MB.");
      return;
    }

    const localUrl = URL.createObjectURL(file);
    replaceLocalPreview(localUrl);
    setUploading(true);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setUploading(false);
      replaceLocalPreview(null);
      toast.error("Your photo was not saved. Please sign in and try again.");
      return;
    }
    const path = `${auth.user.id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) {
      setUploading(false);
      replaceLocalPreview(null);
      toast.error(error.message ? `That photo didn't upload. ${error.message}` : "That photo didn't upload. Please try again to continue.");
      return;
    }

    const { error: saveError } = await supabase.from("profiles").update({ photo_url: path }).eq("id", auth.user.id);
    setUploading(false);
    if (saveError) {
      replaceLocalPreview(null);
      toast.error("We couldn't save that just now. Please try again.");
      return;
    }
    setDraft((d) => ({ ...d, photo_url: path }));
    await queryClient.invalidateQueries({ queryKey: ["profile"] });
    await queryClient.invalidateQueries({ queryKey: ["profile-photo"] });
    toast.success("Photo received.");
  }

  async function finish() {
    if (membership.isPending || roles.isPending || membership.isError || roles.isError) return;
    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setSaving(false); return; }

    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: draft.display_name.trim() || null,
        location: draft.location.trim() || null,
        age_range: draft.age_range || null,
        profession: draft.profession.trim() || null,
        onboarded_at: new Date().toISOString(),
        ...(needsOnboardingPhoto(draft.photo_url) ? {} : { photo_url: draft.photo_url }),
      })
      .eq("id", auth.user.id);

    setSaving(false);
    if (error) {
      toast.error("We couldn't save that just now. Please try again.");
      return;
    }
    trackPlatformRegistration();
    await queryClient.invalidateQueries({ queryKey: ["profile"] });
    await queryClient.invalidateQueries({ queryKey: ["profile-photo"] });
    const offer = showSupportOffer(hasPaidMembership(membership.data), isPaymentExempt(profile, roles.data?.isStaff === true), profile?.trial_started_at)
      && trialState(profile?.trial_started_at, new Date(), profile?.trial_ends_at) !== "active";
    if (offer) void navigate({ to: "/membership", replace: true, search: { session_id: undefined, kind: undefined } });
    else void navigate({ to: "/home", replace: true });
  }
  const presence = Math.round(
    ([draft.display_name.trim(), draft.location.trim(), draft.photo_url, draft.age_range, draft.profession.trim()].filter(Boolean).length / 5) * 100,
  );
  const photoSrc = localPreview ?? signedPreview;
  const lastStepBusy = membership.isPending || roles.isPending || membership.isError || roles.isError;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" strokeWidth={1.5} />
      </div>
    );
  }

  const onProfile = step === STEPS.length - 1;

  return (
    <div className={onProfile ? "min-h-dvh w-full min-w-0 overflow-x-hidden bg-background text-foreground md:min-h-screen" : "min-h-dvh w-full min-w-0 overflow-x-hidden bg-sage-deep text-cream md:min-h-screen md:bg-gradient-to-b md:from-sage-deep md:to-sage-dark"}>
      {onProfile ? (
        <div className="mx-auto flex min-h-dvh w-full max-w-[1240px] flex-col px-5 pb-[26px] pt-11 md:min-h-0 md:px-10 md:py-8">
          <div className="flex items-center gap-3">
            <button type="button" aria-label="Back" className="-ml-2.5 flex size-11 items-center justify-center" onClick={() => setStep(0)}>
              <ChevronLeft className="size-5" strokeWidth={1.6} />
            </button>
            <StepProgress filled={2} label="2 / 3" />
          </div>
          <div className="mt-[18px] grid flex-1 items-start gap-7 md:mt-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:gap-[72px]">
            <div className="flex flex-col items-center gap-2.5 text-center md:items-start md:gap-0 md:text-left">
              <button
                type="button"
                className="relative size-[84px] rounded-full border-[3px] border-card md:size-[140px] md:border-0"
                disabled={uploading}
                onClick={() => fileInput.current?.click()}
                aria-label={uploading ? "Uploading photo" : "Change photo"}
              >
                {photoSrc ? (
                  <MemberAvatar src={photoSrc} name={draft.display_name} className="size-full" />
                ) : (
                  <PresencePortrait />
                )}
                <span className="absolute -right-0.5 bottom-0.5 flex size-[30px] items-center justify-center rounded-full border-2 border-cream bg-brown text-cream md:bottom-0 md:right-0 md:size-9 md:border-0">
                  {uploading ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-3.5" strokeWidth={1.6} />}
                </span>
              </button>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void handleUpload(file);
                }}
              />
              <p className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground md:mt-4">
                <span className="font-kaomoji text-[13px] text-terracotta">(´︶`)ノ</span>
                <span>I&apos;m here</span>
              </p>
              <h1 className="mt-0.5 font-serif text-[32px] font-medium leading-[1.1] md:mt-4 md:text-5xl">What should the family call you?</h1>
              <p className="mt-4 hidden max-w-sm text-sm leading-relaxed text-muted-foreground md:block">Only members see your profile. You can add the rest whenever you like.</p>
              <div className="mt-8 hidden w-full max-w-sm md:block">
                <PresenceMeter presence={presence} />
              </div>
            </div>
            <form
              className="flex flex-1 flex-col gap-7 md:gap-6"
              onSubmit={(e) => {
                e.preventDefault();
                void finish();
              }}
            >
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                <label className="flex flex-col gap-2.5 text-[15px] font-semibold">
                  Name
                  <Input value={draft.display_name} onChange={(e) => setDraft((d) => ({ ...d, display_name: e.target.value }))} placeholder="Your name" className="h-12 rounded-[14px] border-0 bg-card text-[15px] md:h-[52px] md:rounded-2xl" />
                </label>
                <label className="flex flex-col gap-2.5 text-[15px] font-semibold">
                  Location
                  <Input value={draft.location} onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))} placeholder="City, country" className="h-12 rounded-[14px] border-0 bg-card text-[15px] md:h-[52px] md:rounded-2xl" />
                </label>
              </div>
              <div>
                <p className="text-[15px] font-semibold">Which season of life are you in?</p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {AGE_RANGES.map((range) => (
                    <button
                      key={range}
                      type="button"
                      onClick={() => setDraft((d) => ({ ...d, age_range: range }))}
                      className={cn(
                        "min-h-9 rounded-full border px-3.5 py-2 text-[13px] transition-colors md:text-sm",
                        draft.age_range === range ? "border-sage bg-sage text-cream" : "border-transparent bg-card text-muted-foreground hover:bg-accent",
                      )}
                    >
                      {range}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex flex-col gap-2.5 text-[15px] font-semibold">
                What do you spend your days doing?
                <Input value={draft.profession} onChange={(e) => setDraft((d) => ({ ...d, profession: e.target.value }))} placeholder="Gardener, midwife, builder, teacher…" className="h-12 rounded-[14px] border-0 bg-card text-[15px] md:h-[52px] md:rounded-2xl" />
              </label>
              <div className="mt-auto flex flex-col gap-4 md:mt-0">
                <div className="md:hidden">
                  <PresenceMeter presence={presence} />
                </div>
                {(membership.isError || roles.isError) && (
                  <p role="alert" className="text-sm text-destructive">
                    We couldn’t check your membership. <Button type="button" variant="ghost" onClick={() => { void membership.refetch(); void roles.refetch(); }}>Try again</Button>
                  </p>
                )}
                <Button type="submit" className="h-[54px] w-full rounded-full bg-sage text-[17px] font-semibold text-cream hover:bg-sage/90 md:h-14 md:w-auto md:self-end md:px-8 md:text-base" disabled={saving || uploading || lastStepBusy}>
                  {saving ? "Saving…" : "Continue"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : (
        <div className="flex min-h-dvh w-full min-w-0 flex-col overflow-x-hidden md:min-h-screen">
          <div className="mx-auto flex w-full min-w-0 max-w-[1240px] items-center gap-3 px-6 pt-11 md:px-10 md:pt-7">
            <button
              type="button"
              aria-label="Back"
              className="-ml-2.5 flex size-11 shrink-0 items-center justify-center text-cream md:hidden"
              onClick={() => void navigate({ to: "/", replace: true })}
            >
              <ChevronLeft className="size-5" strokeWidth={1.6} />
            </button>
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-cream md:text-xs">Before you come in</p>
          </div>
          <GivingCircle />
          <div className="mx-auto flex w-full min-w-0 max-w-[1240px] flex-1 flex-col px-6 pb-8 pt-2 text-left md:items-center md:px-10 md:pb-12 md:pt-0 md:text-center">
            <h1 className="max-w-3xl font-serif text-[32px] font-medium leading-[1.12] text-golden md:text-5xl md:text-cream">
              Generosity, kindness and reciprocity are the currency here.
            </h1>
            <div className="mt-7 grid w-full min-w-0 gap-3.5 md:mt-12 md:grid-cols-3 md:gap-6">
              {VALUES.map((value) => (
                <article key={value.title} className="flex min-w-0 items-center gap-4 rounded-[20px] bg-card p-[18px] text-foreground md:flex-col md:items-start md:gap-5 md:rounded-3xl md:bg-background md:p-8">
                  <span className={cn("flex h-10 min-w-[92px] shrink-0 items-center justify-center rounded-full px-4 font-kaomoji text-[15px] whitespace-nowrap md:h-11 md:text-lg", value.pill)} role="img" aria-label={value.label}>{value.mark}</span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <h2 className="mb-1 font-serif text-[22px] font-semibold leading-[1.1] md:mb-0 md:text-3xl md:font-medium">{value.title}</h2>
                    <p className="text-sm text-muted-foreground">{value.line}</p>
                  </div>
                </article>
              ))}
            </div>
            <Button className="mt-auto h-[54px] w-full max-w-full rounded-full bg-golden text-[17px] font-semibold text-brown hover:bg-golden/90 md:mt-14 md:h-14 md:w-auto md:px-10 md:text-base" onClick={() => setSacredOpen(true)}>
              I&apos;d love to come in
            </Button>
          </div>
        </div>
      )}
      <SacredSpaceDialog
        open={sacredOpen}
        onOpenChange={setSacredOpen}
        onAccept={() => {
          setSacredOpen(false);
          setStep(1);
        }}
      />
    </div>
  );
}

function PresenceMeter({ presence }: { presence: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Your presence</span>
      <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-sand" aria-hidden="true">
        <div className="h-full rounded-full bg-golden" style={{ width: `${presence}%` }} />
      </div>
      <span className="font-number shrink-0 text-[13px] font-light text-muted-foreground">{presence}%</span>
    </div>
  );
}
