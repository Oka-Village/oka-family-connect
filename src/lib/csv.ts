/** Pure helper: build a CSV string (quotes every cell, escapes quotes, guards spreadsheet formulas). */
export function toCsv(rows: (string | null | undefined)[][]): string {
  const cell = (v: string | null | undefined) => {
    let s = v ?? "";
    if (/^[=+\-@]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  return "\uFEFF" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
}

