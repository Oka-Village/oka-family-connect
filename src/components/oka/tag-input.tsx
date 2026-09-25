import { useState } from "react";
import { Plus, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Pill multi-select with optional suggestions and free-form custom tags. */
export function TagInput({
  value,
  onChange,
  suggestions = [],
  placeholder = "Add your own",
}: {
  value: string[];
  onChange: (next: string[]) => void;
  suggestions?: readonly string[];
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const has = (t: string) => value.some((v) => v.toLowerCase() === t.toLowerCase());
  const toggle = (t: string) => onChange(has(t) ? value.filter((v) => v.toLowerCase() !== t.toLowerCase()) : [...value, t]);
  const add = () => {
    const t = draft.trim().slice(0, 40);
    if (t && !has(t) && value.length < 30) onChange([...value, t]);
    setDraft("");
  };
  const custom = value.filter((v) => !suggestions.some((s) => s.toLowerCase() === v.toLowerCase()));

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => toggle(s)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm transition-colors",
              has(s) ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-secondary",
            )}
          >
            {s}
          </button>
        ))}
        {custom.map((t) => (
          <span key={t} className="flex items-center gap-1 rounded-full bg-secondary px-4 py-1.5 text-sm text-secondary-foreground">
            {t}
            <button type="button" aria-label={`Remove ${t}`} onClick={() => toggle(t)}>
              <X className="size-3.5 text-primary" strokeWidth={1.5} />
            </button>
          </span>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <Input
          value={draft}
          placeholder={placeholder}
          maxLength={40}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); }
          }}
          className="rounded-full"
        />
        <button type="button" onClick={add} aria-label="Add tag" className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border hover:bg-secondary">
          <Plus className="size-4 text-primary" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}

export function TagList({ tags, empty = "Not shared yet" }: { tags: string[] | null | undefined; empty?: string }) {
  if (!tags?.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((t) => (
        <span key={t} className="rounded-full bg-secondary px-3 py-1 text-sm text-secondary-foreground">{t}</span>
      ))}
    </div>
  );
}
