import { type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Wordmark } from "@/components/oka/wordmark";

export type LegalBlock =
  | { kind: "p"; text: ReactNode }
  | { kind: "list"; items: ReactNode[] };

export type LegalSection = {
  id: string;
  heading: string;
  blocks: LegalBlock[];
};

/** Marker for a legal detail that is still being confirmed. */
export function LegalDraft({ children }: { children?: ReactNode }) {
  return (
    <span className="ml-1 inline-flex items-center rounded-full border border-golden bg-golden-tint px-2 py-0.5 align-middle text-[10px] font-medium uppercase tracking-[0.12em] text-golden-ink">
      Draft · to be confirmed{children ? `: ${children}` : ""}
    </span>
  );
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function LegalPage({
  label,
  title,
  intro,
  updated,
  sections,
  contact,
}: {
  label: string;
  title: string;
  intro: ReactNode;
  updated: string;
  sections: LegalSection[];
  contact: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-[1180px] items-center justify-between px-6 py-8">
        <Link
          to="/"
          aria-label="Oka home"
          className={
            "shrink-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          }
        >
          <Wordmark className="h-7" />
        </Link>
        <p className="section-label hidden sm:block">One World Family</p>
      </header>

      <article className="mx-auto max-w-[760px] px-6 pb-20">
        <p className="section-label">{label}</p>
        <h1 className="mt-5 font-serif text-4xl leading-tight text-foreground sm:text-5xl">
          {title}
        </h1>
        <p className="mt-6 max-w-[62ch] text-base leading-relaxed text-muted-foreground">
          {intro}
        </p>
        <p className="mt-5 font-sans text-[11px] uppercase tracking-[0.16em] text-[var(--color-brown-label)]">
          Last updated {updated}
        </p>

        <nav
          aria-label="On this page"
          className="surface-card mt-10 p-6 sm:p-8"
        >
          <p className="section-label">On this page</p>
          <ol className="mt-4 grid gap-x-8 gap-y-2 sm:grid-cols-2">
            {sections.map((s, i) => (
              <li key={s.id} className="text-[15px] leading-snug">
                <a
                  href={`#${s.id}`}
                  className={
                    "text-foreground transition-colors hover:text-primary hover:underline hover:decoration-border hover:underline-offset-4 " +
                    focusRing
                  }
                >
                  <span aria-hidden className="mr-2 tabular-nums text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {s.heading}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-12 flex flex-col gap-12">
          {sections.map((s, i) => (
            <section key={s.id} aria-labelledby={s.id} id={s.id} className="scroll-mt-6">
              <h2
                id={s.id}
                className="flex items-baseline gap-3 font-serif text-[26px] leading-tight text-foreground"
              >
                <span
                  aria-hidden
                  className="font-sans text-[11px] font-medium tabular-nums text-[var(--color-brown-label)]"
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                {s.heading}
              </h2>
              <div className="mt-4 flex flex-col gap-4">
                {s.blocks.map((block, bi) =>
                  block.kind === "p" ? (
                    <p
                      key={bi}
                      className="max-w-[68ch] text-[15px] leading-[1.75] text-muted-foreground"
                    >
                      {block.text}
                    </p>
                  ) : (
                    <ul key={bi} className="flex max-w-[68ch] flex-col gap-2.5">
                      {block.items.map((item, ii) => (
                        <li
                          key={ii}
                          className="flex gap-3 text-[15px] leading-[1.7] text-muted-foreground"
                        >
                          <span
                            aria-hidden
                            className="mt-[9px] size-1.5 shrink-0 rounded-full bg-terracotta"
                          />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  ),
                )}
              </div>
            </section>
          ))}
        </div>

        <aside className="surface-card mt-14 p-6 sm:p-8">{contact}</aside>
      </article>
    </main>
  );
}
