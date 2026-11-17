import { cn } from "@/lib/utils";

/** Decorative onboarding progress. It does not change routes or saved data. */
export function StepProgress({ filled, label }: { filled: 2 | 3; label: string }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-4">
      <div className="flex max-w-[320px] flex-1 gap-1.5" aria-hidden="true">
        {[0, 1, 2].map((segment) => (
          <span key={segment} className={cn("h-1 flex-1 rounded-full", segment < filled ? "bg-brown" : "bg-sand")} />
        ))}
      </div>
      <span className="font-number text-sm font-light text-muted-foreground">{label}</span>
    </div>
  );
}
