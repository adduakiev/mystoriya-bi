"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

export function DeliveryVsAggregatorChart({
  data
}: {
  data: Array<{ label: string; delivery: number; aggregator: number }>;
}) {
  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data}>
          <CartesianGrid stroke="#222833" vertical={false} />
          <XAxis dataKey="label" stroke="#77808f" tickLine={false} axisLine={false} />
          <YAxis
            stroke="#77808f"
            tickLine={false}
            axisLine={false}
            width={58}
            tickFormatter={(value) =>
              value >= 1_000_000 ? `${Math.round(value / 1_000_000)}M` : `${Math.round(value / 1_000)}K`
            }
          />
          <Tooltip
            formatter={(value, name) => [
              `₴${Number(value).toLocaleString("uk-UA", { maximumFractionDigits: 0 })}`,
              String(name)
            ]}
            contentStyle={{ background: "#111720", border: "1px solid #29313d", borderRadius: 12 }}
          />
          <Legend />
          <Bar dataKey="delivery" name="Доставка" fill="#57d38c" radius={[4, 4, 0, 0]} />
          <Bar dataKey="aggregator" name="Агрегатори" fill="#f5a623" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
