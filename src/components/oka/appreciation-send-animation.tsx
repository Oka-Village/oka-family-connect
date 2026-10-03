import type { CSSProperties } from "react";

import { Button } from "@/components/ui/button";

const clamp = (x: number) => Math.max(0, Math.min(1, x));
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
const io = (x: number) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const eo = (x: number) => 1 - Math.pow(1 - x, 3);
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
const bez = (a: [number, number], c: [number, number], b: [number, number], u: number) => [
  (1 - u) * (1 - u) * a[0] + 2 * (1 - u) * u * c[0] + u * u * b[0],
  (1 - u) * (1 - u) * a[1] + 2 * (1 - u) * u * c[1] + u * u * b[1],
] as const;

function dovePos(t: number) {
  if (t < 4100) {
    const u = io(seg(t, 3200, 4100));
    const [x, y] = bez([760, -200], [560, 150], [270, 280], u);
    return { x, y, s: 1, r: lerp(-10, 0, u) };
  }
  if (t < 4950) {
    const y = 280 + Math.sin((t - 4100) / 170) * 4 * (1 - seg(t, 4300, 4400))
      + 48 * io(seg(t, 4400, 4650)) - 44 * io(seg(t, 4650, 4950));
    return { x: 270, y, s: 1, r: 0 };
  }
  const u = Math.pow(seg(t, 4950, 6550), 1.5);
  const [x, y] = bez([270, 284], [60, 420], [-380, -320], u);
  return { x, y, s: lerp(1, 0.45, u), r: lerp(0, 16, u) };
}

function LetterContent({ recipientFirstName, body, senderFirstName, offset = 0 }: { recipientFirstName: string; body: string; senderFirstName: string; offset?: number }) {
  return <div className="absolute left-0 top-0 h-[420px] w-[340px] px-[34px] py-9 text-foreground" style={{ transform: `translateY(${-offset}px)` }}>
    <p className="text-[10px] font-medium uppercase text-letter-muted" style={{ letterSpacing: "0.2em" }}>From the heart</p>
    <p className="mt-4 font-serif text-[28px] italic">Dear {recipientFirstName},</p>
    <p className="mt-2.5 font-serif text-xl leading-[1.4]">{body}</p>
    <p className="absolute bottom-[30px] left-[34px] font-serif text-[22px] italic">— {senderFirstName}</p>
  </div>;
}

function PaperPanel({ index, scaleY, recipientFirstName, body, senderFirstName }: { index: number; scaleY: number; recipientFirstName: string; body: string; senderFirstName: string }) {
  const faceScale = Math.sign(scaleY || 1) * Math.max(Math.abs(scaleY), 0.002);
  return <div className="absolute left-0 h-[140px] w-[340px] overflow-hidden bg-letter-paper" style={{ top: index * 140, zIndex: index === 0 ? 2 : index === 2 ? 3 : 1, transform: `scaleY(${faceScale})`, transformOrigin: index === 0 ? "50% 100%" : index === 2 ? "50% 0%" : "50% 50%" }}>
    {scaleY >= 0 ? <LetterContent recipientFirstName={recipientFirstName} body={body} senderFirstName={senderFirstName} offset={index * 140} /> : <div className="absolute inset-0 bg-letter-back" />}
    <div className="absolute inset-0 bg-foreground" style={{ opacity: (1 - Math.abs(scaleY)) * 0.18 }} />
  </div>;
}

function Envelope({ t }: { t: number }) {
  const flapScale = t < 2500 ? -1 : Math.cos(Math.PI * (1 - io(seg(t, 2500, 2800))));
  const closed = flapScale >= 0;
  const stripTop = lerp(-160, 60, io(seg(t, 2050, 2450)));
  const sealScale = eo(seg(t, 2800, 3050));
  const ring = seg(t, 3000, 3400);
  return <div className="relative h-[230px] w-[380px] drop-shadow-envelope">
    <div className="absolute inset-0 z-[1] rounded-[10px] bg-envelope-back" />
    {!closed && <svg className="absolute left-0 top-0 z-[2] h-[140px] w-[380px] overflow-visible" viewBox="0 0 380 140"><path className="fill-envelope-flap-open stroke-envelope-line" strokeWidth="1" strokeLinejoin="round" d="M0 0 L174 128 Q190 140 206 128 L380 0 Z" /></svg>}
    <div className="absolute left-5 z-[3] h-[140px] w-[340px] rounded-sm bg-letter-back" style={{ top: stripTop }} />
    <svg className="absolute inset-0 z-[4] h-[230px] w-[380px]" viewBox="0 0 380 230">
      <path className="fill-envelope-front stroke-envelope-pocket-line" strokeWidth="1" d="M0 4 L174 118 Q190 128 206 118 L380 4 L380 220 Q380 230 370 230 L10 230 Q0 230 0 220 Z" />
      <path className="fill-none stroke-envelope-crease" strokeWidth="1" d="M6 226 L160 130 M374 226 L220 130" />
    </svg>
    {closed && <svg className="absolute left-0 top-0 z-[5] h-[140px] w-[380px] overflow-visible" viewBox="0 0 380 140" style={{ transform: `scaleY(${Math.max(flapScale, 0.002)})`, transformOrigin: "50% 0%" }}><path className="fill-envelope-flap-closed stroke-envelope-line" strokeWidth="1" strokeLinejoin="round" d="M0 0 L174 128 Q190 140 206 128 L380 0 Z" /></svg>}
    <div className="absolute left-40 top-[100px] z-[6] size-[60px] rounded-full border-2 border-primary" style={{ opacity: (1 - ring) * 0.5, transform: `scale(${1 + 0.8 * ring})` }} />
    <div className="absolute left-40 top-[100px] z-[7] flex size-[60px] items-center justify-center rounded-full bg-wax-seal font-serif text-[28px] italic text-primary-foreground shadow-wax" style={{ transform: `scale(${sealScale})` }}>o</div>
  </div>;
}

function Dove({ t }: { t: number }) {
  const d = dovePos(t);
  const phase = t / 300 * Math.PI * 2;
  const near = 0.15 + 0.85 * Math.cos(phase);
  const far = 0.15 + 0.85 * Math.cos(phase + 0.5);
  return <div className="absolute left-0 top-0 z-[8] h-[120px] w-[160px] drop-shadow-dove" style={{ transformOrigin: "80px 60px", transform: `translate(${d.x}px, ${d.y}px) rotate(${d.r}deg) scale(${d.s * 1.6})` }} aria-hidden="true">
    <svg viewBox="0 0 160 120" className="h-full w-full overflow-visible"><g transform="translate(160 0) scale(-1 1)" className="stroke-dove-line" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round">
      <g style={{ transformOrigin: "84px 58px", transform: `translate(-6px,-2px) scaleY(${far})` }}><path className="fill-dove-far" d="M86 58 Q80 30 58 12 Q44 2 30 4 Q44 14 48 24 Q36 22 26 26 Q42 34 50 40 Q42 42 36 46 Q60 56 86 62 Z" /></g>
      <path className="fill-dove-tail" d="M48 62 Q30 58 10 60 Q16 66 12 72 Q30 74 48 74 Z" />
      <path className="fill-none" d="M80 80 L77 91 M88 79 L88 91" />
      <path className="fill-dove-body" d="M44 62 Q64 48 94 50 Q100 38 113 37 Q125 37 129 48 Q127 62 118 68 Q106 80 82 80 Q60 81 46 74 Z" />
      <path className="fill-dove-beak stroke-dove-beak" strokeWidth=".8" d="M128 44 L138 49 L128 53 Z" />
      <circle className="fill-foreground stroke-none" cx="119" cy="46" r="1.9" />
      <g style={{ transformOrigin: "86px 58px", transform: `scaleY(${near})` }}><path className="fill-dove-near" d="M86 58 Q80 30 58 12 Q44 2 30 4 Q44 14 48 24 Q36 22 26 26 Q42 34 50 40 Q42 42 36 46 Q60 56 86 62 Z" /></g>
    </g></svg>
  </div>;
}

function Feather({ t }: { t: number }) {
  const f = dovePos(5100);
  const p = seg(t, 5100, 7300);
  const left = f.x + 70 + 80 * p + 22 * Math.sin(p * 10);
  const top = lerp(f.y + 60, 620, p);
  return <svg className="absolute z-[7] h-[54px] w-[26px] overflow-visible" viewBox="0 0 30 62" style={{ left, top, opacity: seg(t, 5100, 5250) * (1 - seg(t, 6900, 7300)), transform: `rotate(${30 * Math.sin(p * 10 + 1)}deg)` }} aria-hidden="true"><path className="fill-feather stroke-letter-muted" strokeWidth="1" d="M15 2 Q27 18 22 40 Q19 52 15 58 Q11 52 8 40 Q3 18 15 2 Z" /><path className="stroke-letter-muted" strokeWidth="1" d="M15 6 L15 61" /></svg>;
}

export function AppreciationSendAnimation({ t, recipientFullName, recipientFirstName, senderFirstName, body, failed, onReset, onRetry, demo, onReplay }: { t: number; recipientFullName: string; recipientFirstName: string; senderFirstName: string; body: string; failed: boolean; onReset: () => void; onRetry: () => void; demo: boolean; onReplay: () => void }) {
  const lift = io(seg(t, 0, 700));
  const topFold = Math.cos(Math.PI * io(seg(t, 1050, 1400)));
  const bottomFold = Math.cos(Math.PI * io(seg(t, 1400, 1750)));
  const paperRotation = lerp(-1.5, 0, io(seg(t, 1050, 1750)));
  const envelopeIn = eo(seg(t, 1650, 2000));
  const d = dovePos(t);
  const pickup = io(seg(t, 4650, 4950));
  const pickupDone = t >= 4950;
  const pc = pickupDone ? 1 : pickup;
  const k = d.s * 1.6;
  const targetScale = 0.42 * d.s;
  const envX = lerp(160, d.x + 80 - 190 * targetScale, pc);
  const envY = lerp(440, d.y + 60 + 28 * k, pc);
  const envScale = lerp(1, targetScale, pc);
  const confirmation = io(seg(t, 6300, 7000));
  const letterBody = body.trim().replace(/^./u, (character) => character.toUpperCase());
  const paperStyle: CSSProperties = t < 700 ? { left: lerp(52, 180, lift), top: lerp(190, 140, lift), width: lerp(596, 340, lift), height: lerp(300, 420, lift), borderRadius: lerp(28, 4, lift), opacity: seg(t, 0, 140), transform: `rotate(${lerp(0, -1.5, lift)}deg)`, boxShadow: `0 ${lerp(0, 24, lift)}px ${lerp(0, 50, lift)}px color-mix(in oklab, var(--brown) ${lerp(0, 16, lift)}%, transparent)` } : { left: 180, top: 140, width: 340, height: 420, borderRadius: 4, opacity: 1, transform: `rotate(${paperRotation}deg)` };

  return <div className="pointer-events-none absolute inset-0">
    {t > 0 && t < 2050 && <div className="absolute overflow-visible bg-letter-paper" style={paperStyle}>
      {t < 1050 ? <div style={{ opacity: seg(t, 700, 950) }}><LetterContent recipientFirstName={recipientFirstName} body={letterBody} senderFirstName={senderFirstName} /></div> : <div className="absolute inset-0 drop-shadow-fold"><PaperPanel index={0} scaleY={topFold} recipientFirstName={recipientFirstName} body={letterBody} senderFirstName={senderFirstName} /><PaperPanel index={1} scaleY={1} recipientFirstName={recipientFirstName} body={letterBody} senderFirstName={senderFirstName} /><PaperPanel index={2} scaleY={bottomFold} recipientFirstName={recipientFirstName} body={letterBody} senderFirstName={senderFirstName} /></div>}
    </div>}
    {t >= 1650 && t <= 6550 && <div className="absolute left-0 top-0" style={{ opacity: envelopeIn, transformOrigin: "0 0", transform: `translate(${envX}px, ${envY}px) scale(${envScale})` }}><Envelope t={t} /></div>}
    <p className="absolute left-0 top-[690px] w-full text-center font-serif text-[22px] italic text-muted-foreground" style={{ opacity: seg(t, 2900, 3200) * (1 - seg(t, 4500, 4800)) }}>For {recipientFullName}</p>
    {t >= 3200 && t <= 6550 && <Dove t={t} />}
    {t >= 5100 && t <= 7300 && <Feather t={t} />}
    <div className="pointer-events-auto absolute left-0 top-[260px] z-[9] w-full px-12 text-center" style={{ opacity: confirmation, transform: `translateY(${12 * (1 - confirmation)}px)` }} aria-live="polite">
      <p className="text-[13px] font-medium uppercase text-muted-foreground" style={{ letterSpacing: "0.2em" }}>{failed ? "Please try once more" : "Sent with care"}</p>
      <p className="mt-3.5 font-serif text-[44px] leading-[1.1] text-foreground">{failed ? "We couldn't send it just now." : "Your appreciation is on its way"}</p>
      <p className="mt-3 text-base text-muted-foreground">{failed ? "Your words are saved; try again?" : `${recipientFirstName} will find it waiting in Oka.`}</p>
      {confirmation > 0.9 && <Button data-animation-action className="mt-7 h-12 rounded-full bg-secondary px-6 text-[15px] font-medium text-secondary-foreground hover:bg-secondary/80" onClick={failed ? onRetry : onReset}>{failed ? "Try again" : "Write another"}</Button>}
      {demo && t >= 7400 && <Button variant="ghost" className="ml-3 mt-7 h-12 rounded-full px-6" onClick={onReplay}>Replay</Button>}
    </div>
  </div>;
}