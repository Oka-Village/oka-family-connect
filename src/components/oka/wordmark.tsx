import { cn } from "@/lib/utils";

/** Text wordmark. A logo image replaces this later. */
export function Wordmark({ className }: { className?: string }) {
  return <span className={cn("wordmark text-3xl leading-none", className)}>Oka</span>;
}
