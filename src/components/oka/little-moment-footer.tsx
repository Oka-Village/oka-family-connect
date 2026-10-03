import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { MOMENTS, type Moment } from "@/data/moments";

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
  { to: "/events", label: "Events" },
  { to: "/directory", label: "Members" },
  { to: "/skills", label: "Skills" },
  { to: "/houses", label: "Houses" },
  { to: "/affiliate", label: "Invite a friend" },
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
      className="relative mt-16 bg-[var(--moment-paper)] px-7 pb-[calc(40px+5.5rem)] pt-9 text-center md:px-[72px] md:pb-[26px] md:pt-[52px] md:text-left lg:pb-[26px]"
      style={{ boxShadow: "var(--moment-inset)" }}
    >
      <img src="/torn-edge.svg" alt="" aria-hidden className="pointer-events-none absolute inset-x-0 -top-[13px] h-[14px] w-full" />
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden mix-blend-multiply" style={{ background: "url(/paper-texture.svg) center/cover" }} />
      {state && <div aria-hidden className="pointer-events-none absolute h-[120px] w-[180px]" style={{ ...state.stain, background: "var(--moment-stain)" }} />}

      <div className="relative mx-auto flex max-w-[1180px] flex-col items-center gap-6 md:grid md:grid-cols-[340px_1fr] md:items-center md:gap-14">
        <div className="h-[206px] w-[300px] md:h-[234px] md:w-[340px]" style={fade(0)}>
          {m && <img src={m.image} alt={m.alt} loading="lazy" width={340} height={234} className="h-full w-full object-contain" />}
        </div>
        <div className="flex max-w-[520px] flex-col gap-3.5" style={fade(150)}>
          <p className="font-sans text-[11px] uppercase tracking-[0.2em] text-[var(--moment-label)]">A little moment</p>
          <p className="min-h-[2.1em] font-serif text-[32px] leading-[1.05] text-foreground md:text-[46px]">{m?.line}</p>
          <p className="font-sans text-sm leading-relaxed text-[var(--moment-muted)] md:text-[15px]">{m?.sub}</p>
        </div>
      </div>

      <div className="relative mx-auto mt-10 flex max-w-[1180px] items-center justify-center gap-8 border-t border-dashed border-[var(--moment-rule)] pt-[18px] font-sans text-[13px] text-[var(--moment-muted)] md:justify-start">
        <span className="font-serif text-[26px] leading-none text-foreground">oka</span>
        <nav aria-label="Footer" className="hidden flex-wrap gap-x-6 gap-y-2 md:flex">
          {LINKS.map((l) => (
            <Link key={l.to} to={l.to} className="transition-colors hover:text-primary">{l.label}</Link>
          ))}
        </nav>
        <span className="ml-auto hidden text-[var(--moment-label)] md:inline">Made with care by the One World Family</span>
      </div>
    </footer>
  );
}
