import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { MemberAvatar } from "@/components/oka/profile-sections";
import { Skeleton } from "@/components/ui/skeleton";
import { resolvePhotoUrl, useProfile } from "@/hooks/use-profile";
import { FULL_ACCESS_OPENS_AT } from "@/lib/member-access";
import { currentKey, periodLabel, useTheme } from "@/lib/themes";

/** Mobile-only home chrome matching the onboarding handoff header card. */
export function HomeMobileHeader() {
  const { data: profile, isLoading, isError } = useProfile();
  const name = profile?.display_name?.trim();
  const initial = name?.charAt(0).toUpperCase() || "·";
  const photoQuery = useQuery({
    queryKey: ["profile-photo", profile?.photo_url ?? null],
    queryFn: () => resolvePhotoUrl(profile?.photo_url ?? null),
    enabled: Boolean(profile?.photo_url),
    staleTime: 60_000,
  });
  const { data: theme, isLoading: themeLoading } = useTheme("month");
  const daysUntilOpen = Math.max(0, Math.ceil((Date.parse(FULL_ACCESS_OPENS_AT) - Date.now()) / 86_400_000));
  const themeLabel = theme?.title
    ? `This month · ${theme.title}`
    : `This month · ${periodLabel("month", currentKey("month"))}`;

  const headerRef = useRef<HTMLElement>(null);
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      const h = headerRef.current;
      if (h) setCompact(h.getBoundingClientRect().bottom < 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
    <div
      aria-hidden={!compact}
      className={`fixed inset-x-0 top-0 z-30 flex items-center justify-between gap-3 rounded-b-2xl bg-[#FFFDF9] px-5 py-2.5 shadow-[0_4px_16px_rgb(55_44_36/0.08)] transition-transform duration-300 md:hidden ${compact ? "translate-y-0" : "-translate-y-full"}`}
    >
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-serif text-[18px] leading-tight text-foreground">{name ? `Hi, ${name}` : "Welcome to Oka"}</span>
        <span className="truncate text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          {themeLabel} · <span className="text-terracotta">{daysUntilOpen} days</span>
        </span>
      </div>
      <Link to="/profile" tabIndex={compact ? 0 : -1} aria-label="Your profile" className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-sage text-[13px] font-semibold text-cream">
        {photoQuery.data ? <MemberAvatar src={photoQuery.data} name={name} className="size-full" /> : initial}
      </Link>
    </div>
    <header ref={headerRef} className="rounded-b-[28px] bg-[#FFFDF9] px-5 pb-5 pt-10 shadow-[0_1px_0_var(--sand)] md:hidden">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-terracotta">Welcome to Oka</p>
        <Link
          to="/profile"
          aria-label="Your profile"
          className="flex size-10 items-center justify-center overflow-hidden rounded-full bg-sage text-[15px] font-semibold text-cream"
        >
          {photoQuery.data ? (
            <MemberAvatar src={photoQuery.data} name={name} className="size-full" />
          ) : (
            initial
          )}
        </Link>
      </div>

      {isLoading ? (
        <Skeleton className="mt-3 h-8 w-64 max-w-full" />
      ) : (
        <h1 className="mt-3 font-serif text-[30px] font-medium leading-[1.05] text-foreground">
          {isError || !name ? (
            "Make yourself at home."
          ) : (
            <>
              Make yourself at home, {name}.
            </>
          )}
        </h1>
      )}

      <div className="mt-3 flex items-center gap-3">
        <svg viewBox="0 0 64 40" width="64" height="40" aria-hidden="true" className="shrink-0">
          <rect width="64" height="40" rx="10" fill="#FFFDF9" />
          <circle cx="32" cy="18" r="8" fill="#F0CD86" />
          <g fill="none" stroke="#9CCBB0" strokeWidth="1.5">
            <path d="M6 30 Q32 22 58 30" />
            <path d="M6 35 Q32 27 58 35" />
          </g>
        </svg>
        <div className="flex min-w-0 flex-col gap-0.5">
          {themeLoading ? (
            <>
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-44" />
            </>
          ) : (
            <>
              <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{themeLabel}</span>
              <span className="truncate text-[13px] text-foreground">
                {theme?.body ?? "Giving presence to your neighbours"}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="mt-2.5 flex items-baseline gap-2 border-t border-sand pt-2.5">
        <span className="font-number text-[22px] font-extralight leading-none tracking-wide text-terracotta">{daysUntilOpen}</span>
        <span className="text-[13px] text-muted-foreground">days until the whole home opens on December 1</span>
      </div>
    </header>
    </>
  );
}
