import { useCallback, useRef, useState } from "react";
import { Send, X } from "lucide-react";
import { toast } from "sonner";

import { DoveAnimation } from "@/components/oka/dove-animation";
import { MentionPicker } from "@/components/oka/mention-picker";
import { MemberAvatar } from "@/components/oka/profile-sections";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { sendAppreciation, type MentionMember } from "@/lib/appreciation";

export function AppreciationComposer({ currentUserId, onSent }: { currentUserId: string; onSent: () => Promise<void> | void }) {
  const [body, setBody] = useState("");
  const [recipient, setRecipient] = useState<MentionMember | null>(null);
  const [mentionQuery, setMentionQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [flying, setFlying] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    setConfirmed(false);
    const match = value.match(/(?:^|\s)@([\p{L}\p{N} '-]*)$/u);
    setPickerOpen(Boolean(match) && !recipient);
    setMentionQuery(match?.[1] ?? "");
  }

  async function send() {
    if (!recipient) { setError("Choose one person by typing @ and their name."); return; }
    if (!body.trim()) { setError("Add a few words before sending your note."); return; }
    setSending(true); setError(null); setFlying(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 320));
      await sendAppreciation(currentUserId, recipient.id, body);
      await onSent();
      setTimeout(() => { setBody(""); setRecipient(null); setSending(false); setFlying(false); setConfirmed(true); }, 900);
    } catch (caught) {
      setSending(false); setFlying(false);
      const message = caught instanceof Error && caught.message.includes("APPRECIATION_DAILY_LIMIT")
        ? "You've sent ten notes today. More can take flight tomorrow."
        : "Your note couldn't take flight. Please try again.";
      setError(message); toast.error(message, { action: { label: "Retry", onClick: () => void send() } });
    }
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card sm:p-8">
      <DoveAnimation flying={flying} />
      <div className={flying ? "letter-fold is-sending" : "letter-fold"}>
        <p className="section-label">From the heart</p>
        <h3 className="mt-3 font-serif text-4xl text-foreground">A note of appreciation</h3>
        <div className="relative mt-6 rounded-2xl border border-border bg-background p-3">
          {recipient && <div className="mb-3 flex w-fit items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-sm text-secondary-foreground"><MemberAvatar src={recipient.photo} name={recipient.display_name} className="size-6" /><span>@{recipient.display_name}</span><button type="button" aria-label={`Remove ${recipient.display_name}`} onClick={() => setRecipient(null)} className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X className="size-3.5" /></button></div>}
          <Textarea ref={textareaRef} value={body} maxLength={280} onChange={(event) => handleText(event.target.value)} placeholder="Write a few words of thanks to someone in the community. Type @ to choose who it's for, then send it on its way." className="min-h-40 resize-none border-0 bg-transparent p-2 text-base shadow-none focus-visible:ring-0" aria-invalid={Boolean(error)} />
          {pickerOpen && <MentionPicker query={mentionQuery} currentUserId={currentUserId} onSelect={selectRecipient} onClose={() => setPickerOpen(false)} />}
        </div>
        <div className="mt-3 flex items-center justify-between gap-4"><span className="text-sm text-muted-foreground" aria-live="polite">{body.length}/280</span><Button className="rounded-full px-6" disabled={sending || !recipient || !body.trim()} onClick={() => void send()}><Send strokeWidth={1.5} />{sending ? "Sending…" : "Send"}</Button></div>
        {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
      </div>
      {confirmed && <p className="mt-6 text-center font-serif text-2xl text-foreground" role="status">Your appreciation is on its way</p>}
    </div>
  );
}