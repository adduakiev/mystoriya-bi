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

export function LocationsComparisonChart({
  data
}: {
  data: Array<{
    location: string;
    venue: number;
    delivery: number;
    aggregator: number;
  }>;
}) {
  return (
    <div className="locations-chart-wrap">
      <ResponsiveContainer width="100%" height={Math.max(360, data.length * 38)}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 24, bottom: 4, left: 8 }}
        >
          <CartesianGrid stroke="#222833" horizontal={false} />
          <XAxis
            type="number"
            stroke="#77808f"
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) =>
              value >= 1_000_000 ? `${Math.round(value / 1_000_000)}M` : `${Math.round(value / 1_000)}K`
            }
          />
          <YAxis
            type="category"
            dataKey="location"
            stroke="#77808f"
            tickLine={false}
            axisLine={false}
            width={135}
          />
          <Tooltip
            formatter={(value, name) => [
              `₴${Number(value).toLocaleString("uk-UA", { maximumFractionDigits: 0 })}`,
              String(name)
            ]}
            contentStyle={{ background: "#111720", border: "1px solid #29313d", borderRadius: 12 }}
          />
          <Legend />
          <Bar dataKey="venue" name="Заклад" stackId="total" fill="#61a9ff" />
          <Bar dataKey="delivery" name="Доставка" stackId="total" fill="#57d38c" />
          <Bar dataKey="aggregator" name="Агрегатор" stackId="total" fill="#f5a623" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
