"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

const PALETTE = ["#f5a623", "#61a9ff", "#c7ced8", "#57d38c", "#d78cff"];

export function MultiYearMetricChart({
  data,
  years,
  metric
}: {
  data: Array<Record<string, string | number>>;
  years: number[];
  metric: "revenue" | "checks" | "averageCheck" | "markupRate";
}) {
  const formatValue = (value: number) => {
    if (metric === "markupRate") return `${value.toFixed(1)}%`;
    if (metric === "checks") return Math.round(value).toLocaleString("uk-UA");
    if (metric === "averageCheck") return `₴${Math.round(value).toLocaleString("uk-UA")}`;
    return `₴${Math.round(value).toLocaleString("uk-UA")}`;
  };

  const tick = (value: number) => {
    if (metric === "markupRate") return `${Math.round(value)}%`;
    if (metric === "checks") return value >= 1000 ? `${Math.round(value / 1000)}K` : String(Math.round(value));
    if (metric === "averageCheck") return `${Math.round(value)}`;
    if (value >= 1_000_000) return `${Math.round(value / 1_000_000)}M`;
    if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
    return String(Math.round(value));
  };

  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height={340}>
        <LineChart data={data}>
          <CartesianGrid stroke="#222833" vertical={false} />
          <XAxis dataKey="label" stroke="#77808f" tickLine={false} axisLine={false} />
          <YAxis
            stroke="#77808f"
            tickLine={false}
            axisLine={false}
            width={58}
            tickFormatter={tick}
          />
          <Tooltip
            formatter={(value, name) => [formatValue(Number(value)), String(name)]}
            contentStyle={{ background: "#111720", border: "1px solid #29313d", borderRadius: 12 }}
          />
          <Legend />
          {years.map((year, index) => (
            <Line
              key={year}
              type="monotone"
              dataKey={String(year)}
              name={String(year)}
              stroke={PALETTE[index % PALETTE.length]}
              strokeWidth={year === years[years.length - 1] ? 3 : 2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
