import { useCallback, useEffect, useRef, useState } from "react";
import { Send, X } from "lucide-react";
import { AppreciationSendAnimation } from "@/components/oka/appreciation-send-animation";
import { MentionPicker } from "@/components/oka/mention-picker";
import { AddressSide, Postcard, PostcardBack, pillPrimary } from "@/components/oka/postcard";
import { sendAppreciation, type MentionMember } from "@/lib/appreciation";

const SAMPLE_RECIPIENT: MentionMember = { id: "preview", display_name: "Maya Cohen", photo_url: null, photo: null };
const SAMPLE_NOTE = "Thank you for sitting with me through that hard week.";

type Props = { currentUserId: string; senderFirstName: string; senderCity?: string | null; waitingCount: number; onOpenLetterbox: () => void; onSent: () => Promise<void> | void };

export function AppreciationComposer({ currentUserId, senderFirstName, senderCity, waitingCount, onOpenLetterbox, onSent }: Props) {
  const [body, setBody] = useState("");
  const [recipient, setRecipient] = useState<MentionMember | null>(null);
  const [mentionQuery, setMentionQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [time, setTime] = useState(0);
  const [failed, setFailed] = useState(false);
  const [demoRun, setDemoRun] = useState(0);
  const [scale, setScale] = useState(1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const stageHostRef = useRef<HTMLDivElement>(null);
  const actionRef = useRef<HTMLButtonElement | null>(null);
  const animationStartRef = useRef<number | null>(null);
  const requestRef = useRef<number | null>(null);
  const payloadRef = useRef({ recipient: SAMPLE_RECIPIENT, body: SAMPLE_NOTE });
  const [devMode, setDevMode] = useState<{ frozen: number | null; demo: boolean }>({ frozen: null, demo: false });

  useEffect(() => {
    const host = window.location.hostname;
    const allowed = import.meta.env.DEV || host.includes("preview") || host === "localhost";
    if (!allowed) return;
    const params = new URLSearchParams(window.location.search);
    const frozenValue = params.get("t");
    const frozen = frozenValue === null ? null : Math.max(0, Math.min(7400, Number(frozenValue) || 0));
    const demo = params.get("demo") === "dove";
    setDevMode({ frozen, demo });
    if (frozen !== null) { setBody(SAMPLE_NOTE); setRecipient(SAMPLE_RECIPIENT); setTime(frozen); }
    else if (demo) { setBody(SAMPLE_NOTE); setRecipient(SAMPLE_RECIPIENT); setDemoRun((value) => value + 1); }
  }, []);

  useEffect(() => {
    const host = stageHostRef.current;
    if (!host) return;
    const resize = () => setScale(Math.min(1, host.clientWidth / 700));
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (devMode.frozen !== null || (!demoRun && time <= 0)) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    animationStartRef.current = performance.now();
    const frame = (now: number) => {
      const elapsed = now - (animationStartRef.current ?? now);
      const next = reduced ? Math.min(7000, 6300 + elapsed / 300 * 700) : Math.min(7400, elapsed);
      setTime(next);
      if (next < (reduced ? 7000 : 7400)) requestRef.current = requestAnimationFrame(frame);
    };
    requestRef.current = requestAnimationFrame(frame);
    return () => { if (requestRef.current !== null) cancelAnimationFrame(requestRef.current); };
  }, [demoRun, devMode.frozen]);

  useEffect(() => {
    if (time < 6930 || devMode.frozen !== null) return;
    const button = document.querySelector<HTMLButtonElement>("[data-animation-action]");
    if (button && actionRef.current !== button) { actionRef.current = button; button.focus(); }
  }, [devMode.frozen, time]);

  const selectRecipient = useCallback((member: MentionMember) => {
    setRecipient(member);
    setPickerOpen(false);
    setMentionQuery("");
    setBody((value) => value.replace(/(^|\s)@[\p{L}\p{N} '-]*$/u, "$1"));
    setError(null);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

  function handleText(value: string) {
    setBody(value.slice(0, 280));
    const match = value.match(/(?:^|\s)@([\p{L}\p{N} '-]*)$/u);
    setPickerOpen(Boolean(match) && !recipient);
    setMentionQuery(match?.[1] ?? "");
  }

  async function send() {
    if (!recipient) { setError("Choose one person by typing @ and their name."); return; }
    if (!body.trim()) { setError("Add a few words before sending your note."); return; }
    payloadRef.current = { recipient, body: body.trim() };
    setError(null); setFailed(false); setTime(0.001); setDemoRun((value) => value + 1);
    try {
      await sendAppreciation(currentUserId, recipient.id, body);
      await onSent();
    } catch (caught) {
      setFailed(true);
      if (caught instanceof Error && caught.message.includes("APPRECIATION_DAILY_LIMIT")) {
        setError("You've sent ten notes today. More can take flight tomorrow.");
      }
    }
  }

  function reset() { setTime(0); setBody(""); setRecipient(null); setFailed(false); requestAnimationFrame(() => textareaRef.current?.focus()); }
  function replay() { setTime(0.001); setDemoRun((value) => value + 1); }
  const activeRecipient = time > 0 ? payloadRef.current.recipient : recipient;
  const activeBody = time > 0 ? payloadRef.current.body : body;
  const formProgress = Math.max(0, Math.min(1, time / 450));
  const formEase = formProgress < 0.5 ? 4 * Math.pow(formProgress, 3) : 1 - Math.pow(-2 * formProgress + 2, 3) / 2;
  const formOpacity = time > 0 ? 1 - formEase : 1;

  const recipientFirst = recipient?.display_name.split(/\s+/)[0];

  if (time > 0 && activeRecipient) {
    return (
      <div ref={stageHostRef} className="relative mx-auto w-full max-w-[700px]" style={{ height: 740 * scale }}>
        <div className="absolute left-0 top-0 h-[740px] w-[700px] origin-top-left overflow-hidden bg-postcard shadow-[var(--postcard-shadow-big)]" style={{ transform: `scale(${scale})` }}>
          <span className="postcard-grain" aria-hidden />
          <AppreciationSendAnimation t={time} recipientFullName={activeRecipient.display_name} recipientFirstName={activeRecipient.display_name.split(/\s+/)[0] ?? activeRecipient.display_name} senderFirstName={senderFirstName} body={activeBody} failed={failed} onReset={reset} onRetry={() => void send()} demo={devMode.demo} onReplay={replay} />
          <span className="sr-only" aria-live="polite">Your appreciation is on its way</span>
        </div>
      </div>
    );
  }

  return (
    <div ref={stageHostRef} className="flex flex-col gap-9">
      <div className="postcard-scene">
        <Postcard rotate={-0.4} className="postcard-arrive max-md:[--r:-0.3deg]" style={{ boxShadow: "var(--postcard-shadow-big)" }}>
          <PostcardBack
            message={<>
              <p className="section-label text-[11px] text-postcard-label">A note of appreciation</p>
              <div className="postcard-ruled relative mt-4 flex min-h-[252px] flex-1 flex-col font-serif text-[22px] italic md:text-[24px]">
                <p className="text-foreground">Dear {recipientFirst ?? "…"},</p>
                <textarea ref={textareaRef} value={body} maxLength={280} onChange={(event) => handleText(event.target.value)} placeholder="Type @ to choose who it's for, then a few words of thanks…" aria-label="Your note of appreciation" aria-invalid={Boolean(error)} className="min-h-[168px] w-full flex-1 resize-none border-0 bg-transparent p-0 leading-[42px] text-foreground placeholder:text-postcard-label focus:outline-none" />
                {pickerOpen && <div className="absolute inset-x-0 top-[84px]"><MentionPicker query={mentionQuery} currentUserId={currentUserId} onSelect={selectRecipient} onClose={() => setPickerOpen(false)} /></div>}
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 font-sans text-[13px] not-italic text-muted-foreground">
                <span aria-live="polite">{body.length}/280</span>
                {recipient && <button type="button" onClick={() => setRecipient(null)} className="inline-flex items-center gap-1 text-postcard-label hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Remove ${recipient.display_name}`}><X className="size-3.5" />Change recipient</button>}
              </div>
              {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
            </>}
            address={<AddressSide space="appreciation" postmark={{ top: senderCity || "Oka", bottom: "By dove" }} lines={[recipient ? `To: ${recipient.display_name}` : "To:", recipient?.location ?? ""]} />}
          />
        </Postcard>
      </div>
      <div className="flex flex-col items-stretch justify-center gap-3 md:flex-row md:items-center">
        <button type="button" className={pillPrimary} disabled={devMode.frozen !== null || !recipient || !body.trim()} onClick={() => void send()}><Send className="size-4" strokeWidth={1.5} />Send the card</button>
        {waitingCount > 0 && <button type="button" onClick={onOpenLetterbox} className="text-center text-[13px] text-muted-foreground underline-offset-4 hover:underline">{waitingCount} {waitingCount === 1 ? "card is" : "cards are"} waiting for you in your letterbox</button>}
      </div>
    </div>
  );
}