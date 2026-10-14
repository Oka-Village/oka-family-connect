import { useEffect, useRef } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

import okaLogo from "@/assets/oka-logo.png";
import { Button } from "@/components/ui/button";

const SCREENS = [
  {
    label: "One World Family",
    title: "Oka is a chosen family.",
    body: "Across cities, countries and seasons of life, we make room for each other. A place to arrive as yourself, meet kindred people and feel a little more at home in the world.",
    image: "/moments/04-a-longer-table.svg",
    alt: "People gathering around a long table",
  },
  {
    label: "Give what comes naturally",
    title: "Your gifts open doors.",
    body: "A spare room. An hour of your skill. Something you love to share. Oka connects what we can offer with what someone else needs — without money changing hands between members.",
    detail: "One credit = one night’s stay or one hour of service.",
    image: "/moments/08-a-door-left-open.svg",
    alt: "An open door welcoming a guest",
  },
  {
    label: "More than an exchange",
    title: "Make space for real connection.",
    body: "Share a home, learn from each other or gather around a conversation. There’s room for quiet reflection and small notes of appreciation, too. Belonging grows in the little moments.",
    image: "/moments/06-tea-for-two.svg",
    alt: "Tea shared between two people",
  },
] as const;

export const INTRO_SCREEN_COUNT = SCREENS.length;

export function OnboardingIntro({ index, onChange, onFinish }: {
  index: number;
  onChange: (index: number) => void;
  onFinish: () => void;
}) {
  const screen = SCREENS[index] ?? SCREENS[0];
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { titleRef.current?.focus({ preventScroll: true }); }, [index]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[560px] flex-col bg-background px-6 py-5">
      <header className="flex items-center justify-between gap-4">
        <img src={okaLogo} alt="Oka" className="h-8 w-20 object-contain" />
        <Button variant="ghost" onClick={onFinish} className="min-h-11 rounded-full text-muted-foreground">Skip introduction</Button>
      </header>
      <main key={index} className="flex flex-1 flex-col justify-center py-8 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
        <img src={screen.image} alt={screen.alt} className="mx-auto aspect-[16/11] w-full max-w-[360px] object-contain" />
        <p className="section-label mt-6">{screen.label}</p>
        <h1 ref={titleRef} tabIndex={-1} className="mt-4 font-serif text-4xl leading-tight text-foreground outline-none">{screen.title}</h1>
        <p className="mt-5 text-base leading-relaxed text-muted-foreground">{screen.body}</p>
        {"detail" in screen && <p className="mt-4 border-l-2 border-primary pl-4 text-sm leading-relaxed text-foreground">{screen.detail}</p>}
      </main>
      <footer className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <Button variant="ghost" size="icon" disabled={index === 0} aria-label="Previous introduction" onClick={() => onChange(index - 1)} className="size-11 rounded-full">
          <ArrowLeft strokeWidth={1.5} className="text-primary" />
        </Button>
        <div className="flex gap-2" aria-label={`Introduction ${index + 1} of ${SCREENS.length}`}>
          {SCREENS.map((s, i) => <span key={s.label} className={i === index ? "size-2 rounded-full bg-primary" : "size-2 rounded-full bg-sand"} />)}
        </div>
        <Button onClick={() => index === SCREENS.length - 1 ? onFinish() : onChange(index + 1)} className="min-h-11 rounded-full px-5">
          {index === SCREENS.length - 1 ? "Let’s get to know you" : "Continue"}<ArrowRight strokeWidth={1.5} />
        </Button>
      </footer>
    </div>
  );
}