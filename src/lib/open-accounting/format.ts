const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export function formatUsd(cents: number): string {
  return usd.format(cents / 100);
}

export function formatSigned(cents: number): string {
  if (cents < 0) return `−${formatUsd(Math.abs(cents))}`;
  return formatUsd(cents);
}

export function formatDeduction(cents: number): string {
  if (cents === 0) return formatUsd(0);
  return `−${formatUsd(cents)}`;
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatShare(partCents: number, wholeCents: number): string {
  if (wholeCents === 0) return "0%";
  const tenths = Math.round((partCents / wholeCents) * 1_000);
  const whole = Math.trunc(tenths / 10);
  const fraction = Math.abs(tenths % 10);
  return fraction === 0 ? `${whole}%` : `${whole}.${fraction}%`;
}

export function formatIsoDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return iso;
  return `${day} ${MONTH_NAMES[month - 1]} ${year}`;
}

export function formatGrowth(percent: number | null): string | null {
  if (percent === null) return null;
  const absolute = Math.abs(percent);
  const text = Number.isInteger(absolute) ? absolute.toFixed(0) : absolute.toFixed(1);
  if (percent > 0) return `+${text}%`;
  if (percent < 0) return `−${text}%`;
  return "0%";
}
