"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { TrendPoint } from "@/lib/data/types";

export function RevenueChart({
  data,
  currentLabel,
  previousLabel
}: {
  data: TrendPoint[];
  currentLabel: string;
  previousLabel: string;
}) {
  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="currentFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f5a623" stopOpacity={0.36} />
              <stop offset="100%" stopColor="#f5a623" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#222833" vertical={false} />
          <XAxis dataKey="label" stroke="#77808f" tickLine={false} axisLine={false} />
          <YAxis
            stroke="#77808f"
            tickLine={false}
            axisLine={false}
            width={58}
            tickFormatter={(value) => value >= 1_000_000 ? `${Math.round(value / 1_000_000)}M` : `${Math.round(value / 1_000)}K`}
          />
          <Tooltip
            formatter={(value, name) => [
              `₴${Number(value).toLocaleString("uk-UA", { maximumFractionDigits: 0 })}`,
              name === "current" ? currentLabel : previousLabel
            ]}
            contentStyle={{ background: "#111720", border: "1px solid #29313d", borderRadius: 12 }}
          />
          <Area name="previous" type="monotone" dataKey="previous" stroke="#68717e" fill="transparent" strokeWidth={2} />
          <Area name="current" type="monotone" dataKey="current" stroke="#f5a623" fill="url(#currentFill)" strokeWidth={3} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
