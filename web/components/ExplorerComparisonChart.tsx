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

export function ExplorerComparisonChart({
  data,
  metric
}: {
  data: Array<{ name: string; current: number; previous: number }>;
  metric: "revenue" | "checks" | "averageCheck" | "markup" | "markupRate";
}) {
  const formatValue = (value: number) => {
    if (metric === "markupRate") return `${value.toFixed(1)}%`;
    if (metric === "checks") return Math.round(value).toLocaleString("uk-UA");
    return `₴${Math.round(value).toLocaleString("uk-UA")}`;
  };

  const tick = (value: number) => {
    if (metric === "markupRate") return `${Math.round(value)}%`;
    if (metric === "checks") {
      return value >= 1000 ? `${Math.round(value / 1000)}K` : String(Math.round(value));
    }
    if (value >= 1_000_000) return `${Math.round(value / 1_000_000)}M`;
    if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
    return String(Math.round(value));
  };

  return (
    <div className="explorer-chart-wrap">
      <ResponsiveContainer width="100%" height={Math.max(360, data.length * 42)}>
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
            tickFormatter={tick}
          />
          <YAxis
            type="category"
            dataKey="name"
            stroke="#77808f"
            tickLine={false}
            axisLine={false}
            width={150}
          />
          <Tooltip
            formatter={(value, name) => [formatValue(Number(value)), String(name)]}
            contentStyle={{
              background: "#111720",
              border: "1px solid #29313d",
              borderRadius: 12
            }}
          />
          <Legend />
          <Bar dataKey="current" name="Поточний" fill="#f5a623" radius={[0, 4, 4, 0]} />
          <Bar dataKey="previous" name="LY" fill="#667180" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
