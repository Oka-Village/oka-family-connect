import type { ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatCount, formatUsd } from "@/lib/open-accounting/format";

export const chartColors = {
  terracotta: "#bb6a4d",
  sage: "#6fa887",
  golden: "#e0ac51",
  sand: "#e4dacd",
  ink: "#372c24",
};

const compactUsd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

type TipProps = {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string; payload?: { tooltipSuffix?: string } }[];
  label?: string;
};

function Tip({ active, payload, label, money }: TipProps & { money: boolean }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground shadow-soft">
      {label && <p className="font-medium">{label}</p>}
      {payload.map((item) => (
        <p key={item.name} className="mt-1 text-muted-foreground">
          {item.name}: {money ? formatUsd(Math.round(Number(item.value ?? 0) * 100)) : formatCount(Number(item.value ?? 0))}{item.payload?.tooltipSuffix}
        </p>
      ))}
    </div>
  );
}

export function Bars({
  data,
  name,
  color,
  money,
  label,
}: {
  data: { label: string; value: number; tooltipSuffix?: string }[];
  name: string;
  color: string;
  money: boolean;
  label: string;
}) {
  const chartData = data.map((point) => ({ ...point, value: money ? point.value / 100 : point.value }));
  return (
    <div className="mt-4 h-56" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={chartColors.sand} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: chartColors.ink, fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis
            tickFormatter={(value: number) => (money ? compactUsd.format(value) : formatCount(value))}
            tick={{ fill: chartColors.ink, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={56}
          />
          <Tooltip content={<Tip money={money} />} />
          <Bar dataKey="value" name={name} fill={color} radius={[6, 6, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Donut({
  slices,
  center,
  label,
  empty,
}: {
  slices: { name: string; cents: number; color: string }[];
  center: string;
  label: string;
  empty: ReactNode;
}) {
  const total = slices.reduce((sum, slice) => sum + slice.cents, 0);
  if (total <= 0) {
    return <div className="mt-4 rounded-2xl bg-muted/60 px-4 py-8 text-sm leading-relaxed text-muted-foreground">{empty}</div>;
  }
  return (
    <div className="relative mx-auto mt-2 h-64 w-full max-w-xs" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={slices} dataKey="cents" nameKey="name" innerRadius={68} outerRadius={92} paddingAngle={2} stroke="hsl(var(--background))" isAnimationActive={false}>
            {slices.map((slice) => (
              <Cell key={slice.name} fill={slice.color} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => formatUsd(Number(value ?? 0))} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <p className="font-serif text-2xl">{center}</p>
      </div>
    </div>
  );
}
