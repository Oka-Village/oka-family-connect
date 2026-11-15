import { useEffect, useMemo, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MONTHS } from "@/data/open-accounting/sample-ledger";
import { EXPENSE_CATEGORIES, SNAPSHOT, monthId, monthLabel, type ExpenseId } from "@/lib/open-accounting/allocate";
import { formatUsd } from "@/lib/open-accounting/format";

type ExpenseEntry = {
  id: string;
  categoryId: ExpenseId;
  cents: number;
  note: string;
};

type MonthBooks = Record<string, ExpenseEntry[]>;

const operatingCategories = EXPENSE_CATEGORIES.filter((category) => !category.bridge);
const defaultMonthId = monthId(SNAPSHOT.year, SNAPSHOT.month);

function seedMonth(monthKey: string): ExpenseEntry[] {
  const month = MONTHS.find((item) => item.id === monthKey);
  if (!month) return [];
  const rows: ExpenseEntry[] = [];
  for (const category of operatingCategories) {
    const cents = month.expenses[category.id] ?? 0;
    if (cents <= 0) continue;
    rows.push({
      id: `${monthKey}-${category.id}`,
      categoryId: category.id,
      cents,
      note: "From sample books",
    });
  }
  return rows;
}

function categoryLabel(id: ExpenseId): string {
  return EXPENSE_CATEGORIES.find((category) => category.id === id)?.label ?? id;
}

export function OpenAccountingExpenses() {
  const monthOptions = useMemo(() => MONTHS.map((month) => month.id), []);
  const [monthKey, setMonthKey] = useState(defaultMonthId);
  const [books, setBooks] = useState<MonthBooks>(() => ({ [defaultMonthId]: seedMonth(defaultMonthId) }));
  const [editId, setEditId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<ExpenseId>(operatingCategories[0]!.id);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    setBooks((current) => (current[monthKey] ? current : { ...current, [monthKey]: seedMonth(monthKey) }));
    setEditId(null);
    setCategoryId(operatingCategories[0]!.id);
    setAmount("");
    setNote("");
  }, [monthKey]);

  const rows = books[monthKey] ?? [];
  const totalCents = rows.reduce((sum, row) => sum + row.cents, 0);

  function startEdit(row: ExpenseEntry) {
    setEditId(row.id);
    setCategoryId(row.categoryId);
    setAmount((row.cents / 100).toFixed(2));
    setNote(row.note);
  }

  function clearForm() {
    setEditId(null);
    setCategoryId(operatingCategories[0]!.id);
    setAmount("");
    setNote("");
  }

  function saveEntry(event: FormEvent) {
    event.preventDefault();
    const dollars = Number(amount.replace(/,/g, ""));
    if (!Number.isFinite(dollars) || dollars < 0) return;
    const cents = Math.round(dollars * 100);
    const entry: ExpenseEntry = {
      id: editId ?? `${monthKey}-${categoryId}-${Date.now()}`,
      categoryId,
      cents,
      note: note.trim() || "Admin entry",
    };
    setBooks((current) => {
      const existing = current[monthKey] ?? seedMonth(monthKey);
      const next = editId ? existing.map((row) => (row.id === editId ? entry : row)) : [...existing, entry];
      return { ...current, [monthKey]: next };
    });
    clearForm();
  }

  function removeEntry(id: string) {
    setBooks((current) => ({
      ...current,
      [monthKey]: (current[monthKey] ?? []).filter((row) => row.id !== id),
    }));
    if (editId === id) clearForm();
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <p className="section-label">{editId ? "Edit expense" : "Add expense"}</p>
        <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={saveEntry}>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">Category</span>
            <select
              className="rounded-full border border-border bg-background px-4 py-2"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value as ExpenseId)}
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
            <Input
              type="text"
              inputMode="decimal"
              required
              placeholder="0.00"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="rounded-full tabular-nums"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">Note</span>
            <Input
              type="text"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Reference or description"
              className="rounded-full"
            />
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="submit" className="rounded-full">
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
          Edits are demo-local for this browser session. The Books tab still reads the shared sample ledger until writes are wired through.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <p className="section-label">Expense books</p>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">Month</span>
            <select
              className="rounded-full border border-border bg-background px-4 py-2"
              value={monthKey}
              onChange={(event) => setMonthKey(event.target.value)}
              aria-label="Expense month"
            >
              {monthOptions.map((id) => (
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
                    <td className="py-3 pr-3">{categoryLabel(row.categoryId)}</td>
                    <td className="py-3 pr-3 tabular-nums">{formatUsd(row.cents)}</td>
                    <td className="py-3 pr-3 text-muted-foreground">{row.note}</td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={() => startEdit(row)}>
                          Edit
                        </Button>
                        <Button type="button" size="sm" variant="outline" className="rounded-full text-destructive" onClick={() => removeEntry(row.id)}>
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
