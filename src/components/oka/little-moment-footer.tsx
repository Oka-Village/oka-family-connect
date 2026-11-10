import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { MOMENTS, type Moment } from "@/data/moments";
import { Wordmark } from "@/components/oka/wordmark";

const KEY = "oka:lastMoment";

function pickMoment(): { moment: Moment; stain: { left: string; top: string } } {
  let last: string | null = null;
  try { last = sessionStorage.getItem(KEY); } catch { /* ignore */ }
  const pool = MOMENTS.length > 1 ? MOMENTS.filter((m) => m.id !== last) : MOMENTS;
  const moment = pool[Math.floor(Math.random() * pool.length)] ?? MOMENTS[0]!;
  try { sessionStorage.setItem(KEY, moment.id); } catch { /* ignore */ }
  return { moment, stain: { left: `${Math.round(Math.random() * 80)}%`, top: `${Math.round(Math.random() * 70)}%` } };
}

const LINKS = [
  { to: "/home", label: "Home" },
  { to: "/events", label: "Events" },
  { to: "/directory", label: "Members" },
  { to: "/skills", label: "Skills" },
  { to: "/houses", label: "Houses" },
  { to: "/collections", label: "Collections" },
  { to: "/affiliate", label: "Invite a friend" },
  { to: "/privacy", label: "Privacy" },
  { to: "/terms", label: "Terms" },
] as const;

export function LittleMomentFooter() {
  const [state, setState] = useState<ReturnType<typeof pickMoment> | null>(null);
  const [visible, setVisible] = useState(false);
  const [animate, setAnimate] = useState(true);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    setState(pickMoment());
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { setAnimate(false); setVisible(true); return; }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e?.isIntersecting) { setVisible(true); io.disconnect(); } }, { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const fade = (delay: number) =>
    animate
      ? { opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(8px)", transition: `opacity 900ms ease-out ${delay}ms, transform 900ms ease-out ${delay}ms` }
      : undefined;

  const m = state?.moment;

  return (
    <footer
      ref={ref}
      role="contentinfo"
      className="relative mt-16 bg-background px-7 pb-[calc(40px+5.5rem)] pt-9 text-center text-foreground md:px-[72px] md:pb-[26px] md:pt-[52px] md:text-left lg:pb-[26px]"
      style={{ boxShadow: "inset 0 0 90px color-mix(in oklab, var(--terracotta) 12%, transparent)" }}
    >
      <img src="/torn-edge.svg" alt="" aria-hidden className="pointer-events-none absolute inset-x-0 -top-[13px] h-[14px] w-full" />
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden mix-blend-multiply" style={{ background: "url(/paper-texture.svg) center/cover" }} />
      {state && <div aria-hidden className="pointer-events-none absolute h-[120px] w-[180px] bg-terracotta-tint/70 blur-2xl" style={{ left: state.stain.left, top: state.stain.top }} />}

      <div className="relative mx-auto flex max-w-[1180px] flex-col items-center gap-6 md:grid md:grid-cols-[340px_1fr] md:items-center md:gap-14">
        <div className="h-[206px] w-[300px] md:h-[234px] md:w-[340px]" style={fade(0)}>
          {m && <img src={m.image} alt={m.alt} loading="lazy" width={340} height={234} className="h-full w-full object-contain" />}
        </div>
        <div className="flex max-w-[520px] flex-col gap-3.5" style={fade(150)}>
          <p className="font-sans text-[11px] uppercase tracking-[0.2em] text-terracotta">A little moment</p>
          <p className="min-h-[2.1em] font-serif text-[32px] leading-[1.05] text-foreground md:text-[46px]">{m?.line}</p>
          <p className="font-sans text-sm leading-relaxed text-muted-foreground md:text-[15px]">{m?.sub}</p>
        </div>
      </div>

      <div className="relative mx-auto mt-10 flex max-w-[1180px] flex-col items-center justify-center gap-8 border-t border-dashed border-sand pt-[18px] font-sans text-[13px] text-muted-foreground md:flex-row md:justify-start">
        <Link to="/home" aria-label="Oka home" className="shrink-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          <Wordmark className="h-7" />
        </Link>
        <nav aria-label="Footer" className="flex flex-wrap justify-center gap-x-6 gap-y-2 md:justify-start">
          {LINKS.map((l) => (
            <Link key={l.to} to={l.to} className="transition-colors hover:text-sage">{l.label}</Link>
          ))}
        </nav>
        <span className="ml-auto hidden text-terracotta md:inline">Made with care by the One World Family</span>
      </div>

      <div className="relative mx-auto mt-5 flex max-w-[1180px] flex-wrap items-center justify-center gap-x-6 gap-y-1 font-sans text-[12px] text-muted-foreground md:hidden">
        <Link to="/privacy" className="transition-colors hover:text-sage">Privacy</Link>
        <Link to="/terms" className="transition-colors hover:text-sage">Terms</Link>
      </div>
    </footer>
  );
}
