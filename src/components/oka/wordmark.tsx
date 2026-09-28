import { cn } from "@/lib/utils";
import okaLogo from "@/assets/oka-logo.png";

export function Wordmark({ className }: { className?: string }) {
  return (
    <img
      src={okaLogo}
      alt="Oka"
      className={cn("h-8 w-auto object-contain", className)}
    />
  );
}
