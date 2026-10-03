import { cn } from "@/lib/utils";

export function DoveAnimation({ flying }: { flying: boolean }) {
  return (
    <div className={cn("dove-flight pointer-events-none absolute inset-0 z-20", flying && "is-flying")} aria-hidden="true">
      <svg className="dove" viewBox="0 0 180 110" role="img">
        <path className="dove-wing dove-wing-back" d="M88 58C68 35 56 13 58 4c21 7 38 21 49 42" />
        <path className="dove-body" d="M41 68c21-7 35-22 47-22 17 0 27 12 42 15l29-9-18 18 20 6-34 7c-14 17-46 18-66 1L31 97l13-24-25-2 22-3Z" />
        <path className="dove-wing dove-wing-front" d="M88 61c-7-27-1-48 6-58 16 17 23 35 20 54" />
        <circle className="dove-eye" cx="134" cy="65" r="2" />
        <path className="dove-beak" d="m155 68 18 5-17 5Z" />
      </svg>
    </div>
  );
}