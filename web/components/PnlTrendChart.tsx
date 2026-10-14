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

type PnlTrendRow = {
  label: string;
  revenueFact: number;
  revenuePlan: number;
  revenueLy: number;
  profitFact: number;
  profitPlan: number;
  profitLy: number;
  markupFact: number;
  markupPlan: number;
  markupLy: number;
};

export function PnlTrendChart({
  data,
  metric
}: {
  data: PnlTrendRow[];
  metric: "revenue" | "profit" | "markup";
}) {
  const factKey = `${metric}Fact`;
  const planKey = `${metric}Plan`;
  const lyKey = `${metric}Ly`;

  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data}>
          <CartesianGrid stroke="#222833" vertical={false} />
          <XAxis dataKey="label" stroke="#77808f" tickLine={false} axisLine={false} />
          <YAxis
            stroke="#77808f"
            tickLine={false}
            axisLine={false}
            width={58}
            tickFormatter={(value) =>
              Math.abs(value) >= 1_000_000
                ? `${Math.round(value / 1_000_000)}M`
                : `${Math.round(value / 1_000)}K`
            }
          />
          <Tooltip
            formatter={(value, name) => [
              `₴ ${Math.round(Number(value)).toLocaleString("uk-UA")}`,
              String(name)
            ]}
            contentStyle={{
              background: "#111720",
              border: "1px solid #29313d",
              borderRadius: 12
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey={lyKey}
            name="2025"
            stroke="#68717e"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey={planKey}
            name="План 2026"
            stroke="#61a9ff"
            strokeWidth={2}
            strokeDasharray="7 5"
            dot={false}
          />
          <Line
            type="monotone"
            dataKey={factKey}
            name="Факт 2026"
            stroke="#f5a623"
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
