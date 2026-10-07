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

export function ChannelMixChart({
  data
}: {
  data: Array<{ label: string; venue: number; aggregator: number; delivery: number }>;
}) {
  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid stroke="#222833" vertical={false} />
          <XAxis dataKey="label" stroke="#77808f" tickLine={false} axisLine={false} />
          <YAxis
            domain={[0, 100]}
            stroke="#77808f"
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip
            formatter={(value, name) => [`${Number(value).toFixed(1)}%`, String(name)]}
            contentStyle={{ background: "#111720", border: "1px solid #29313d", borderRadius: 12 }}
          />
          <Legend />
          <Bar dataKey="venue" name="Заклад" stackId="share" fill="#61a9ff" />
          <Bar dataKey="aggregator" name="Агрегатор" stackId="share" fill="#f5a623" />
          <Bar dataKey="delivery" name="Доставка" stackId="share" fill="#57d38c" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
