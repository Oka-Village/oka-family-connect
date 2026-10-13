import { createFileRoute } from "@tanstack/react-router";

import { OnboardingChat } from "@/components/oka/onboarding-chat";

export const Route = createFileRoute("/onboarding-chat")({
  ssr: false,
  head: () => ({ meta: [
    { title: "Say hello — Oka" },
    { name: "description", content: "A calm, two-minute conversation to begin with Oka." },
    { property: "og:title", content: "Say hello — Oka" },
    { property: "og:description", content: "A calm, two-minute conversation to begin with Oka." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: OnboardingChat,
});
