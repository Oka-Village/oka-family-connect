import { useCallback, useEffect, useRef, useState } from "react";
import { Send, X } from "lucide-react";
import { AppreciationSendAnimation } from "@/components/oka/appreciation-send-animation";
import { MentionPicker } from "@/components/oka/mention-picker";
import { MemberAvatar } from "@/components/oka/profile-sections";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { sendAppreciation, type MentionMember } from "@/lib/appreciation";

const SAMPLE_RECIPIENT: MentionMember = { id: "preview", display_name: "Maya Cohen", photo_url: null, photo: null };
const SAMPLE_NOTE = "Thank you for sitting with me through that hard week.";

export function AppreciationComposer({ currentUserId, senderFirstName, onSent }: { currentUserId: string; senderFirstName: string; onSent: () => Promise<void> | void }) {
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

  return (
    <div ref={stageHostRef} className="relative w-full" style={{ height: 740 * scale }}>
      <div className="absolute left-0 top-0 h-[740px] w-[700px] origin-top-left overflow-hidden rounded-[40px] border border-appreciation-card-border bg-card shadow-appreciation" style={{ transform: `scale(${scale})` }}>
        <div className="absolute inset-0" style={{ opacity: formOpacity }}>
          <p className="section-label absolute left-[52px] top-[62px] text-[13px]">From the heart</p>
          <h3 className="absolute left-[52px] top-[90px] font-serif text-[52px] leading-none text-foreground">A note of appreciation</h3>
          <div className="absolute left-[52px] top-[190px] h-[300px] w-[596px] rounded-[28px] border border-sand bg-background px-8 py-7">
            {recipient && <div className="mb-2 flex w-fit items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-sm text-secondary-foreground"><MemberAvatar src={recipient.photo} name={recipient.display_name} className="size-6" /><span>@{recipient.display_name}</span><button type="button" aria-label={`Remove ${recipient.display_name}`} disabled={time > 0} onClick={() => setRecipient(null)} className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X className="size-3.5" /></button></div>}
            <Textarea ref={textareaRef} value={body} maxLength={280} disabled={time > 0} onChange={(event) => handleText(event.target.value)} placeholder="Write a few words of thanks to someone in the community. Type @ to choose who it's for, then send it on its way." className="h-[210px] min-h-0 resize-none border-0 bg-transparent p-0 text-[17px] leading-[1.6] shadow-none focus-visible:ring-0" aria-invalid={Boolean(error)} />
            {pickerOpen && time === 0 && <MentionPicker query={mentionQuery} currentUserId={currentUserId} onSelect={selectRecipient} onClose={() => setPickerOpen(false)} />}
          </div>
          <span className="absolute left-[52px] top-[518px] text-[17px] text-muted-foreground" aria-live="polite">{body.length}/280</span>
          <Button className="absolute right-[52px] top-[500px] h-[60px] rounded-full px-[30px] text-lg font-medium disabled:bg-primary-disabled disabled:text-primary-foreground" disabled={devMode.frozen !== null || time > 0 || !recipient || !body.trim()} onClick={() => void send()}><Send className="size-[22px]" strokeWidth={1.5} />Send</Button>
          {error && <p role="alert" className="absolute left-[52px] top-[570px] text-sm text-destructive">{error}</p>}
        </div>
        {time > 0 && activeRecipient && <AppreciationSendAnimation t={time} recipientFullName={activeRecipient.display_name} recipientFirstName={activeRecipient.display_name.split(/\s+/)[0] ?? activeRecipient.display_name} senderFirstName={senderFirstName} body={activeBody} failed={failed} onReset={reset} onRetry={() => void send()} demo={devMode.demo} onReplay={replay} />}
        <span className="sr-only" aria-live="polite">{time > 0 ? "Your appreciation is on its way" : ""}</span>
      </div>
    </div>
  );
}