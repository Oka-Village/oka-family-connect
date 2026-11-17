import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { EXPENSE_CATEGORIES, currentMonthId, monthLabel, type ExpenseId } from "@/lib/open-accounting/allocate";
import { formatUsd } from "@/lib/open-accounting/format";

type ExpenseRow = {
  id: string;
  category: string;
  kind: "Fixed" | "Variable";
  amount_cents: number;
  budget_cents: number;
  month_key: string;
  description: string | null;
};

const operatingCategories = EXPENSE_CATEGORIES.filter((category) => !category.bridge);
const defaultMonthId = currentMonthId();

function categoryLabel(id: string): string {
  return EXPENSE_CATEGORIES.find((category) => category.id === id)?.label ?? id;
}

/** EXPENSE_CATEGORIES uses lowercase kind ids; company_expenses.kind is capitalized per its CHECK constraint. */
function toDbKind(kind: "fixed" | "variable"): "Fixed" | "Variable" {
  return kind === "fixed" ? "Fixed" : "Variable";
}

function monthOptions(): string[] {
  const options: string[] = [];
  for (let offset = -12; offset <= 1; offset++) {
    const anchor = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + offset, 1));
    options.push(`${anchor.getUTCFullYear()}-${String(anchor.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return options;
}

export function OpenAccountingExpenses() {
  return (
    <div className="flex min-w-0 flex-col gap-8">
      <ExpenseBooks />
      <CapTable />
    </div>
  );
}

function ExpenseBooks() {
  const qc = useQueryClient();
  const [monthKey, setMonthKey] = useState(defaultMonthId);
  const [editId, setEditId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<ExpenseId>(operatingCategories[0]!.id);
  const [kind, setKind] = useState<"Fixed" | "Variable">(toDbKind(operatingCategories[0]!.kind));
  const [amount, setAmount] = useState("");
  const [budget, setBudget] = useState("");
  const [note, setNote] = useState("");

  const rowsQuery = useQuery({
    queryKey: ["admin", "company_expenses", monthKey],
    queryFn: async () => {
      const { data, error } = await supabase.from("company_expenses").select("*").eq("month_key", monthKey).order("created_at");
      if (error) throw error;
      return (data ?? []) as ExpenseRow[];
    },
  });

  const rows = rowsQuery.data ?? [];
  const totalCents = rows.reduce((sum, row) => sum + row.amount_cents, 0);

  function clearForm() {
    setEditId(null);
    setCategoryId(operatingCategories[0]!.id);
    setKind(toDbKind(operatingCategories[0]!.kind));
    setAmount("");
    setBudget("");
    setNote("");
  }

  function startEdit(row: ExpenseRow) {
    setEditId(row.id);
    setCategoryId(row.category as ExpenseId);
    setKind(row.kind);
    setAmount((row.amount_cents / 100).toFixed(2));
    setBudget(row.budget_cents ? (row.budget_cents / 100).toFixed(2) : "");
    setNote(row.description ?? "");
  }

  const save = useMutation({
    mutationFn: async () => {
      const dollars = Number(amount.replace(/,/g, ""));
      if (!Number.isFinite(dollars) || dollars < 0) throw new Error("Enter a valid amount.");
      const amountCents = Math.round(dollars * 100);
      const budgetCents = budget.trim() ? Math.round(Number(budget.replace(/,/g, "")) * 100) : 0;
      if (editId) {
        const { error } = await supabase
          .from("company_expenses")
          .update({ category: categoryId, kind, amount_cents: amountCents, budget_cents: budgetCents, description: note.trim() || null })
          .eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("company_expenses")
          .insert({ category: categoryId, kind, amount_cents: amountCents, budget_cents: budgetCents, month_key: monthKey, description: note.trim() || null });
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      toast.success(editId ? "Expense updated" : "Expense added");
      clearForm();
      await qc.invalidateQueries({ queryKey: ["admin", "company_expenses", monthKey] });
      await qc.invalidateQueries({ queryKey: ["open-accounting"] });
    },
    onError: () => toast.error("That didn't save."),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("company_expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Expense removed");
      await qc.invalidateQueries({ queryKey: ["admin", "company_expenses", monthKey] });
      await qc.invalidateQueries({ queryKey: ["open-accounting"] });
    },
    onError: () => toast.error("That didn't remove."),
  });

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <p className="section-label">{editId ? "Edit expense" : "Add expense"}</p>
        <form
          className="mt-4 grid gap-4 sm:grid-cols-2"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">Category</span>
            <select
              className="rounded-full border border-border bg-background px-4 py-2"
              value={categoryId}
              onChange={(event) => {
                const next = event.target.value as ExpenseId;
                setCategoryId(next);
                setKind(toDbKind(operatingCategories.find((category) => category.id === next)?.kind ?? "variable"));
              }}
            >
              {operatingCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">Amount (USD)</span>
            <Input type="text" inputMode="decimal" required placeholder="0.00" value={amount} onChange={(event) => setAmount(event.target.value)} className="rounded-full tabular-nums" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">Budget target (optional)</span>
            <Input type="text" inputMode="decimal" placeholder="0.00" value={budget} onChange={(event) => setBudget(event.target.value)} className="rounded-full tabular-nums" />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">Note</span>
            <Input type="text" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Reference or description" className="rounded-full" />
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="submit" className="rounded-full" disabled={save.isPending}>
              {editId ? "Save changes" : "Add expense"}
            </Button>
            {editId && (
              <Button type="button" variant="outline" className="rounded-full" onClick={clearForm}>
                Cancel
              </Button>
            )}
          </div>
        </form>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Saved straight to the real expense books. The Books tab recalculates operating expenses, EBITDA and runway from these rows.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <p className="section-label">Expense books</p>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">Month</span>
            <select className="rounded-full border border-border bg-background px-4 py-2" value={monthKey} onChange={(event) => setMonthKey(event.target.value)} aria-label="Expense month">
              {monthOptions().map((id) => (
                <option key={id} value={id}>
                  {monthLabel(id)}
                </option>
              ))}
            </select>
          </label>
          <p className="text-sm text-muted-foreground">
            Operating total
            <span className="mt-1 block font-serif text-3xl tabular-nums text-foreground">{formatUsd(totalCents)}</span>
          </p>
        </div>

        <div className="mt-6 max-w-full overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs tracking-[0.12em] text-primary uppercase">
              <tr>
                <th className="pb-3 pr-3 font-medium">Category</th>
                <th className="pb-3 pr-3 font-medium">Amount</th>
                <th className="pb-3 pr-3 font-medium">Note</th>
                <th className="pb-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-muted-foreground">
                    No operating expenses in {monthLabel(monthKey)}. Add one above.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="py-3 pr-3">{categoryLabel(row.category)}</td>
                    <td className="py-3 pr-3 tabular-nums">{formatUsd(row.amount_cents)}</td>
                    <td className="py-3 pr-3 text-muted-foreground">{row.description}</td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={() => startEdit(row)}>
                          Edit
                        </Button>
                        <Button type="button" size="sm" variant="outline" className="rounded-full text-destructive" onClick={() => remove.mutate(row.id)}>
                          Remove
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

type CapTableRow = {
  id: string;
  stakeholder_group: string;
  units_count: number;
  percentage: number;
  is_verified: boolean;
};

function CapTable() {
  const qc = useQueryClient();
  const [group, setGroup] = useState("");
  const [units, setUnits] = useState("");
  const [percentage, setPercentage] = useState("");

  const rowsQuery = useQuery({
    queryKey: ["admin", "company_equity_cap_table"],
    queryFn: async () => {
      const { data, error } = await supabase.from("company_equity_cap_table").select("*").order("created_at");
      if (error) throw error;
      return (data ?? []) as CapTableRow[];
    },
  });
  const rows = rowsQuery.data ?? [];

  const add = useMutation({
    mutationFn: async () => {
      const unitsCount = Math.round(Number(units.replace(/,/g, "")));
      const percentValue = Number(percentage);
      if (!group.trim() || !Number.isFinite(unitsCount) || unitsCount < 0 || !Number.isFinite(percentValue)) {
        throw new Error("Enter a stakeholder group, units and percentage.");
      }
      const { error } = await supabase.from("company_equity_cap_table").insert({ stakeholder_group: group.trim(), units_count: unitsCount, percentage: percentValue, is_verified: true });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Cap table row added");
      setGroup("");
      setUnits("");
      setPercentage("");
      await qc.invalidateQueries({ queryKey: ["admin", "company_equity_cap_table"] });
      await qc.invalidateQueries({ queryKey: ["open-accounting"] });
    },
    onError: () => toast.error("That didn't save."),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("company_equity_cap_table").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin", "company_equity_cap_table"] });
      await qc.invalidateQueries({ queryKey: ["open-accounting"] });
    },
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <p className="section-label">Equity cap table</p>
      <p className="mt-2 text-sm text-muted-foreground">Verified, legally finalized stakeholder groups shown on Open Accounting's Ownership section. Starts empty.</p>
      <form
        className="mt-4 grid gap-3 sm:grid-cols-4"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          add.mutate();
        }}
      >
        <Input placeholder="Stakeholder group" value={group} onChange={(event) => setGroup(event.target.value)} className="rounded-full sm:col-span-2" />
        <Input placeholder="Units" inputMode="numeric" value={units} onChange={(event) => setUnits(event.target.value)} className="rounded-full" />
        <Input placeholder="Percentage" inputMode="decimal" value={percentage} onChange={(event) => setPercentage(event.target.value)} className="rounded-full" />
        <Button type="submit" className="rounded-full sm:col-span-4" disabled={add.isPending}>
          Add row
        </Button>
      </form>
      <ul className="mt-4 grid gap-2 text-sm">
        {rows.length === 0 && <p className="text-muted-foreground">No cap table rows yet.</p>}
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-2">
            <span className="text-foreground">{row.stakeholder_group}</span>
            <span className="text-muted-foreground">
              {row.percentage}% · {row.units_count.toLocaleString("en-US")} units
            </span>
            <Button type="button" size="sm" variant="outline" className="rounded-full text-destructive" onClick={() => remove.mutate(row.id)}>
              Remove
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
