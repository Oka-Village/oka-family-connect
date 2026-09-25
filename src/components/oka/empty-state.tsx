import type { LucideIcon } from "lucide-react";

type EmptyStateProps = {
  icon: LucideIcon;
  label: string;
  title: string;
  description: string;
};

/** Calm, on-brand placeholder used by the phases that are still coming. */
export function EmptyState({ icon: Icon, label, title, description }: EmptyStateProps) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-6 py-20 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-secondary">
        <Icon className="size-7 text-primary" strokeWidth={1.5} />
      </span>
      <p className="section-label mt-8">{label}</p>
      <h1 className="mt-4 text-4xl text-foreground">{title}</h1>
      <p className="mt-4 text-base leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}
