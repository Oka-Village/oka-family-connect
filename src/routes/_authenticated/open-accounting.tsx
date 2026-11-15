import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BookOpen, Receipt } from "lucide-react";
import { z } from "zod";

import { OpenAccountingBooks } from "@/components/oka/open-accounting-books";
import { OpenAccountingExpenses } from "@/components/oka/open-accounting-expenses";
import { useRoles } from "@/hooks/use-is-admin";
import { cn } from "@/lib/utils";

const TABS = ["books", "expenses"] as const;
type Tab = (typeof TABS)[number];

export const Route = createFileRoute("/_authenticated/open-accounting")({
  validateSearch: z.object({ tab: z.enum(TABS).optional().catch(undefined) }),
  head: () => ({
    meta: [
      { title: "Open Accounting — Oka" },
      { name: "description", content: "See how Oka grows, creates value, and shares its prosperity." },
      { property: "og:title", content: "Open Accounting — Oka" },
      { property: "og:description", content: "See how Oka grows, creates value, and shares its prosperity." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OpenAccountingPage,
});

function OpenAccountingPage() {
  const { data: roles, isLoading: rolesLoading } = useRoles();
  const { tab } = Route.useSearch();
  const navigate = useNavigate({ from: "/open-accounting" });

  if (rolesLoading) return null;

  const isAdmin = Boolean(roles?.isAdmin);
  const tabs: { id: Tab; label: string; icon: typeof BookOpen }[] = [
    { id: "books", label: "Books", icon: BookOpen },
    ...(isAdmin ? [{ id: "expenses" as const, label: "Expenses", icon: Receipt }] : []),
  ];
  const active: Tab = tab === "expenses" && isAdmin ? "expenses" : "books";

  return (
    <div className="mx-auto max-w-7xl px-6 py-10 lg:py-16">
      <p className="section-label">One World Family</p>
      <h1 className="mt-3 text-4xl text-foreground">Open Accounting</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        See how our community grows, creates value, and shares its prosperity.
      </p>

      <div className="mt-8 flex flex-wrap gap-2" role="tablist" aria-label="Open Accounting sections">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active === t.id}
            onClick={() => navigate({ search: { tab: t.id }, replace: true })}
            className={cn(
              "flex items-center gap-2 rounded-full border px-4 py-2 text-sm",
              active === t.id ? "border-transparent bg-secondary text-secondary-foreground" : "border-border text-muted-foreground",
            )}
          >
            <t.icon className="size-4 text-primary" strokeWidth={1.5} /> {t.label}
          </button>
        ))}
      </div>

      <div className="mt-10" role="tabpanel" aria-label={active === "books" ? "Books" : "Expenses"}>
        {active === "books" && <OpenAccountingBooks />}
        {active === "expenses" && isAdmin && <OpenAccountingExpenses />}
      </div>
    </div>
  );
}
